import "server-only";

import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { notifyAppointmentEvent } from "@/server/services/appointment-notifications";
import { createNotification } from "@/server/services/notifications";
import { getSettings, type RemindersSettings } from "@/server/services/settings";
import { formatTime } from "@/lib/dates";
import type { TablesUpdate } from "@/types/domain";

const log = createLogger("reminders");

export type ReminderKind = "reminder_24h" | "reminder_2h";

type Candidate = { id: string; patient_id: string; start_time: string; status: string; reminder_24h_sent_at: string | null; reminder_2h_sent_at: string | null };

/**
 * Lógica pura de selección: un turno es candidato si su inicio cae dentro de
 * [ahora + horasAntes - ventana, ahora + horasAntes] y todavía no se envió ese recordatorio.
 * Se exporta para poder testear la deduplicación sin base de datos.
 */
export function selectReminderCandidates(appointments: Candidate[], kind: ReminderKind, hoursBefore: number, windowMinutes: number, now = new Date()): Candidate[] {
  const target = now.getTime() + hoursBefore * 3600_000;
  const lower = target - windowMinutes * 60_000;
  const field = kind === "reminder_24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";
  return appointments.filter((a) => {
    if (!["pending", "confirmed", "rescheduled"].includes(a.status)) return false;
    if (a[field]) return false;
    const start = new Date(a.start_time).getTime();
    return start >= lower && start <= target && start > now.getTime();
  });
}

/** true si la hora local está dentro del rango de silencio (ej. 22:00 → 08:00). */
export function isQuietHour(now: Date, timezone: string, quietStart: string, quietEnd: string): boolean {
  const hhmm = formatTime(now, timezone);
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hhmm >= quietStart && hhmm < quietEnd;
  return hhmm >= quietStart || hhmm < quietEnd;
}

async function fetchWindow(admin: AdminSupabaseClient, from: Date, to: Date): Promise<Candidate[]> {
  const { data, error } = await admin
    .from("appointments")
    .select("id, patient_id, start_time, status, reminder_24h_sent_at, reminder_2h_sent_at")
    .in("status", ["pending", "confirmed", "rescheduled"])
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString());
  if (error) throw error;
  return data ?? [];
}

/**
 * Marca el recordatorio como enviado ANTES de enviarlo, de forma atómica (update condicional).
 * Si otra ejecución del cron ya lo marcó, el update no afecta filas y se omite: sin duplicados.
 */
async function claim(admin: AdminSupabaseClient, id: string, kind: ReminderKind): Promise<boolean> {
  const field = kind === "reminder_24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";
  const now = new Date().toISOString();
  const payload: TablesUpdate<"appointments"> = kind === "reminder_24h" ? { reminder_24h_sent_at: now } : { reminder_2h_sent_at: now };
  const { data, error } = await admin.from("appointments").update(payload).eq("id", id).is(field, null).select("id");
  if (error) {
    log.warn("No se pudo reclamar el recordatorio", { id, kind, ...errorMeta(error) });
    return false;
  }
  return (data ?? []).length > 0;
}

async function release(admin: AdminSupabaseClient, id: string, kind: ReminderKind) {
  const payload: TablesUpdate<"appointments"> = kind === "reminder_24h" ? { reminder_24h_sent_at: null } : { reminder_2h_sent_at: null };
  await admin.from("appointments").update(payload).eq("id", id);
}

export type ReminderRunResult = { kind: ReminderKind; candidates: number; sent: number; failed: number; skipped: number };

async function runKind(admin: AdminSupabaseClient, settings: RemindersSettings, timezone: string, kind: ReminderKind, hoursBefore: number, now: Date): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { kind, candidates: 0, sent: 0, failed: 0, skipped: 0 };
  const windowMs = settings.send_window_minutes * 60_000;
  const target = new Date(now.getTime() + hoursBefore * 3600_000);
  const rows = await fetchWindow(admin, new Date(target.getTime() - windowMs), target);
  const candidates = selectReminderCandidates(rows, kind, hoursBefore, settings.send_window_minutes, now);
  result.candidates = candidates.length;

  const quiet = isQuietHour(now, timezone, settings.quiet_hours_start, settings.quiet_hours_end);
  if (quiet && kind === "reminder_24h") {
    // En horario de silencio no enviamos WhatsApp; el próximo ciclo dentro de la ventana lo retomará.
    result.skipped = candidates.length;
    return result;
  }

  for (const appointment of candidates) {
    const claimed = await claim(admin, appointment.id, kind);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }
    try {
      let delivered = false;
      if (settings.channels.includes("whatsapp")) {
        const wa = await notifyAppointmentEvent(appointment.id, kind, { useApprovedTemplate: true });
        delivered = Boolean(wa?.ok);
        if (wa && !wa.ok) log.warn("Recordatorio por WhatsApp falló", { appointmentId: appointment.id, kind, error: wa.error });
      }
      if (settings.channels.includes("in_app")) {
        const { data: patient } = await admin.from("patients").select("profile_id, first_name").eq("id", appointment.patient_id).maybeSingle();
        if (patient?.profile_id) {
          await createNotification(admin, {
            userId: patient.profile_id,
            type: "appointment_reminder",
            title: kind === "reminder_24h" ? "Tu sesión es mañana" : "Tu sesión es en breve",
            body: `${formatTime(appointment.start_time, timezone)} hs. ${kind === "reminder_24h" ? "¿Confirmás tu asistencia?" : "Te esperamos."}`,
            data: { appointment_id: appointment.id, kind },
          });
          delivered = true;
        }
      }
      if (delivered) result.sent += 1;
      else {
        result.failed += 1;
        await release(admin, appointment.id, kind);
      }
    } catch (error) {
      result.failed += 1;
      log.error("Error enviando recordatorio", { appointmentId: appointment.id, kind, ...errorMeta(error) });
      await release(admin, appointment.id, kind);
    }
  }
  return result;
}

/** Ejecuta el ciclo de recordatorios (llamado por el cron cada 15 minutos). */
export async function runReminders(now = new Date()): Promise<ReminderRunResult[]> {
  const admin = createAdminClient();
  const { reminders, scheduling } = await getSettings(admin, ["reminders", "scheduling"] as const);
  if (!reminders.enabled) return [];
  const results: ReminderRunResult[] = [];
  if (reminders.reminder_24h_enabled) {
    results.push(await runKind(admin, reminders, scheduling.timezone, "reminder_24h", reminders.reminder_24h_hours_before, now));
  }
  if (reminders.additional_reminder_enabled) {
    results.push(await runKind(admin, reminders, scheduling.timezone, "reminder_2h", reminders.additional_reminder_hours_before, now));
  }
  for (const r of results) log.info("Ciclo de recordatorios", { ...r });
  return results;
}
