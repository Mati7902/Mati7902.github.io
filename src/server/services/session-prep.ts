import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { SessionPreparation } from "@/types/domain";

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

export type SessionPrepInput = {
  weekRating: number | null;
  hardest?: string | null;
  better?: string | null;
  topics?: string | null;
  practiced?: string | null;
  important?: string | null;
};

export async function getSessionPreparation(client: AnyClient, appointmentId: string): Promise<SessionPreparation | null> {
  const { data } = await client.from("session_preparations").select("*").eq("appointment_id", appointmentId).maybeSingle();
  return data ?? null;
}

export async function upsertSessionPreparation(client: ServerSupabaseClient, patientId: string, appointmentId: string, input: SessionPrepInput, submit: boolean) {
  const payload = {
    appointment_id: appointmentId,
    patient_id: patientId,
    week_rating: input.weekRating,
    hardest: input.hardest ?? null,
    better: input.better ?? null,
    topics: input.topics ?? null,
    practiced: input.practiced ?? null,
    important: input.important ?? null,
    submitted_at: submit ? new Date().toISOString() : null,
  };
  const { data, error } = await client
    .from("session_preparations")
    .upsert(payload, { onConflict: "appointment_id" })
    .select("*")
    .single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar tus respuestas.");
  return data;
}
