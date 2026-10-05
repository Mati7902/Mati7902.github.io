import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import type { BusyRange } from "@/lib/scheduling/slots";
import { getSettings } from "@/server/services/settings";
import { createEvent, deleteEvent, isGoogleConfigured, listEvents, queryFreeBusy, refreshAccessToken, updateEvent } from "@/server/services/google-calendar/client";
import { MODALITY_LABEL } from "@/types/domain";

const log = createLogger("google-sync");

type Integration = {
  id: string;
  calendar_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  sync_token: string | null;
  is_active: boolean;
};

async function getActiveIntegration(admin: AdminSupabaseClient): Promise<Integration | null> {
  const { data } = await admin.from("calendar_integrations").select("*").eq("provider", "google").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Integration | null) ?? null;
}

/** Devuelve un access token válido, renovándolo con el refresh token si expiró. */
async function getAccessToken(admin: AdminSupabaseClient, integration: Integration): Promise<string> {
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (integration.access_token_encrypted && expiresAt - Date.now() > 60_000) {
    return decryptSecret(integration.access_token_encrypted);
  }
  if (!integration.refresh_token_encrypted) throw new AppError("NOT_CONFIGURED", "La integración de Google no tiene refresh token. Reconectá la cuenta.");
  const refreshed = await refreshAccessToken(decryptSecret(integration.refresh_token_encrypted));
  await admin
    .from("calendar_integrations")
    .update({ access_token_encrypted: encryptSecret(refreshed.access_token), token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), last_error: null })
    .eq("id", integration.id);
  return refreshed.access_token;
}

async function logSync(admin: AdminSupabaseClient, input: { integrationId: string | null; appointmentId?: string | null; direction: "push" | "pull"; action: string; externalEventId?: string | null; status: "ok" | "error" | "skipped"; error?: string | null }) {
  await admin.from("calendar_sync_log").insert({
    integration_id: input.integrationId,
    appointment_id: input.appointmentId ?? null,
    direction: input.direction,
    action: input.action,
    external_event_id: input.externalEventId ?? null,
    status: input.status,
    error: input.error ?? null,
  });
}

/**
 * Empuja el estado actual de un turno a Google Calendar (crear / actualizar / cancelar).
 * Idempotente: guarda google_event_id y nunca crea duplicados. No lanza: registra en calendar_sync_log.
 */
export async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !isGoogleConfigured()) return;
  const admin = createAdminClient();
  const integration = await getActiveIntegration(admin);
  if (!integration) return;

  const { data: appointment } = await admin.from("appointments").select("*, patients(first_name, last_name)").eq("id", appointmentId).maybeSingle();
  if (!appointment) return;

  try {
    const token = await getAccessToken(admin, integration);
    const { scheduling, "site.identity": identity } = await getSettings(admin, ["scheduling", "site.identity"] as const);
    const patient = appointment.patients as { first_name: string; last_name: string } | null;
    // Privacidad: solo iniciales del paciente en el calendario externo; sin notas.
    const initials = patient ? `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}.` : "Paciente";
    const summary = `Sesión ${initials} · ${MODALITY_LABEL[appointment.modality]}`;
    const description = `Turno gestionado por ${identity.platform_name}. Estado: ${appointment.status}.`;

    if (appointment.status === "cancelled") {
      if (appointment.google_event_id) {
        await deleteEvent(token, integration.calendar_id, appointment.google_event_id);
        await admin.from("appointments").update({ google_sync_status: "synced", google_synced_at: new Date().toISOString() }).eq("id", appointment.id);
        await logSync(admin, { integrationId: integration.id, appointmentId: appointment.id, direction: "push", action: "delete", externalEventId: appointment.google_event_id, status: "ok" });
      }
      return;
    }

    const input = {
      summary,
      description,
      start: new Date(appointment.start_time),
      end: new Date(appointment.end_time),
      timeZone: scheduling.timezone,
      location: appointment.modality === "presencial" ? (appointment.location ?? scheduling.default_location ?? undefined) : undefined,
      appointmentId: appointment.id,
      status: appointment.status === "requested" ? ("tentative" as const) : ("confirmed" as const),
    };

    if (appointment.google_event_id) {
      await updateEvent(token, integration.calendar_id, appointment.google_event_id, input);
      await admin.from("appointments").update({ google_sync_status: "synced", google_synced_at: new Date().toISOString() }).eq("id", appointment.id);
      await logSync(admin, { integrationId: integration.id, appointmentId: appointment.id, direction: "push", action: "update", externalEventId: appointment.google_event_id, status: "ok" });
    } else {
      const created = await createEvent(token, integration.calendar_id, input);
      await admin.from("appointments").update({ google_event_id: created.id, google_sync_status: "synced", google_synced_at: new Date().toISOString() }).eq("id", appointment.id);
      await logSync(admin, { integrationId: integration.id, appointmentId: appointment.id, direction: "push", action: "create", externalEventId: created.id, status: "ok" });
    }
  } catch (error) {
    log.warn("Sincronización con Google falló", { appointmentId, ...errorMeta(error) });
    await admin.from("appointments").update({ google_sync_status: "failed" }).eq("id", appointmentId);
    await admin.from("calendar_integrations").update({ last_error: error instanceof Error ? error.message : String(error) }).eq("id", integration.id);
    await logSync(admin, { integrationId: integration.id, appointmentId, direction: "push", action: "push", status: "error", error: error instanceof Error ? error.message : String(error) });
  }
}

