"use server";

import { assertPatient } from "@/lib/auth/session";
import { ageFrom } from "@/lib/exercises/collections";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";
import { signConsent } from "@/server/services/consent";
import { getIntake } from "@/server/services/intake";
import { getSetting } from "@/server/services/settings";

export type SignConsentPayload = {
  version: string;
  signedName: string;
  guardianName?: string;
  acceptTreatment: boolean;
  acceptCommitment: boolean;
  guardianAgrees?: boolean;
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
    const age = ageFrom(patient.birth_date);
    const minor = age !== null && age < 18;
    if (minor) {
      if (guardianName.length < 3 || guardianName.length > 160) errors.guardianName = "Escribí el nombre de tu madre, padre o tutor (entre 3 y 160 caracteres).";
      if (payload?.guardianAgrees !== true) errors.guardianAgrees = "Confirmá que tu madre, padre o tutor leyó el consentimiento y está de acuerdo.";
    }
    if (Object.keys(errors).length > 0) return validationFail(errors);

    const consent = await signConsent(supabase, { patientId: patient.id, version: settings.version, signedName, guardianName: minor ? guardianName : null });
    await audit(supabase, "patient.treatment_consent_signed", { type: "patient", id: patient.id }, { version: consent.version, is_minor: consent.is_minor });

    // Recién firmado, sigue la ficha de ingreso si todavía no la envió.
    const intake = await getIntake(supabase, patient.id).catch(() => null);
    return ok({ next: intake?.submitted_at ? "/app" : "/app/ingreso" });
  } catch (error) {
    return fail(error);
  }
}
