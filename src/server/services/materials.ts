import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { Material, MaterialCategory, PatientMaterial } from "@/types/domain";

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

export type MaterialWithMeta = Material & {
  material_categories: Pick<MaterialCategory, "id" | "slug" | "name"> | null;
  exercise_templates: { slug: string; title: string } | null;
};

export type PatientMaterialView = MaterialWithMeta & {
  assignment: Pick<PatientMaterial, "id" | "assigned_at" | "viewed_at" | "completed_at" | "note" | "assigned_by"> | null;
  recommended: boolean;
};

export async function listCategories(client: AnyClient): Promise<MaterialCategory[]> {
  const { data } = await client.from("material_categories").select("*").order("sort_order");
  return data ?? [];
}

/** Biblioteca del paciente: materiales públicos + asignados, con estado de visto/completado. */
export async function getPatientMaterials(client: ServerSupabaseClient, patientId: string): Promise<PatientMaterialView[]> {
  const [{ data: materials, error }, { data: assignments }] = await Promise.all([
    client
      .from("materials")
      .select("*, material_categories(id, slug, name), exercise_templates(slug, title)")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    client.from("patient_materials").select("id, material_id, assigned_at, viewed_at, completed_at, note, assigned_by").eq("patient_id", patientId),
  ]);
  if (error) throw fromDatabaseError(error);
  const byMaterial = new Map((assignments ?? []).map((a) => [a.material_id, a]));
  return ((materials ?? []) as MaterialWithMeta[]).map((m) => {
    const a = byMaterial.get(m.id) ?? null;
    return { ...m, assignment: a, recommended: Boolean(a?.assigned_by) };
  });
}

export async function getPatientMaterial(client: ServerSupabaseClient, patientId: string, materialId: string): Promise<PatientMaterialView | null> {
  const { data: material } = await client
    .from("materials")
    .select("*, material_categories(id, slug, name), exercise_templates(slug, title)")
    .eq("id", materialId)
    .maybeSingle();
  if (!material) return null;
  const { data: assignment } = await client
    .from("patient_materials")
    .select("id, assigned_at, viewed_at, completed_at, note, assigned_by")
    .eq("patient_id", patientId)
    .eq("material_id", materialId)
    .maybeSingle();
  return { ...(material as MaterialWithMeta), assignment: assignment ?? null, recommended: Boolean(assignment?.assigned_by) };
}

/** Registra "visto" (y opcionalmente "completado") sin métricas invasivas. */
export async function markMaterialProgress(client: ServerSupabaseClient, patientId: string, materialId: string, completed: boolean) {
  const now = new Date().toISOString();
  const { data: existing } = await client
    .from("patient_materials")
    .select("id, viewed_at, completed_at")
    .eq("patient_id", patientId)
    .eq("material_id", materialId)
    .maybeSingle();
  if (existing) {
    const { error } = await client
      .from("patient_materials")
      .update({ viewed_at: existing.viewed_at ?? now, completed_at: completed ? (existing.completed_at ?? now) : existing.completed_at })
      .eq("id", existing.id);
    if (error) throw fromDatabaseError(error);
  } else {
    const { error } = await client.from("patient_materials").insert({
      patient_id: patientId,
      material_id: materialId,
      viewed_at: now,
      completed_at: completed ? now : null,
    });
    if (error && error.code !== "23505") throw fromDatabaseError(error);
  }
}

/** URL firmada de corta duración para archivos del bucket privado (respeta RLS de storage). */
export async function getMaterialSignedUrl(client: ServerSupabaseClient, storagePath: string, expiresInSeconds = 60 * 15): Promise<string | null> {
  const { data, error } = await client.storage.from("materials").createSignedUrl(storagePath, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export const MATERIAL_TYPE_LABEL: Record<Material["type"], string> = {
  pdf: "PDF",
  image: "Imagen",
  audio: "Audio",
  video: "Video",
  link: "Enlace",
  exercise: "Ejercicio",
};
