"use server";

import { assertPatient } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { type ContactValue, parseIntakeAnswers } from "@/lib/intake/form";
import { patientUpdates } from "@/lib/intake/sync";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";
import { audit } from "@/server/services/audit";
import { getIntake, intakeAnswersOf, saveOwnIntake } from "@/server/services/intake";
import { updateOwnPatientRecord } from "@/server/services/patients";

export type SaveIntakePayload = { answers: unknown; submit?: boolean };
export type SaveIntakeResult = { submittedAt: string | null; firstSubmittedAt: string | null; updatedAt: string };

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
    const previous = await getIntake(supabase, patient.id);
    const intake = await saveOwnIntake(supabase, patient.id, answers, submit);

    const updates = patientUpdates(patient, answers, previous ? intakeAnswersOf(previous) : null);
    if (Object.keys(updates).length > 0) {
      await updateOwnPatientRecord(supabase, patient.id, updates);
      if (updates.phone && patient.profile_id) await supabase.from("profiles").update({ phone: updates.phone }).eq("id", patient.profile_id);
    }

    if (submit) {
      // Sin contenido: solo el hecho de que se envió.
      await audit(supabase, "patient.intake_submitted", { type: "patient", id: patient.id }, { form_version: intake.form_version });
    }
    // Sin revalidatePath: refrescaría la página abierta en medio del formulario (y al enviar la
    // cambiaría por la vista de la ficha). Las páginas son dinámicas y el formulario navega solo.
    return ok({ submittedAt: intake.submitted_at, firstSubmittedAt: intake.first_submitted_at, updatedAt: intake.updated_at });
  } catch (error) {
    return fail(error);
  }
}
