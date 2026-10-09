"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError, fromDatabaseError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import { cancelAppointment, confirmAppointment, createAppointment, getAvailableSlots, rescheduleAppointment } from "@/server/services/appointments";
import { notifyAppointmentEvent, type AppointmentMessageKind } from "@/server/services/appointment-notifications";
import { saveAdminNote } from "@/server/services/admin-notes";
import { audit } from "@/server/services/audit";
import { syncAppointmentToGoogle } from "@/server/services/google-calendar/sync";
import type { SerializedAvailabilityDay } from "@/server/actions/appointments";

const sourceAdmin = "admin" as const;

/** Envía el aviso por WhatsApp y devuelve una advertencia legible si el envío falló (no bloquea la acción). */
async function notifyWithWarning(appointmentId: string, kind: AppointmentMessageKind): Promise<string | undefined> {
  const result = await notifyAppointmentEvent(appointmentId, kind);
  if (result && !result.ok) return `El cambio se guardó, pero no pudimos avisar por WhatsApp (${result.error}).`;
  return undefined;
}

function revalidateAgenda(patientId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/app");
  revalidatePath("/app/agenda");
  if (patientId) revalidatePath(`/admin/pacientes/${patientId}`);
}

export async function getAdminAvailabilityAction(input: { modality: "presencial" | "virtual"; fromDateKey?: string; excludeAppointmentId?: string }): Promise<ActionResult<{ days: SerializedAvailabilityDay[] }>> {
  const parsed = z.object({ modality: z.enum(["presencial", "virtual"]), fromDateKey: z.string().optional(), excludeAppointmentId: z.string().uuid().optional() }).safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const { days } = await getAvailableSlots({ ...parsed.data, days: 28 });
    return ok({ days: days.map((d) => ({ dateKey: d.dateKey, slots: d.slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: s.label })) })) });
  } catch (error) {
    return fail(error);
  }
}

const createSchema = z.object({
  patientId: z.string().uuid("Elegí un paciente."),
  start: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  modality: z.enum(["presencial", "virtual"]),
  status: z.enum(["pending", "confirmed"]).default("pending"),
  videoLink: z.string().trim().url("Enlace inválido.").optional().or(z.literal("")).nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  adminNotes: z.string().trim().max(1000).optional().nullable(),
  notify: z.boolean().default(true),
});

export async function adminCreateAppointmentAction(input: z.infer<typeof createSchema>): Promise<ActionResult<{ id: string; warning?: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const start = new Date(parsed.data.start);
    const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);
    const appointment = await createAppointment(supabase, {
      patientId: parsed.data.patientId,
      start,
      end,
      modality: parsed.data.modality,
      status: parsed.data.status,
      source: sourceAdmin,
      videoLink: parsed.data.videoLink || null,
      location: parsed.data.location || null,
      adminNotes: parsed.data.adminNotes || null,
    });
    const warning = parsed.data.notify ? await notifyWithWarning(appointment.id, "booking_registered") : undefined;
    await audit(supabase, "appointment.created_by_admin", { type: "appointment", id: appointment.id }, { status: appointment.status, whatsapp_failed: Boolean(warning) });
    await syncAppointmentToGoogle(appointment.id);
    revalidateAgenda(appointment.patient_id);
    return ok({ id: appointment.id, warning });
  } catch (error) {
    return fail(error);
  }
}

const updateSchema = z.object({
  appointmentId: z.string().uuid(),
  modality: z.enum(["presencial", "virtual"]).optional(),
  videoLink: z.string().trim().url("Enlace inválido.").optional().or(z.literal("")).nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  adminNotes: z.string().trim().max(1000).optional().nullable(),
});

