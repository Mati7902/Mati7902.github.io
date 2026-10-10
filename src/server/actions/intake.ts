"use server";

import { revalidatePath } from "next/cache";

import { assertPatient } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { type ContactValue, type IntakeAnswers, parseIntakeAnswers } from "@/lib/intake/form";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";
import { audit } from "@/server/services/audit";
import { saveOwnIntake } from "@/server/services/intake";
import { updateOwnPatientRecord } from "@/server/services/patients";
import type { Patient } from "@/types/domain";

export type SaveIntakePayload = { answers: unknown; submit?: boolean };
export type SaveIntakeResult = { submittedAt: string | null; firstSubmittedAt: string | null; updatedAt: string };

/**
 * Datos personales de la ficha que también viven en la ficha administrativa: si el paciente los
 * completa o corrige, se actualizan ahí (la fecha de nacimiento decide qué cuadernillo ve).
 * Lo que deja en blanco no borra lo que ya estaba cargado.
 */
function patientUpdates(patient: Patient, answers: IntakeAnswers): Partial<Pick<Patient, "birth_date" | "phone" | "emergency_contact_name" | "emergency_contact_phone">> {
  const updates: Partial<Pick<Patient, "birth_date" | "phone" | "emergency_contact_name" | "emergency_contact_phone">> = {};
  const birth = typeof answers.fecha_nacimiento === "string" ? answers.fecha_nacimiento : null;
  if (birth && birth !== patient.birth_date?.slice(0, 10)) updates.birth_date = birth;
  const phone = typeof answers.telefono === "string" ? answers.telefono : null;
  if (phone && phone !== patient.phone) updates.phone = phone;
  const contact = answers.contacto_emergencia as ContactValue | undefined;
  if (contact?.nombre && contact.nombre !== patient.emergency_contact_name) updates.emergency_contact_name = contact.nombre;
  if (contact?.telefono && contact.telefono !== patient.emergency_contact_phone) updates.emergency_contact_phone = contact.telefono;
  return updates;
}

export async function saveIntakeAction(payload: SaveIntakePayload): Promise<ActionResult<SaveIntakeResult>> {
  const parsed = parseIntakeAnswers(payload?.answers);
  if (parsed.errors) return validationFail(parsed.errors);
  const answers = parsed.answers;

  // Los teléfonos se guardan normalizados (+595…), igual que en el perfil.
  const errors: Record<string, string> = {};
  if (typeof answers.telefono === "string") {
    const phone = normalizePhone(answers.telefono);
    if (phone) answers.telefono = phone;
    else errors.telefono = "Ingresá un número válido (ej: 0981 123 456).";
  }
  const contact = answers.contacto_emergencia as ContactValue | undefined;
  if (contact?.telefono) {
    const phone = normalizePhone(contact.telefono);
    if (phone) answers.contacto_emergencia = { ...contact, telefono: phone };
    else errors.contacto_emergencia = "Revisá el teléfono de la persona de referencia (ej: 0981 123 456).";
  }
  if (Object.keys(errors).length > 0) return validationFail(errors);

  const submit = payload?.submit === true;
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const intake = await saveOwnIntake(supabase, patient.id, answers, submit);

    const updates = patientUpdates(patient, answers);
    if (Object.keys(updates).length > 0) {
      await updateOwnPatientRecord(supabase, patient.id, updates);
      if (updates.phone && patient.profile_id) await supabase.from("profiles").update({ phone: updates.phone }).eq("id", patient.profile_id);
    }

    if (submit) {
      // Sin contenido: solo el hecho de que se envió.
      await audit(supabase, "patient.intake_submitted", { type: "patient", id: patient.id }, { form_version: intake.form_version });
    }
    revalidatePath("/app");
    revalidatePath("/app/ingreso");
    revalidatePath("/app/perfil");
    return ok({ submittedAt: intake.submitted_at, firstSubmittedAt: intake.first_submitted_at, updatedAt: intake.updated_at });
  } catch (error) {
    return fail(error);
  }
}
