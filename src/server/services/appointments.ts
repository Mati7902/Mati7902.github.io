import "server-only";

import { addDays } from "date-fns";

import { AppError, fromDatabaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { generateDaySlots, upcomingAvailableDates, type BusyRange, type Slot } from "@/lib/scheduling/slots";
import { toDateKey, zonedToUtc } from "@/lib/dates";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleBusyRanges } from "@/server/services/google-calendar/sync";
import { getSetting, type SchedulingSettings } from "@/server/services/settings";
import type { Appointment, AppointmentModality, AppointmentStatus, AppointmentWithPatient, AvailabilityRule } from "@/types/domain";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/types/domain";

const log = createLogger("appointments");

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

/* ------------------------------------------------------------------------ */
/* Lecturas                                                                  */
/* ------------------------------------------------------------------------ */
export async function getNextAppointment(client: AnyClient, patientId: string): Promise<Appointment | null> {
  const { data } = await client
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .gte("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function listPatientAppointments(client: AnyClient, patientId: string) {
  const nowIso = new Date().toISOString();
  const [upcoming, past] = await Promise.all([
    client
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .gte("end_time", nowIso)
      .not("status", "in", "(cancelled,completed,no_show)")
      .order("start_time", { ascending: true }),
    client
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .or(`end_time.lt.${nowIso},status.in.(cancelled,completed,no_show)`)
      .order("start_time", { ascending: false })
      .limit(20),
  ]);
  return { upcoming: upcoming.data ?? [], past: past.data ?? [] };
}

/** Columnas para vistas del profesional: datos del paciente y nota administrativa (tabla aparte, solo admin). */
export const ADMIN_APPOINTMENT_SELECT = "*, patients(id, first_name, last_name, phone, whatsapp_phone, email, profile_id), appointment_admin_notes(notes)";

export async function getAppointmentById(client: AnyClient, id: string): Promise<AppointmentWithPatient | null> {
  const { data } = await client.from("appointments").select(ADMIN_APPOINTMENT_SELECT).eq("id", id).maybeSingle();
  return (data as AppointmentWithPatient | null) ?? null;
}

export async function listAppointmentsBetween(client: AnyClient, from: Date, to: Date, statuses?: AppointmentStatus[]): Promise<AppointmentWithPatient[]> {
  let query = client
    .from("appointments")
    .select(ADMIN_APPOINTMENT_SELECT)
    .gte("start_time", from.toISOString())
    .lt("start_time", to.toISOString())
    .order("start_time", { ascending: true });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw fromDatabaseError(error);
  return (data ?? []) as AppointmentWithPatient[];
}

export async function getAppointmentHistory(client: AnyClient, appointmentId: string) {
  const { data } = await client
    .from("appointment_history")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/* ------------------------------------------------------------------------ */
/* Disponibilidad                                                            */
/* ------------------------------------------------------------------------ */
export type AvailabilityDay = { dateKey: string; slots: Slot[] };

async function loadAvailabilityContext(admin: AdminSupabaseClient, from: Date, to: Date, excludeAppointmentId?: string) {
  const [{ data: rules }, { data: appointments }, { data: blocked }] = await Promise.all([
    admin.from("availability_rules").select("*").eq("is_active", true),
    admin
      .from("appointments")
      .select("id, start_time, end_time")
      .neq("status", "cancelled")
      .lt("start_time", to.toISOString())
      .gt("end_time", from.toISOString()),
    admin
      .from("blocked_slots")
      .select("start_time, end_time")
      .lt("start_time", to.toISOString())
      .gt("end_time", from.toISOString()),
  ]);
  const own = excludeAppointmentId ? (appointments ?? []).find((a) => a.id === excludeAppointmentId) : undefined;
  const busy: BusyRange[] = [
    ...(appointments ?? []).filter((a) => a.id !== excludeAppointmentId).map((a) => ({ start: new Date(a.start_time), end: new Date(a.end_time) })),
    ...(blocked ?? []).map((b) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
  ];
  return {
    rules: (rules ?? []) as AvailabilityRule[],
    busy,
    ownRange: own ? { start: new Date(own.start_time), end: new Date(own.end_time) } : null,
  };
}

/**
 * Horarios realmente disponibles para los próximos días. Usa el cliente admin para ver la
 * ocupación completa, pero SOLO devuelve horarios libres (nunca datos de otros pacientes).
 */
export async function getAvailableSlots(options: {
  modality: AppointmentModality;
  fromDateKey?: string;
  days?: number;
  excludeAppointmentId?: string;
  externalBusy?: BusyRange[];
  durationMinutes?: number;
}): Promise<{ days: AvailabilityDay[]; settings: SchedulingSettings }> {
  const admin = createAdminClient();
  const settings = await getSetting(admin, "scheduling");
  const tz = settings.timezone;
  const now = new Date();
  const days = Math.min(options.days ?? 14, settings.max_days_in_advance);
  const startKey = options.fromDateKey ?? toDateKey(now, tz);
  const from = new Date(`${startKey}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = addDays(from, days + 2);

  const { rules, busy } = await loadBusyContext(admin, from, to, options.excludeAppointmentId);
  const filteredBusy = options.externalBusy?.length ? [...busy, ...options.externalBusy] : busy;

  const dateKeys = upcomingAvailableDates(rules, tz, days, new Date(`${startKey}T12:00:00Z`));
  const result: AvailabilityDay[] = dateKeys.map((dateKey) => ({
    dateKey,
    slots: generateDaySlots({
      dateKey,
      timezone: tz,
      rules,
      busy: filteredBusy,
      modality: options.modality,
      // Sin duración explícita se usa la de cada regla (pueden convivir franjas de 50 y 60 min).
      durationMinutes: options.durationMinutes,
      now,
      minHoursBeforeBooking: settings.min_hours_before_booking,
      maxDaysInAdvance: settings.max_days_in_advance,
    }),
  }));

  return { days: result.filter((d) => d.slots.length > 0), settings };
}

/**
 * Reglas + ocupación (turnos, bloqueos, calendario externo) de una ventana. Al reprogramar,
 * el turno propio no bloquea su propio horario: se excluye por id (no por coincidencia de hora,
 * para no ocultar por error un bloqueo externo que empiece a la misma hora).
 */
async function loadBusyContext(admin: AdminSupabaseClient, from: Date, to: Date, excludeAppointmentId?: string) {
  const [{ rules, busy: localBusy, ownRange }, googleBusy] = await Promise.all([
    loadAvailabilityContext(admin, from, to, excludeAppointmentId),
    getGoogleBusyRanges(from, to),
  ]);
  // El evento de Google del propio turno (si está sincronizado) también se ignora.
  const external = ownRange
    ? googleBusy.filter((b) => !(b.start.getTime() === ownRange.start.getTime() && b.end.getTime() === ownRange.end.getTime()))
    : googleBusy;
  return { rules, busy: [...localBusy, ...external] };
}

/**
 * Segunda verificación antes de reservar o reprogramar: el inicio pedido debe coincidir con un
 * turno generado por la grilla (regla, duración, intervalo, anticipación, máximo de días) y estar
 * libre. El FIN lo decide el servidor (duración de la regla): nunca se confía en el del cliente.
 */
export async function assertSlotAvailable(start: Date, modality: AppointmentModality, excludeAppointmentId?: string): Promise<{ settings: SchedulingSettings; end: Date }> {
  const admin = createAdminClient();
  const settings = await getSetting(admin, "scheduling");
  const tz = settings.timezone;
  const dateKey = toDateKey(start, tz);
  const dayStart = zonedToUtc(dateKey, "00:00", tz);
  const dayEnd = addDays(dayStart, 1);
  const { rules, busy } = await loadBusyContext(admin, dayStart, dayEnd, excludeAppointmentId);
  const base = { dateKey, timezone: tz, rules, modality, now: new Date(), minHoursBeforeBooking: settings.min_hours_before_booking, maxDaysInAdvance: settings.max_days_in_advance };

  const match = generateDaySlots({ ...base, busy }).find((s) => s.start.getTime() === start.getTime());
  if (match) return { settings, end: match.end };

  const existsInGrid = generateDaySlots({ ...base, busy: [] }).some((s) => s.start.getTime() === start.getTime());
  if (existsInGrid) throw new AppError("CONFLICT", "Ese horario ya no está disponible. Elegí otro.");
  throw new AppError("VALIDATION", "Ese horario está fuera de la disponibilidad del profesional.");
}

/* ------------------------------------------------------------------------ */
/* Mutaciones (siempre vía RPC transaccional)                                */
/* ------------------------------------------------------------------------ */
export type CreateAppointmentInput = {
  patientId: string;
  start: Date;
  end: Date;
  modality: AppointmentModality;
  status: AppointmentStatus;
  source: "app" | "admin" | "whatsapp" | "google" | "system";
  patientNote?: string | null;
  planId?: string | null;
  videoLink?: string | null;
  location?: string | null;
  adminNotes?: string | null;
};

export async function createAppointment(client: AnyClient, input: CreateAppointmentInput): Promise<Appointment> {
  const { data, error } = await client.rpc("create_appointment_tx", {
    p_patient_id: input.patientId,
    p_start: input.start.toISOString(),
    p_end: input.end.toISOString(),
    p_modality: input.modality,
    p_status: input.status,
    p_source: input.source,
    p_patient_note: input.patientNote ?? undefined,
    p_plan_id: input.planId ?? undefined,
    p_video_link: input.videoLink ?? undefined,
    p_location: input.location ?? undefined,
    p_admin_notes: input.adminNotes ?? undefined,
  });
  if (error) {
    log.warn("create_appointment_tx falló", { code: error.code, message: error.message });
    throw fromDatabaseError(error, "No pudimos registrar el turno.");
  }
  return data as Appointment;
}

export async function rescheduleAppointment(
  client: AnyClient,
  input: { appointmentId: string; start: Date; end: Date; newStatus: AppointmentStatus; reason?: string | null; source: "app" | "admin" | "whatsapp" | "google" | "system" },
): Promise<Appointment> {
  const { data, error } = await client.rpc("reschedule_appointment_tx", {
    p_appointment_id: input.appointmentId,
    p_new_start: input.start.toISOString(),
    p_new_end: input.end.toISOString(),
    p_new_status: input.newStatus,
    p_reason: input.reason ?? undefined,
    p_source: input.source,
  });
  if (error) throw fromDatabaseError(error, "No pudimos reprogramar el turno.");
  return data as Appointment;
}

export async function cancelAppointment(client: AnyClient, appointmentId: string, reason?: string | null, source: "app" | "admin" | "whatsapp" | "google" | "system" = "app"): Promise<Appointment> {
  const { data, error } = await client.rpc("cancel_appointment_tx", {
    p_appointment_id: appointmentId,
    p_reason: reason ?? undefined,
    p_source: source,
  });
  if (error) throw fromDatabaseError(error, "No pudimos cancelar el turno.");
  return data as Appointment;
}

export async function confirmAppointment(client: AnyClient, appointmentId: string, source: "app" | "admin" | "whatsapp" | "google" | "system" = "app"): Promise<Appointment> {
  const { data, error } = await client.rpc("confirm_appointment_tx", { p_appointment_id: appointmentId, p_source: source });
  if (error) throw fromDatabaseError(error, "No pudimos confirmar el turno.");
  return data as Appointment;
}

/** Decide el estado inicial de una reserva hecha por el paciente según el modo configurado. */
export function initialStatusForPatientBooking(settings: SchedulingSettings): AppointmentStatus {
  return settings.booking_mode === "auto" ? "confirmed" : "requested";
}

/** El paciente puede preparar la sesión cuando faltan menos de N horas (configurable). */
export function canPrepareSession(appointment: Appointment, settings: SchedulingSettings, now = new Date()): boolean {
  if (!settings.session_prep_enabled) return false;
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) return false;
  const start = new Date(appointment.start_time).getTime();
  const windowMs = settings.session_prep_hours_before * 60 * 60 * 1000;
  return start - now.getTime() <= windowMs && start > now.getTime();
}

export function canPatientModify(appointment: Appointment, settings: SchedulingSettings, kind: "cancel" | "reschedule", now = new Date()): boolean {
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) return false;
  const allowed = kind === "cancel" ? settings.allow_patient_cancel : settings.allow_patient_reschedule;
  if (!allowed) return false;
  const minHours = kind === "cancel" ? settings.cancel_min_hours : settings.reschedule_min_hours;
  return new Date(appointment.start_time).getTime() - minHours * 3600_000 > now.getTime();
}
