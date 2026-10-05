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

/**
 * Identifica al paciente que escribe por WhatsApp. Prioriza `whatsapp_phone` (lo define el
 * profesional) y solo usa `phone` para fichas sin número de WhatsApp cargado. Si el número
 * coincide con más de una ficha, NO se identifica a nadie: es preferible pedir ayuda humana
 * antes que actuar sobre los turnos de otra persona.
 */
export async function getPatientByPhone(client: AdminSupabaseClient, phoneE164: string): Promise<Patient | null> {
  if (!/^\+\d{8,15}$/.test(phoneE164)) return null;
  const { data: byWhatsApp } = await client.from("patients").select("*").eq("whatsapp_phone", phoneE164).neq("status", "discharged").limit(2);
  if (byWhatsApp && byWhatsApp.length === 1) return byWhatsApp[0] ?? null;
  if (byWhatsApp && byWhatsApp.length > 1) return null;
  const { data: byPhone } = await client.from("patients").select("*").eq("phone", phoneE164).is("whatsapp_phone", null).neq("status", "discharged").limit(2);
  return byPhone && byPhone.length === 1 ? (byPhone[0] ?? null) : null;
}

/** Campos que el propio paciente puede editar (el trigger de la base lo garantiza también). */
export async function updateOwnPatientRecord(
  client: ServerSupabaseClient,
  patientId: string,
  input: Partial<Pick<Patient, "phone" | "emergency_contact_name" | "emergency_contact_phone" | "birth_date" | "share_records_with_professional">>,
): Promise<Patient> {
  const { data, error } = await client.from("patients").update(input).eq("id", patientId).select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos actualizar tus datos.");
  return data;
}
