import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { Patient } from "@/types/domain";

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

export async function getPatientById(client: AnyClient, id: string): Promise<Patient | null> {
  const { data } = await client.from("patients").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getPatientByPhone(client: AdminSupabaseClient, phoneE164: string): Promise<Patient | null> {
  const { data } = await client
    .from("patients")
    .select("*")
    .or(`phone.eq.${phoneE164},whatsapp_phone.eq.${phoneE164}`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Campos que el propio paciente puede editar (el trigger de la base lo garantiza también). */
export async function updateOwnPatientRecord(
  client: ServerSupabaseClient,
  patientId: string,
  input: Partial<Pick<Patient, "phone" | "whatsapp_phone" | "emergency_contact_name" | "emergency_contact_phone" | "birth_date" | "share_records_with_professional">>,
): Promise<Patient> {
  const { data, error } = await client.from("patients").update(input).eq("id", patientId).select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos actualizar tus datos.");
  return data;
}
