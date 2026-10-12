"use server";

import { assertPatient } from "@/lib/auth/session";
import { signsAsMinor } from "@/lib/consent/treatment";
import { ageFrom } from "@/lib/exercises/collections";
import { isValidBirthDate } from "@/lib/intake/form";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";
import { getLatestConsent, signConsent } from "@/server/services/consent";
import { updateOwnPatientRecord } from "@/server/services/patients";
import { getIntake } from "@/server/services/intake";
import { getSetting } from "@/server/services/settings";

export type SignConsentPayload = {
  version: string;
  signedName: string;
  guardianName?: string;
  acceptTreatment: boolean;
  acceptCommitment: boolean;
  guardianAgrees?: boolean;
  /** Solo si la ficha no tiene fecha de nacimiento: hace falta para saber si firma como menor. */
  birthDate?: string;
};

/** Firma del consentimiento informado y del compromiso. Devuelve a dónde seguir. */
export async function signConsentAction(payload: SignConsentPayload): Promise<ActionResult<{ next: string }>> {
  const signedName = typeof payload?.signedName === "string" ? payload.signedName.trim() : "";
  const guardianName = typeof payload?.guardianName === "string" ? payload.guardianName.trim() : "";
  const errors: Record<string, string> = {};
  if (payload?.acceptTreatment !== true) errors.acceptTreatment = "Para firmar, confirmá que leíste el consentimiento y aceptás iniciar el tratamiento.";
  if (payload?.acceptCommitment !== true) errors.acceptCommitment = "Para firmar, confirmá el compromiso de asistir a las primeras sesiones.";
  if (signedName.length < 3 || signedName.length > 160) errors.signedName = "Escribí tu nombre completo (entre 3 y 160 caracteres).";

  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const settings = await getSetting(supabase, "treatment_consent");
    if (!settings.enabled) throw new AppError("FORBIDDEN", "El consentimiento informado no está habilitado.");
    if (payload?.version !== settings.version) {
      throw new AppError("CONFLICT", "El consentimiento se actualizó mientras lo leías. Recargá la página para ver la versión vigente.");
    }
    // Ya firmó esta versión (doble envío, «atrás»): no se agrega otra firma.
    const latest = await getLatestConsent(supabase, patient.id);
    const intakeNext = async () => ((await getIntake(supabase, patient.id).catch(() => null))?.submitted_at ? "/app" : "/app/ingreso");
    if (latest?.version === settings.version) return ok({ next: await intakeNext() });

    let birthDate = patient.birth_date;
    if (!birthDate) {
      const given = typeof payload?.birthDate === "string" ? payload.birthDate.trim() : "";
      if (!isValidBirthDate(given)) errors.birthDate = "Ingresá tu fecha de nacimiento (no puede ser futura).";
      else birthDate = given;
    }
    const minor = signsAsMinor(ageFrom(birthDate), patient.guardian_name);
    if (minor) {
      if (guardianName.length < 3 || guardianName.length > 160) errors.guardianName = "Escribí el nombre de tu madre, padre o tutor (entre 3 y 160 caracteres).";
      if (payload?.guardianAgrees !== true) errors.guardianAgrees = "Confirmá que tu madre, padre o tutor leyó el consentimiento y está de acuerdo.";
    }
    if (Object.keys(errors).length > 0) return validationFail(errors);

    // La fecha de nacimiento que faltaba queda en la ficha (la base la usa para saber si es menor).
    if (!patient.birth_date && birthDate) await updateOwnPatientRecord(supabase, patient.id, { birth_date: birthDate });
    const consent = await signConsent(supabase, { patientId: patient.id, version: settings.version, signedName, guardianName: minor ? guardianName : null });
    await audit(supabase, "patient.treatment_consent_signed", { type: "patient", id: patient.id }, { version: consent.version, is_minor: consent.is_minor });

    // Recién firmado, sigue la ficha de ingreso si todavía no la envió.
    return ok({ next: await intakeNext() });
  } catch (error) {
    return fail(error);
  }
}
