import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { ExerciseAssignment, ExerciseResponse, ExerciseTemplate } from "@/types/domain";

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

export async function listExerciseTemplates(client: AnyClient, includeInactive = false): Promise<ExerciseTemplate[]> {
  let query = client.from("exercise_templates").select("*").order("sort_order").order("title");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export async function getExerciseTemplateBySlug(client: AnyClient, slug: string): Promise<ExerciseTemplate | null> {
  const { data } = await client.from("exercise_templates").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

export type AssignmentWithTemplate = ExerciseAssignment & { exercise_templates: ExerciseTemplate | null };

export async function listPatientAssignments(client: AnyClient, patientId: string): Promise<AssignmentWithTemplate[]> {
  const { data } = await client
    .from("exercise_assignments")
    .select("*, exercise_templates(*)")
    .eq("patient_id", patientId)
    .order("assigned_at", { ascending: false });
  return (data ?? []) as AssignmentWithTemplate[];
}

export async function listPatientResponses(client: AnyClient, patientId: string, limit = 50): Promise<(ExerciseResponse & { exercise_templates: Pick<ExerciseTemplate, "title" | "slug" | "kind"> | null })[]> {
  const { data } = await client
    .from("exercise_responses")
    .select("*, exercise_templates(title, slug, kind)")
    .eq("patient_id", patientId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as (ExerciseResponse & { exercise_templates: Pick<ExerciseTemplate, "title" | "slug" | "kind"> | null })[];
}

export async function saveExerciseResponse(
  client: ServerSupabaseClient,
  input: {
    patientId: string;
    templateId: string;
    assignmentId?: string | null;
    answers: Record<string, unknown>;
    emotionBefore?: number | null;
    emotionAfter?: number | null;
    durationSeconds?: number | null;
  },
): Promise<ExerciseResponse> {
  const { data, error } = await client
    .from("exercise_responses")
    .insert({
      patient_id: input.patientId,
      template_id: input.templateId,
      assignment_id: input.assignmentId ?? null,
      answers: input.answers as never,
      emotion_before: input.emotionBefore ?? null,
      emotion_after: input.emotionAfter ?? null,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select("*")
    .single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar el ejercicio.");

  if (input.assignmentId) {
    await client
      .from("exercise_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", input.assignmentId)
      .eq("patient_id", input.patientId)
      .is("completed_at", null);
  } else {
    // Si hay una asignación pendiente del mismo ejercicio, la damos por completada.
    const { data: pending } = await client
      .from("exercise_assignments")
      .select("id")
      .eq("patient_id", input.patientId)
      .eq("template_id", input.templateId)
      .is("completed_at", null)
      .order("assigned_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pending) {
      await client.from("exercise_assignments").update({ completed_at: new Date().toISOString() }).eq("id", pending.id);
    }
  }
  return data;
}

/** Resumen neutral de la semana ("Completaste 3 ejercicios esta semana"). */
export async function weeklyExerciseCount(client: AnyClient, patientId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { count } = await client
    .from("exercise_responses")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .gte("completed_at", since.toISOString());
  return count ?? 0;
}
