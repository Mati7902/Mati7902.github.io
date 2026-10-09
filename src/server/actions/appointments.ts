"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPatient } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import {
  assertSlotAvailable,
  cancelAppointment,
  canPatientModify,
  confirmAppointment,
  createAppointment,
  getAvailableSlots,
  initialStatusForPatientBooking,
  rescheduleAppointment,
  type AvailabilityDay,
} from "@/server/services/appointments";
import { audit } from "@/server/services/audit";
import { allowAttempt } from "@/server/services/rate-limit";
import { notifyAppointmentEvent } from "@/server/services/appointment-notifications";
import { getSetting } from "@/server/services/settings";

const modalitySchema = z.enum(["presencial", "virtual"]);

export type SerializedSlot = { start: string; end: string; label: string };
export type SerializedAvailabilityDay = { dateKey: string; slots: SerializedSlot[] };

function serialize(days: AvailabilityDay[]): SerializedAvailabilityDay[] {
  return days.map((d) => ({ dateKey: d.dateKey, slots: d.slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: s.label })) }));
}

export async function getAvailabilityAction(input: { modality: "presencial" | "virtual"; fromDateKey?: string; excludeAppointmentId?: string }): Promise<ActionResult<{ days: SerializedAvailabilityDay[]; bookingMode: "auto" | "approval" }>> {
  const parsed = z.object({ modality: modalitySchema, fromDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), excludeAppointmentId: z.string().uuid().optional() }).safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertPatient();
    const { days, settings } = await getAvailableSlots({ modality: parsed.data.modality, fromDateKey: parsed.data.fromDateKey, days: 21, excludeAppointmentId: parsed.data.excludeAppointmentId });
    return ok({ days: serialize(days), bookingMode: settings.booking_mode });
  } catch (error) {
    return fail(error);
  }
}

// `end` se acepta por compatibilidad pero se ignora: la duración la decide la grilla del servidor.
const requestSchema = z.object({
  modality: modalitySchema,
  start: z.string().datetime(),
  end: z.string().datetime().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  planSlug: z.string().trim().max(80).optional().nullable(),
});

export async function requestAppointmentAction(input: z.infer<typeof requestSchema>): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    if (!(await allowAttempt(`booking:${patient.id}`, 10, 3600))) {
      throw new AppError("RATE_LIMITED", "Hiciste muchas solicitudes seguidas. Esperá unos minutos.");
    }

    const start = new Date(parsed.data.start);
    const { settings, end } = await assertSlotAvailable(start, parsed.data.modality);
    const status = initialStatusForPatientBooking(settings);

    let planId: string | null = null;
    if (parsed.data.planSlug) {
      const { data: plan } = await supabase.from("therapy_plans").select("id").eq("slug", parsed.data.planSlug).eq("is_active", true).maybeSingle();
      planId = plan?.id ?? null;
    }

    const appointment = await createAppointment(supabase, {
      patientId: patient.id,
      start,
      end,
      modality: parsed.data.modality,
      status,
      source: "app",
      patientNote: parsed.data.note ?? null,
      planId,
    });
    await audit(supabase, "appointment.requested", { type: "appointment", id: appointment.id }, { status, modality: appointment.modality });
    await notifyAppointmentEvent(appointment.id, status === "confirmed" ? "booking_registered" : "booking_requested");
    revalidatePath("/app");
    revalidatePath("/app/agenda");
    return ok({ id: appointment.id, status });
  } catch (error) {
    return fail(error);
  }
}

const rescheduleSchema = z.object({ appointmentId: z.string().uuid(), start: z.string().datetime(), end: z.string().datetime().optional(), reason: z.string().trim().max(300).optional().nullable() });

export async function rescheduleAppointmentAction(input: z.infer<typeof rescheduleSchema>): Promise<ActionResult<{ status: string }>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const { data: current } = await supabase.from("appointments").select("*").eq("id", parsed.data.appointmentId).eq("patient_id", patient.id).maybeSingle();
    if (!current) throw new AppError("NOT_FOUND", "No encontramos ese turno.");
    const scheduling = await getSetting(supabase, "scheduling");
    if (!canPatientModify(current, scheduling, "reschedule")) {
      throw new AppError("FORBIDDEN", "Este turno ya no puede reprogramarse desde la aplicación. Escribinos para coordinar.");
    }
    if (!(await allowAttempt(`booking:${patient.id}`, 10, 3600))) {
      throw new AppError("RATE_LIMITED", "Hiciste muchos cambios seguidos. Esperá unos minutos.");
    }
    const start = new Date(parsed.data.start);
    const { settings, end } = await assertSlotAvailable(start, current.modality, current.id);
    const newStatus = settings.booking_mode === "auto" ? "confirmed" : "requested";
    const updated = await rescheduleAppointment(supabase, { appointmentId: current.id, start, end, newStatus, reason: parsed.data.reason ?? "Reprogramado por el paciente", source: "app" });
    await audit(supabase, "appointment.rescheduled_by_patient", { type: "appointment", id: updated.id });
    await notifyAppointmentEvent(updated.id, newStatus === "confirmed" ? "booking_registered" : "booking_requested");
    revalidatePath("/app");
    revalidatePath("/app/agenda");
    return ok({ status: updated.status });
  } catch (error) {
    return fail(error);
  }
}

export async function cancelAppointmentAction(input: { appointmentId: string; reason?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ appointmentId: z.string().uuid(), reason: z.string().trim().max(300).optional().nullable() }).safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertPatient();
    const supabase = await createClient();
    const updated = await cancelAppointment(supabase, parsed.data.appointmentId, parsed.data.reason ?? null, "app");
    await audit(supabase, "appointment.cancelled_by_patient", { type: "appointment", id: updated.id });
    revalidatePath("/app");
    revalidatePath("/app/agenda");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function confirmAttendanceAction(appointmentId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(appointmentId).success) return fail(new Error("id inválido"));
  try {
    await assertPatient();
    const supabase = await createClient();
    const updated = await confirmAppointment(supabase, appointmentId, "app");
    await audit(supabase, "appointment.confirmed_by_patient", { type: "appointment", id: updated.id });
    revalidatePath("/app");
    revalidatePath("/app/agenda");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
