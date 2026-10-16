import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import { commitmentStart, type ConsentParams, renderConsent } from "@/lib/consent/treatment";
import { zonedToUtc } from "@/lib/dates";
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

export async function getFirstConsent(client: ServerSupabaseClient, patientId: string): Promise<Pick<TreatmentConsent, "accepted_at"> | null> {
  const { data } = await client.from("treatment_consents").select("accepted_at").eq("patient_id", patientId).order("accepted_at", { ascending: true }).limit(1).maybeSingle();
  return data ?? null;
}

/**
 * Avance del compromiso: sesiones marcadas como completadas desde el comienzo del tratamiento
 * (fecha de ingreso o primera firma, lo que sea antes), con la meta de la firma vigente.
 */
export async function commitmentProgress(
  client: ServerSupabaseClient,
  patient: { id: string; admission_date: string | null },
  latest: Pick<TreatmentConsent, "sessions">,
  timezone?: string,
): Promise<{ done: number; target: number }> {
  const first = await getFirstConsent(client, patient.id);
  const admission = patient.admission_date ? zonedToUtc(patient.admission_date.slice(0, 10), "00:00", timezone).toISOString() : null;
  const since = commitmentStart(admission, first?.accepted_at ?? new Date().toISOString());
  const { count } = await client
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patient.id)
    .eq("status", "completed")
    .gte("start_time", since);
  return { done: count ?? 0, target: latest.sessions };
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
