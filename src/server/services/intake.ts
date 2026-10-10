import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import { INTAKE_FORM_VERSION, type IntakeAnswers } from "@/lib/intake/form";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { PatientIntake } from "@/types/domain";

/**
 * Ficha de ingreso (patient_intakes). Con el cliente del paciente, RLS limita todo a la propia;
 * con el del profesional, solo se leen las ya enviadas (los borradores son privados).
 */
export async function getIntake(client: ServerSupabaseClient, patientId: string): Promise<PatientIntake | null> {
  const { data, error } = await client.from("patient_intakes").select("*").eq("patient_id", patientId).maybeSingle();
  if (error) throw fromDatabaseError(error, "No pudimos cargar la ficha de ingreso.");
  return data ?? null;
}

/** Solo el estado (fechas de envío), sin las respuestas: para pantallas que no muestran el contenido. */
export async function getIntakeStatus(client: ServerSupabaseClient, patientId: string): Promise<Pick<PatientIntake, "submitted_at" | "first_submitted_at"> | null> {
  const { data, error } = await client.from("patient_intakes").select("submitted_at, first_submitted_at").eq("patient_id", patientId).maybeSingle();
  if (error) throw fromDatabaseError(error, "No pudimos cargar la ficha de ingreso.");
  return data ?? null;
}

export function intakeAnswersOf(intake: Pick<PatientIntake, "answers"> | null): IntakeAnswers {
  const raw = intake?.answers;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as IntakeAnswers) : {};
}

/**
 * Guarda las respuestas del paciente. Con `submit`, además la envía al profesional (la base pone
 * la fecha de envío y le avisa). Sin `submit` no toca el estado: un borrador sigue privado y una
 * ficha ya enviada se actualiza en el lugar.
 */
export async function saveOwnIntake(client: ServerSupabaseClient, patientId: string, answers: IntakeAnswers, submit: boolean): Promise<PatientIntake> {
  const payload = {
    patient_id: patientId,
    form_version: INTAKE_FORM_VERSION,
    answers: answers as never,
    ...(submit ? { submitted_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await client.from("patient_intakes").upsert(payload, { onConflict: "patient_id" }).select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar tu ficha de ingreso.");
  return data;
}