export async function adminUpdateAppointmentDetailsAction(input: z.infer<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({
        ...(parsed.data.modality ? { modality: parsed.data.modality } : {}),
        video_link: parsed.data.videoLink || null,
        location: parsed.data.location || null,
        google_sync_status: "pending",
      })
      .eq("id", parsed.data.appointmentId)
      .select("id, patient_id")
      .single();
    if (error) throw fromDatabaseError(error);
    if (parsed.data.adminNotes !== undefined) {
      await saveAdminNote(supabase, { kind: "appointment", id: data.id }, parsed.data.adminNotes, session.userId);
    }
    await audit(supabase, "appointment.details_updated", { type: "appointment", id: data.id });
    await syncAppointmentToGoogle(data.id);
    revalidateAgenda(data.patient_id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const rescheduleSchema = z.object({ appointmentId: z.string().uuid(), start: z.string().datetime(), durationMinutes: z.number().int().min(15).max(240), reason: z.string().trim().max(300).optional().nullable(), notify: z.boolean().default(true) });

export async function adminRescheduleAppointmentAction(input: z.infer<typeof rescheduleSchema>): Promise<ActionResult<{ warning?: string }>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const start = new Date(parsed.data.start);
    const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);
    const updated = await rescheduleAppointment(supabase, { appointmentId: parsed.data.appointmentId, start, end, newStatus: "rescheduled", reason: parsed.data.reason ?? "Modificado por el profesional", source: sourceAdmin });
    const warning = parsed.data.notify ? await notifyWithWarning(updated.id, "appointment_changed") : undefined;
    await audit(supabase, "appointment.rescheduled_by_admin", { type: "appointment", id: updated.id }, { whatsapp_failed: Boolean(warning) });
    await syncAppointmentToGoogle(updated.id);
    revalidateAgenda(updated.patient_id);
    return ok({ warning });
  } catch (error) {
    return fail(error);
  }
}

const statusSchema = z.object({ appointmentId: z.string().uuid(), status: z.enum(["confirmed", "completed", "no_show", "pending"]), reason: z.string().trim().max(300).optional().nullable() });

export async function adminSetAppointmentStatusAction(input: z.infer<typeof statusSchema>): Promise<ActionResult<{ warning?: string }>> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: current } = await supabase.from("appointments").select("id, status, patient_id").eq("id", parsed.data.appointmentId).maybeSingle();
    if (!current) throw new AppError("NOT_FOUND", "Turno no encontrado.");
    const wasRequest = current.status === "requested";
    if (parsed.data.status === "confirmed") {
      await confirmAppointment(supabase, current.id, sourceAdmin);
    } else {
      const { error } = await supabase
        .from("appointments")
        .update({ status: parsed.data.status, completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null })
        .eq("id", current.id);
      if (error) throw fromDatabaseError(error);
    }
    const warning = wasRequest && parsed.data.status === "confirmed" ? await notifyWithWarning(current.id, "request_approved") : undefined;
    await audit(supabase, `appointment.status_${parsed.data.status}`, { type: "appointment", id: current.id }, { previous: current.status, whatsapp_failed: Boolean(warning) });
    await syncAppointmentToGoogle(current.id);
    revalidateAgenda(current.patient_id);
    return ok({ warning });
  } catch (error) {
    return fail(error);
  }
}

export async function adminCancelAppointmentAction(input: { appointmentId: string; reason?: string | null; notify?: boolean }): Promise<ActionResult<{ warning?: string }>> {
  const parsed = z.object({ appointmentId: z.string().uuid(), reason: z.string().trim().max(300).optional().nullable(), notify: z.boolean().default(true) }).safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const updated = await cancelAppointment(supabase, parsed.data.appointmentId, parsed.data.reason ?? null, sourceAdmin);
    const warning = parsed.data.notify ? await notifyWithWarning(updated.id, "cancellation_done") : undefined;
    await audit(supabase, "appointment.cancelled_by_admin", { type: "appointment", id: updated.id }, { whatsapp_failed: Boolean(warning) });
    await syncAppointmentToGoogle(updated.id);
    revalidateAgenda(updated.patient_id);
    return ok({ warning });
  } catch (error) {
    return fail(error);
  }
}
