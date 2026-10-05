"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPatient, assertSession } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";
import { parseForm } from "@/lib/validation";
import { audit } from "@/server/services/audit";
import { updateOwnPatientRecord } from "@/server/services/patients";

const contactSchema = z.object({
  phone: z.string().trim().max(30).optional().default(""),
  emergency_contact_name: z.string().trim().max(120).optional().default(""),
  emergency_contact_phone: z.string().trim().max(30).optional().default(""),
});

export async function updateContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(contactSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return validationFail({ phone: "Ingresá un número válido (ej: 0981 123 456)." });
  const emergencyPhone = parsed.data.emergency_contact_phone ? normalizePhone(parsed.data.emergency_contact_phone) : null;
  if (parsed.data.emergency_contact_phone && !emergencyPhone) return validationFail({ emergency_contact_phone: "Ingresá un número válido." });
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    await updateOwnPatientRecord(supabase, patient.id, {
      phone,
      whatsapp_phone: phone,
      emergency_contact_name: parsed.data.emergency_contact_name || null,
      emergency_contact_phone: emergencyPhone,
    });
    await supabase.from("profiles").update({ phone }).eq("id", patient.profile_id ?? "");
    revalidatePath("/app/perfil");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function updateSharingAction(share: boolean): Promise<ActionResult> {
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    await updateOwnPatientRecord(supabase, patient.id, { share_records_with_professional: share });
    await audit(supabase, share ? "patient.sharing_enabled" : "patient.sharing_disabled", { type: "patient", id: patient.id });
    revalidatePath("/app/perfil");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Ingresá tu contraseña actual."),
    password: z.string().min(8, "Mínimo 8 caracteres.").max(128).refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Combiná letras y números."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(changePasswordSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  try {
    const session = await assertSession();
    const supabase = await createClient();
    if (!session.email) throw new AppError("VALIDATION", "Tu cuenta no tiene email asociado.");
    // Reautenticación: verificamos la contraseña actual antes de cambiarla.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: session.email, password: parsed.data.current });
    if (signInError) return validationFail({ current: "La contraseña actual no es correcta." });
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw new AppError("VALIDATION", /same password/i.test(error.message) ? "Elegí una contraseña distinta a la actual." : "No pudimos cambiar la contraseña.");
    await audit(supabase, "auth.password_changed", { type: "profile", id: session.userId });
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
