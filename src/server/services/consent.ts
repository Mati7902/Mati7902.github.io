import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import { type ConsentParams, renderConsent } from "@/lib/consent/treatment";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { TreatmentConsent } from "@/types/domain";

/**
 * Firmas del consentimiento informado (treatment_consents). Con el cliente del paciente, RLS
 * limita todo a las propias; el profesional las lee todas.
 */
export async function listConsents(client: ServerSupabaseClient, patientId: string): Promise<TreatmentConsent[]> {
  const { data, error } = await client.from("treatment_consents").select("*").eq("patient_id", patientId).order("accepted_at", { ascending: false });
  if (error) throw fromDatabaseError(error, "No pudimos cargar el consentimiento informado.");
  return data ?? [];
}

export async function getLatestConsent(client: ServerSupabaseClient, patientId: string): Promise<TreatmentConsent | null> {
  const { data, error } = await client
    .from("treatment_consents")
    .select("*")
    .eq("patient_id", patientId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw fromDatabaseError(error, "No pudimos cargar el consentimiento informado.");
  return data ?? null;
}

/** Texto firmado, tal como quedó al firmar (plantilla + datos del consultorio de ese momento). */
export function signedConsentText(consent: Pick<TreatmentConsent, "body_template" | "params">): string {
  const params = consent.params && typeof consent.params === "object" && !Array.isArray(consent.params) ? (consent.params as Partial<ConsentParams>) : {};
  return renderConsent(consent.body_template, params);
}

/** Sesiones realizadas desde la firma (para seguir el compromiso de las primeras sesiones). */
export async function sessionsSince(client: ServerSupabaseClient, patientId: string, since: string): Promise<number> {
  const { count } = await client
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .gte("start_time", since);
  return count ?? 0;
}

/**
 * Firma el consentimiento. La base completa el documento (texto vigente, datos del consultorio,
 * fecha y si es menor) y rechaza la firma si la versión leída ya no es la vigente.
 */
export async function signConsent(client: ServerSupabaseClient, input: { patientId: string; version: string; signedName: string; guardianName: string | null }) {
  const { data, error } = await client
    .from("treatment_consents")
    .insert({ patient_id: input.patientId, version: input.version, signed_name: input.signedName, guardian_name: input.guardianName })
    .select("*")
    .single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar tu firma. Intentá de nuevo.");
  return data;
}
