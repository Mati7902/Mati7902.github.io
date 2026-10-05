import "server-only";

import { AppError, fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Material } from "@/types/domain";

export type MaterialAdminRow = Material & {
  material_categories: { id: string; name: string } | null;
  exercise_templates: { id: string; title: string } | null;
  assigned_count?: number;
};

export async function listMaterialsAdmin(client: ServerSupabaseClient): Promise<MaterialAdminRow[]> {
  const { data, error } = await client
    .from("materials")
    .select("*, material_categories(id, name), exercise_templates(id, title)")
    .order("created_at", { ascending: false });
  if (error) throw fromDatabaseError(error);
  const rows = (data ?? []) as MaterialAdminRow[];
  const { data: counts } = await client.from("patient_materials").select("material_id").not("assigned_by", "is", null);
  const countMap = new Map<string, number>();
  for (const c of counts ?? []) countMap.set(c.material_id, (countMap.get(c.material_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, assigned_count: countMap.get(r.id) ?? 0 }));
}

export type MaterialInput = {
  title: string;
  description?: string | null;
  type: Material["type"];
  category_id?: string | null;
  external_url?: string | null;
  storage_path?: string | null;
  exercise_template_id?: string | null;
  duration_minutes?: number | null;
  visibility: Material["visibility"];
  is_published: boolean;
};

export async function upsertMaterial(client: ServerSupabaseClient, input: MaterialInput & { id?: string }, createdBy: string): Promise<Material> {
  const { id, ...rest } = input;
  const payload = {
    ...rest,
    description: rest.description || null,
    category_id: rest.category_id || null,
    external_url: rest.external_url || null,
    storage_path: rest.storage_path || null,
    exercise_template_id: rest.exercise_template_id || null,
    duration_minutes: rest.duration_minutes ?? null,
  };
  const query = id ? client.from("materials").update(payload).eq("id", id) : client.from("materials").insert({ ...payload, created_by: createdBy });
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23514") throw new AppError("VALIDATION", "Falta el archivo, el enlace o el ejercicio según el tipo de material.");
    throw fromDatabaseError(error, "No pudimos guardar el material.");
  }
  return data;
}

export async function deleteMaterial(client: ServerSupabaseClient, id: string) {
  const { data: material } = await client.from("materials").select("storage_path").eq("id", id).maybeSingle();
  const { error } = await client.from("materials").delete().eq("id", id);
  if (error) throw fromDatabaseError(error);
  if (material?.storage_path) await client.storage.from("materials").remove([material.storage_path]);
}

const ALLOWED_MIME: Record<string, Material["type"]> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "video/mp4": "video",
  "video/webm": "video",
};
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Sube un archivo al bucket privado "materials" y devuelve su ruta y tipo detectado. */
export async function uploadMaterialFile(client: ServerSupabaseClient, file: File): Promise<{ path: string; type: Material["type"] }> {
  const type = ALLOWED_MIME[file.type];
  if (!type) throw new AppError("VALIDATION", "Formato no permitido. Aceptamos PDF, imágenes, audio (mp3/m4a/wav/ogg) y video (mp4/webm).");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "El archivo supera los 50 MB.");
  const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from("materials").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new AppError("EXTERNAL", `No pudimos subir el archivo: ${error.message}`);
  return { path, type };
}

export async function assignMaterialToPatient(client: ServerSupabaseClient, input: { materialId: string; patientId: string; note?: string | null; assignedBy: string }) {
  const { error } = await client.from("patient_materials").upsert(
    { material_id: input.materialId, patient_id: input.patientId, note: input.note || null, assigned_by: input.assignedBy, assigned_at: new Date().toISOString() },
    { onConflict: "patient_id,material_id" },
  );
  if (error) throw fromDatabaseError(error, "No pudimos asignar el material.");
}

export async function unassignMaterial(client: ServerSupabaseClient, materialId: string, patientId: string) {
  const { error } = await client.from("patient_materials").delete().eq("material_id", materialId).eq("patient_id", patientId);
  if (error) throw fromDatabaseError(error);
}

export async function assignExerciseToPatient(client: ServerSupabaseClient, input: { templateId: string; patientId: string; note?: string | null; dueAt?: Date | null; assignedBy: string }) {
  const { error } = await client.from("exercise_assignments").insert({
    template_id: input.templateId,
    patient_id: input.patientId,
    note: input.note || null,
    due_at: input.dueAt ? input.dueAt.toISOString() : null,
    assigned_by: input.assignedBy,
  });
  if (error) throw fromDatabaseError(error, "No pudimos asignar el ejercicio.");
}
