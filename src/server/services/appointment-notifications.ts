import "server-only";

import { formatLongDate, formatTime, capitalize } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { getSettings } from "@/server/services/settings";
import { isWhatsAppConfigured, sendInteractiveButtons, sendTemplate, sendText, type SendResult } from "@/server/services/whatsapp/client";
import { getTemplate, renderTemplate, templateParams } from "@/server/services/whatsapp/templates";
import { MODALITY_LABEL, type Appointment, type Patient } from "@/types/domain";

const log = createLogger("appointment-notifications");

export type AppointmentMessageKind =
  | "booking_registered"
  | "booking_requested"
  | "request_approved"
  | "appointment_changed"
  | "cancellation_done"
  | "reminder_24h"
  | "reminder_2h";

type Vars = Record<string, string>;

function buildVars(appointment: Appointment, patient: Patient, professionalName: string, tz: string): Vars {
  const access = appointment.modality === "virtual"
    ? appointment.video_link
      ? `Enlace de la videollamada: ${appointment.video_link}`
      : "Te enviaremos el enlace de la videollamada antes de la sesión."
    : appointment.location
      ? `Dirección: ${appointment.location}`
      : "";
  return {
    first_name: patient.first_name,
    professional_name: professionalName,
    date: capitalize(formatLongDate(appointment.start_time, tz)),
    time: formatTime(appointment.start_time, tz),
    modality: MODALITY_LABEL[appointment.modality].toLowerCase(),
    access_info: access,
    app_url: getServerEnv().NEXT_PUBLIC_APP_URL,
  };
}

/** Botones de respuesta rápida según el tipo de mensaje. */
function buttonsFor(kind: AppointmentMessageKind, appointmentId: string) {
  const id = appointmentId;
  switch (kind) {
    case "reminder_24h":
    case "appointment_changed":
      return [
        { id: `CONFIRM:${id}`, title: "Confirmar" },
        { id: `RESCHEDULE:${id}`, title: "Reprogramar" },
        { id: `CANCEL:${id}`, title: "Cancelar" },
      ];
    case "request_approved":
    case "booking_registered":
      return [
        { id: `CONFIRM:${id}`, title: "Confirmar" },
        { id: `RESCHEDULE:${id}`, title: "Reprogramar" },
      ];
    default:
      return [];
  }
}

async function recordOutbound(admin: AdminSupabaseClient, input: { patient: Patient; phone: string; appointmentId: string; kind: string; body: string; result: SendResult }) {
  try {
    let { data: contact } = await admin.from("whatsapp_contacts").select("id").eq("phone", input.phone).maybeSingle();
    if (!contact) {
      const { data: created } = await admin
        .from("whatsapp_contacts")
        .insert({ phone: input.phone, patient_id: input.patient.id, display_name: `${input.patient.first_name} ${input.patient.last_name}` })
        .select("id")
        .single();
      contact = created;
    }
    if (!contact) return;
    await admin.from("whatsapp_contacts").update({ last_outbound_at: new Date().toISOString() }).eq("id", contact.id);
    await admin.from("whatsapp_messages").insert({
      contact_id: contact.id,
      direction: "outbound",
      message_type: "text",
      body: input.body,
      kind: input.kind,
      appointment_id: input.appointmentId,
      status: input.result.ok ? "sent" : "failed",
      wa_message_id: input.result.ok ? input.result.messageId : null,
      error: input.result.ok ? null : input.result.error,
      sent_at: input.result.ok ? new Date().toISOString() : null,
    });
  } catch (error) {
    log.warn("No se pudo registrar el mensaje saliente", errorMeta(error));
  }
}

/**
 * Envía el mensaje de WhatsApp correspondiente a un evento de turno.
 * Nunca lanza: si WhatsApp no está configurado o falla, se registra y la app sigue.
 * Las notificaciones in-app las generan los triggers de la base de datos.
 */
export async function notifyAppointmentEvent(appointmentId: string, kind: AppointmentMessageKind, options?: { useApprovedTemplate?: boolean }): Promise<SendResult | null> {
  try {
    const env = getServerEnv();
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const admin = createAdminClient();
    const settings = await getSettings(admin, ["site.identity", "scheduling", "reminders", "whatsapp"] as const);
    if (!settings.whatsapp.enabled || !isWhatsAppConfigured()) return null;
    if (!settings.reminders.channels.includes("whatsapp")) return null;

    const { data: appointment } = await admin.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
    if (!appointment) return null;
    const { data: patient } = await admin.from("patients").select("*").eq("id", appointment.patient_id).maybeSingle();
    if (!patient) return null;
    const phone = patient.whatsapp_phone ?? patient.phone;
    if (!phone) return null;

    const { data: contact } = await admin.from("whatsapp_contacts").select("opted_out").eq("phone", phone).maybeSingle();
    if (contact?.opted_out) return null;

    const template = await getTemplate(admin, kind);
    if (!template) {
      log.warn("Plantilla no encontrada o inactiva", { kind });
      return null;
    }
    const vars = buildVars(appointment, patient, settings["site.identity"].professional_name, settings.scheduling.timezone);
    const body = renderTemplate(template.body, vars);
    const buttons = buttonsFor(kind, appointment.id);

    let result: SendResult;
    if (options?.useApprovedTemplate && template.wa_template_name) {
      result = await sendTemplate(phone, template.wa_template_name, template.wa_template_language ?? "es", templateParams(template, vars), buttons.map((b) => b.id));
    } else if (buttons.length > 0) {
      result = await sendInteractiveButtons(phone, body, buttons);
    } else {
      result = await sendText(phone, body);
    }

    await recordOutbound(admin, { patient, phone, appointmentId: appointment.id, kind, body, result });
    if (kind === "appointment_changed" && result.ok) {
      await admin.from("appointments").update({ change_notice_sent_at: new Date().toISOString() }).eq("id", appointment.id);
    }
    return result;
  } catch (error) {
    log.error("notifyAppointmentEvent falló", { kind, appointmentId, ...errorMeta(error) });
    return null;
  }
}
