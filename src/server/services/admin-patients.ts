import "server-only";

import { AppError, fromDatabaseError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Patient, TablesUpdate } from "@/types/domain";

const log = createLogger("admin-patients");

export type PatientListItem = Patient & { next_appointment?: string | null; profile_active?: boolean | null };

export async function listPatients(client: ServerSupabaseClient, options: { query?: string; status?: Patient["status"] | "all" } = {}): Promise<PatientListItem[]> {
  let q = client.from("patients").select("*, profiles!patients_profile_id_fkey(is_active)").order("last_name").order("first_name");
  if (options.status && options.status !== "all") q = q.eq("status", options.status);
  if (options.query) {
    const term = options.query.trim().replace(/[%,()]/g, "");
    if (term) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw fromDatabaseError(error);
  const patients = (data ?? []) as (Patient & { profiles: { is_active: boolean } | null })[];
  const ids = patients.map((p) => p.id);
  const { data: upcoming } = ids.length
    ? await client
        .from("appointments")
        .select("patient_id, start_time")
        .in("patient_id", ids)
        .in("status", ["pending", "confirmed", "rescheduled", "requested"])
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
    : { data: [] as { patient_id: string; start_time: string }[] };
  const nextByPatient = new Map<string, string>();
  for (const row of upcoming ?? []) if (!nextByPatient.has(row.patient_id)) nextByPatient.set(row.patient_id, row.start_time);
  return patients.map(({ profiles, ...p }) => ({ ...p, profile_active: profiles?.is_active ?? null, next_appointment: nextByPatient.get(p.id) ?? null }));
}

export type PatientInput = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  guardian_name?: string | null;
  modality: Patient["modality"];
  status: Patient["status"];
  admission_date?: string | null;
  admin_notes?: string | null;
};

export async function createPatient(client: ServerSupabaseClient, input: PatientInput, createdBy: string): Promise<Patient> {
  const { data, error } = await client
    .from("patients")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email?.toLowerCase() || null,
      phone: input.phone || null,
      whatsapp_phone: input.phone || null,
      birth_date: input.birth_date || null,
      emergency_contact_name: input.emergency_contact_name || null,
      emergency_contact_phone: input.emergency_contact_phone || null,
      guardian_name: input.guardian_name || null,
      modality: input.modality,
      status: input.status,
      admission_date: input.admission_date || new Date().toISOString().slice(0, 10),
      admin_notes: input.admin_notes || null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw fromDatabaseError(error, "No pudimos crear el paciente.");
  return data;
}

export async function updatePatient(client: ServerSupabaseClient, id: string, input: Partial<PatientInput>): Promise<Patient> {
  const payload: TablesUpdate<"patients"> = {
    first_name: input.first_name,
    last_name: input.last_name,
    birth_date: input.birth_date === undefined ? undefined : input.birth_date || null,
    emergency_contact_name: input.emergency_contact_name === undefined ? undefined : input.emergency_contact_name || null,
    emergency_contact_phone: input.emergency_contact_phone === undefined ? undefined : input.emergency_contact_phone || null,
    guardian_name: input.guardian_name === undefined ? undefined : input.guardian_name || null,
    modality: input.modality,
    status: input.status,
    admission_date: input.admission_date || undefined,
    admin_notes: input.admin_notes === undefined ? undefined : input.admin_notes || null,
  };
  if (input.email !== undefined) payload.email = input.email?.toLowerCase() || null;
  if (input.phone !== undefined) {
    payload.phone = input.phone || null;
    payload.whatsapp_phone = input.phone || null;
  }
  const { data, error } = await client.from("patients").update(payload).eq("id", id).select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos actualizar el paciente.");
  return data;
}

/**
 * Invita al paciente por email usando Supabase Auth (service role). El trigger de la base
 * vincula el perfil con la ficha por coincidencia de email verificado.
 */
export async function invitePatient(patient: Patient): Promise<{ sent: boolean; reason?: string }> {
  const env = getServerEnv();
  if (!patient.email) throw new AppError("VALIDATION", "El paciente no tiene email cargado.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new AppError("NOT_CONFIGURED", "Falta SUPABASE_SERVICE_ROLE_KEY para enviar invitaciones.");
  const admin = createAdminClient();
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/bienvenida`;

  const { error } = await admin.auth.admin.inviteUserByEmail(patient.email, {
    redirectTo,
    data: { first_name: patient.first_name, last_name: patient.last_name },
  });

  if (error) {
    // Usuario ya registrado: reenviamos un enlace de acceso (magic link) en lugar de fallar.
    if (/already|registered|exists/i.test(error.message)) {
      const { error: otpError } = await admin.auth.signInWithOtp({ email: patient.email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (otpError) {
        log.warn("No se pudo reenviar acceso", errorMeta(otpError));
        return { sent: false, reason: "El usuario ya existe y no pudimos reenviar el acceso." };
      }
      await admin.from("patients").update({ invited_at: new Date().toISOString() }).eq("id", patient.id);
      return { sent: true, reason: "El usuario ya existía: se envió un enlace de acceso." };
    }
    log.warn("inviteUserByEmail falló", errorMeta(error));
    throw new AppError("EXTERNAL", `No pudimos enviar la invitación: ${error.message}`);
  }

  await admin.from("patients").update({ invited_at: new Date().toISOString() }).eq("id", patient.id);
  return { sent: true };
}

/** Desactiva (o reactiva) el acceso del paciente sin borrar datos. */
export async function setPatientAccess(client: ServerSupabaseClient, patient: Patient, active: boolean) {
  const { error } = await client.from("patients").update({ status: active ? "active" : "inactive" }).eq("id", patient.id);
  if (error) throw fromDatabaseError(error);
  if (patient.profile_id) {
    const { error: profileError } = await client.from("profiles").update({ is_active: active }).eq("id", patient.profile_id);
    if (profileError) throw fromDatabaseError(profileError);
  }
}

export async function getPatientOverview(client: ServerSupabaseClient, id: string) {
  const [{ data: patient }, { data: appointments }, { data: materials }, { data: assignments }, { data: profile }] = await Promise.all([
    client.from("patients").select("*").eq("id", id).maybeSingle(),
    client.from("appointments").select("*").eq("patient_id", id).order("start_time", { ascending: false }).limit(30),
    client.from("patient_materials").select("*, materials(id, title, type)").eq("patient_id", id).not("assigned_by", "is", null).order("assigned_at", { ascending: false }),
    client.from("exercise_assignments").select("*, exercise_templates(id, title, slug)").eq("patient_id", id).order("assigned_at", { ascending: false }),
    client.from("profiles").select("id, is_active, last_seen_at, email").eq("id", (await client.from("patients").select("profile_id").eq("id", id).maybeSingle()).data?.profile_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
  ]);
  if (!patient) return null;
  return { patient, appointments: appointments ?? [], materials: materials ?? [], assignments: assignments ?? [], profile: profile ?? null };
}
