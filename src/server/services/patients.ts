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
 * Identifica al paciente que escribe por WhatsApp. El número de WhatsApp de una ficha es
 * `whatsapp_phone` o, si está vacío, `phone`. Si el número corresponde a más de una ficha (por
 * ejemplo, el WhatsApp de una hija y el teléfono de su madre), NO se identifica a nadie: es
 * preferible pedir ayuda humana antes que actuar sobre los turnos de otra persona.
 */
export async function getPatientByPhone(client: AdminSupabaseClient, phoneE164: string): Promise<Patient | null> {
  if (!/^\+\d{8,15}$/.test(phoneE164)) return null;
  const { data } = await client
    .from("patients")
    .select("*")
    .or(`whatsapp_phone.eq.${phoneE164},and(phone.eq.${phoneE164},whatsapp_phone.is.null)`)
    .neq("status", "discharged")
    .limit(2);
  return data && data.length === 1 ? (data[0] ?? null) : null;
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