/** Períodos ocupados del calendario externo (para no ofrecer horarios ya tomados fuera de la app). */
export async function getGoogleBusyRanges(from: Date, to: Date): Promise<BusyRange[]> {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !isGoogleConfigured()) return [];
  const admin = createAdminClient();
  const integration = await getActiveIntegration(admin);
  if (!integration) return [];
  try {
    const token = await getAccessToken(admin, integration);
    const { scheduling } = await getSettings(admin, ["scheduling"] as const);
    const busy = await queryFreeBusy(token, integration.calendar_id, from, to, scheduling.timezone);
    return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch (error) {
    log.warn("freeBusy falló; se continúa sin calendario externo", errorMeta(error));
    return [];
  }
}

/**
 * Importa cambios del calendario de Google como bloqueos (eventos ajenos a la app) usando syncToken.
 * Los eventos creados por la app se reconocen por extendedProperties y se ignoran → sin bucles.
 */
export async function pullGoogleChanges(): Promise<{ imported: number; removed: number }> {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !isGoogleConfigured()) return { imported: 0, removed: 0 };
  const admin = createAdminClient();
  const integration = await getActiveIntegration(admin);
  if (!integration) return { imported: 0, removed: 0 };
  let imported = 0;
  let removed = 0;
  try {
    const token = await getAccessToken(admin, integration);
    const now = new Date();
    const horizon = new Date(now.getTime() + 60 * 24 * 3600_000);
    let result: Awaited<ReturnType<typeof listEvents>>;
    try {
      result = await listEvents(token, integration.calendar_id, { syncToken: integration.sync_token, timeMin: now, timeMax: horizon });
    } catch (error) {
      // 410 Gone: el syncToken expiró → sincronización completa.
      if (error instanceof AppError && error.status === 410) {
        result = await listEvents(token, integration.calendar_id, { timeMin: now, timeMax: horizon });
      } else throw error;
    }
    for (const event of result.items) {
      if (event.extendedProperties?.private?.psms_origin === "app") continue;
      const key = `google:${event.id}`;
      if (event.status === "cancelled") {
        const { count } = await admin.from("blocked_slots").delete({ count: "exact" }).eq("reason", key);
        removed += count ?? 0;
        continue;
      }
      const start = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00Z` : null);
      const end = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00Z` : null);
      if (!start || !end) continue;
      await admin.from("blocked_slots").delete().eq("reason", key);
      const { error } = await admin.from("blocked_slots").insert({ start_time: start, end_time: end, type: "exception", reason: key });
      if (!error) imported += 1;
    }
    await admin.from("calendar_integrations").update({ sync_token: result.nextSyncToken ?? integration.sync_token, last_synced_at: new Date().toISOString(), last_error: null }).eq("id", integration.id);
    await logSync(admin, { integrationId: integration.id, direction: "pull", action: "incremental", status: "ok" });
  } catch (error) {
    log.warn("pullGoogleChanges falló", errorMeta(error));
    await logSync(admin, { integrationId: integration.id, direction: "pull", action: "incremental", status: "error", error: error instanceof Error ? error.message : String(error) });
  }
  return { imported, removed };
}
