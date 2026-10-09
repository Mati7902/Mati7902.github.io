"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation";
import { deleteMaterial, uploadMaterialFile, upsertMaterial } from "@/server/services/admin-materials";
import { audit } from "@/server/services/audit";

const materialSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Ingresá un título.").max(160),
  description: z.string().trim().max(2000).optional().default(""),
  type: z.enum(["pdf", "image", "audio", "video", "link", "exercise"]),
  category_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
  external_url: z.union([z.literal(""), z.string().trim().url("URL inválida.")]).optional().default(""),
  exercise_template_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
  duration_minutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(600)]).optional().default(""),
  visibility: z.enum(["public", "assigned"]).default("assigned"),
  is_published: z.coerce.boolean().default(false),
  existing_storage_path: z.string().optional().default(""),
});

export async function saveMaterialAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const file = formData.get("file");
  formData.delete("file");
  const parsed = parseForm(materialSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const d = parsed.data;
  try {
    const session = await assertAdmin();
    const supabase = await createClient();

    let storagePath = d.existing_storage_path || null;
    let type = d.type;
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadMaterialFile(supabase, file);
      storagePath = uploaded.path;
      if (type !== "exercise" && type !== "link") type = uploaded.type;
    }
    if (type === "link" && !d.external_url) return validationFail({ external_url: "Ingresá el enlace." });
    if (type === "exercise" && !d.exercise_template_id) return validationFail({ exercise_template_id: "Elegí el ejercicio." });
    if (["pdf", "image", "audio", "video"].includes(type) && !storagePath && !d.external_url) {
      return validationFail({ file: "Subí un archivo o indicá una URL externa." });
    }

    const material = await upsertMaterial(
      supabase,
      {
        id: d.id,
        title: d.title,
        description: d.description,
        type,
        category_id: d.category_id || null,
        external_url: d.external_url || null,
        storage_path: storagePath,
        exercise_template_id: d.exercise_template_id || null,
        duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
        visibility: d.visibility,
        is_published: d.is_published,
      },
      session.userId,
    );
    await audit(supabase, d.id ? "material.updated" : "material.created", { type: "material", id: material.id });
    revalidatePath("/admin/materiales");
    revalidatePath("/app/materiales");
    return ok({ id: material.id });
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMaterialAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await deleteMaterial(supabase, id);
    await audit(supabase, "material.deleted", { type: "material", id });
    revalidatePath("/admin/materiales");
    revalidatePath("/app/materiales");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function toggleExerciseActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("exercise_templates").update({ is_active: active }).eq("id", id);
    if (error) throw error;
    await audit(supabase, active ? "exercise.activated" : "exercise.deactivated", { type: "exercise_template", id });
    revalidatePath("/admin/ejercicios");
    revalidatePath("/app/ejercicios");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
