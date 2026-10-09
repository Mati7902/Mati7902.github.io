"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils";
import { parseForm } from "@/lib/validation";
import { assignExerciseToPatient, assignMaterialToPatient, unassignMaterial } from "@/server/services/admin-materials";
import { saveAdminNote } from "@/server/services/admin-notes";
import { createPatient, invitePatient, setPatientAccess, updatePatient } from "@/server/services/admin-patients";
import { audit } from "@/server/services/audit";

const optional = (max: number) => z.string().trim().max(max).optional().default("");

const patientSchema = z.object({
  id: z.string().uuid().optional(),
  first_name: z.string().trim().min(1, "Ingresá el nombre.").max(80),
  last_name: z.string().trim().min(1, "Ingresá el apellido.").max(80),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Email inválido.")]).optional().default(""),
  phone: optional(30),
  birth_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")]).optional().default(""),
  emergency_contact_name: optional(120),
  emergency_contact_phone: optional(30),
  guardian_name: optional(120),
  modality: z.enum(["presencial", "virtual", "mixta"]).default("mixta"),
  status: z.enum(["active", "inactive", "waiting", "discharged"]).default("active"),
  admission_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(""),
  admin_notes: optional(2000),
  send_invite: z.coerce.boolean().optional().default(false),
});

export async function savePatientAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseForm(patientSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const d = parsed.data;
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) return validationFail({ phone: "Teléfono inválido." });
  const emergencyPhone = d.emergency_contact_phone ? normalizePhone(d.emergency_contact_phone) : null;
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const input = {
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email || null,
      phone,
      birth_date: d.birth_date || null,
      emergency_contact_name: d.emergency_contact_name || null,
      emergency_contact_phone: emergencyPhone,
      guardian_name: d.guardian_name || null,
      modality: d.modality,
      status: d.status,
      admission_date: d.admission_date || null,
    };
    const patient = d.id ? await updatePatient(supabase, d.id, input) : await createPatient(supabase, input, session.userId);
    await saveAdminNote(supabase, { kind: "patient", id: patient.id }, d.admin_notes, session.userId);
    await audit(supabase, d.id ? "patient.updated" : "patient.created", { type: "patient", id: patient.id });
    let inviteNote: string | undefined;
    if (d.send_invite && patient.email) {
      const result = await invitePatient(patient);
      await audit(supabase, "patient.invited", { type: "patient", id: patient.id }, { sent: result.sent });
      inviteNote = result.reason;
    }
    revalidatePath("/admin/pacientes");
    revalidatePath(`/admin/pacientes/${patient.id}`);
    return ok({ id: patient.id, ...(inviteNote ? { note: inviteNote } : {}) });
  } catch (error) {
    return fail(error);
  }
}

export async function invitePatientAction(patientId: string): Promise<ActionResult<{ message: string }>> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
    if (!patient) throw new AppError("NOT_FOUND", "Paciente no encontrado.");
    const result = await invitePatient(patient);
    await audit(supabase, "patient.invited", { type: "patient", id: patient.id }, { sent: result.sent });
    revalidatePath(`/admin/pacientes/${patientId}`);
    return ok({ message: result.reason ?? "Invitación enviada por email." });
  } catch (error) {
    return fail(error);
  }
}

export async function setPatientAccessAction(patientId: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
    if (!patient) throw new AppError("NOT_FOUND", "Paciente no encontrado.");
    await setPatientAccess(supabase, patient, active);
    await audit(supabase, active ? "patient.activated" : "patient.deactivated", { type: "patient", id: patientId });
    revalidatePath("/admin/pacientes");
    revalidatePath(`/admin/pacientes/${patientId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const assignMaterialSchema = z.object({ patient_id: z.string().uuid(), material_id: z.string().uuid(), note: z.string().trim().max(500).optional().default("") });

export async function assignMaterialAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(assignMaterialSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    await assignMaterialToPatient(supabase, { materialId: parsed.data.material_id, patientId: parsed.data.patient_id, note: parsed.data.note, assignedBy: session.userId });
    await audit(supabase, "material.assigned", { type: "material", id: parsed.data.material_id }, { patient_id: parsed.data.patient_id });
    revalidatePath(`/admin/pacientes/${parsed.data.patient_id}`);
    revalidatePath("/admin/materiales");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function unassignMaterialAction(materialId: string, patientId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await unassignMaterial(supabase, materialId, patientId);
    revalidatePath(`/admin/pacientes/${patientId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const assignExerciseSchema = z.object({ patient_id: z.string().uuid(), template_id: z.string().uuid(), note: z.string().trim().max(500).optional().default(""), due_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default("") });

export async function assignExerciseAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(assignExerciseSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    await assignExerciseToPatient(supabase, {
      templateId: parsed.data.template_id,
      patientId: parsed.data.patient_id,
      note: parsed.data.note,
      dueAt: parsed.data.due_at ? new Date(`${parsed.data.due_at}T23:59:59`) : null,
      assignedBy: session.userId,
    });
    await audit(supabase, "exercise.assigned", { type: "exercise_template", id: parsed.data.template_id }, { patient_id: parsed.data.patient_id });
    revalidatePath(`/admin/pacientes/${parsed.data.patient_id}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
