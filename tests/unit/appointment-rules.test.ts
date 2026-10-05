import { describe, expect, it } from "vitest";

import { canPatientModify, canPrepareSession, initialStatusForPatientBooking } from "@/server/services/appointments";
import { schedulingSchema } from "@/server/services/settings";
import type { Appointment } from "@/types/domain";

const now = new Date("2026-10-12T15:00:00Z");
const settings = schedulingSchema.parse({ cancel_min_hours: 12, reschedule_min_hours: 24, session_prep_hours_before: 24 });

function appointment(hoursFromNow: number, status: Appointment["status"] = "confirmed"): Appointment {
  const start = new Date(now.getTime() + hoursFromNow * 3600_000);
  return {
    id: "a1",
    patient_id: "p1",
    plan_id: null,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 3600_000).toISOString(),
    modality: "virtual",
    status,
    source: "app",
    video_link: null,
    location: null,
    patient_note: null,
    confirmed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    completed_at: null,
    reminder_24h_sent_at: null,
    reminder_2h_sent_at: null,
    change_notice_sent_at: null,
    google_event_id: null,
    google_sync_status: "pending",
    google_synced_at: null,
    created_by: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

describe("reglas de agenda para el paciente", () => {
  it("permite cancelar y reprogramar solo con la anticipación configurada", () => {
    expect(canPatientModify(appointment(48), settings, "cancel", now)).toBe(true);
    expect(canPatientModify(appointment(10), settings, "cancel", now)).toBe(false);
    expect(canPatientModify(appointment(30), settings, "reschedule", now)).toBe(true);
    expect(canPatientModify(appointment(20), settings, "reschedule", now)).toBe(false);
  });

  it("respeta los interruptores globales y los estados finales", () => {
    const locked = { ...settings, allow_patient_cancel: false, allow_patient_reschedule: false };
    expect(canPatientModify(appointment(48), locked, "cancel", now)).toBe(false);
    expect(canPatientModify(appointment(48), locked, "reschedule", now)).toBe(false);
    expect(canPatientModify(appointment(48, "cancelled"), settings, "cancel", now)).toBe(false);
    expect(canPatientModify(appointment(48, "completed"), settings, "reschedule", now)).toBe(false);
  });

  it("habilita la preparación de sesión dentro de la ventana previa", () => {
    expect(canPrepareSession(appointment(20), settings, now)).toBe(true);
    expect(canPrepareSession(appointment(30), settings, now)).toBe(false);
    expect(canPrepareSession(appointment(-1), settings, now)).toBe(false);
    expect(canPrepareSession(appointment(20), { ...settings, session_prep_enabled: false }, now)).toBe(false);
    expect(canPrepareSession(appointment(20, "cancelled"), settings, now)).toBe(false);
  });

  it("decide el estado inicial según el modo de reserva", () => {
    expect(initialStatusForPatientBooking({ ...settings, booking_mode: "auto" })).toBe("confirmed");
    expect(initialStatusForPatientBooking({ ...settings, booking_mode: "approval" })).toBe("requested");
  });
});
