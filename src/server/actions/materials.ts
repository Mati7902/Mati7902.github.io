"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPatient } from "@/lib/auth/session";
import { type ActionResult, fail, ok } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getMaterialSignedUrl, markMaterialProgress } from "@/server/services/materials";

export async function markMaterialViewedAction(materialId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(materialId).success) return fail(new Error("id inválido"));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    await markMaterialProgress(supabase, patient.id, materialId, false);
    revalidatePath("/app/materiales");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function markMaterialCompletedAction(materialId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(materialId).success) return fail(new Error("id inválido"));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    await markMaterialProgress(supabase, patient.id, materialId, true);
    revalidatePath("/app/materiales");
    revalidatePath(`/app/materiales/${materialId}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

/** Devuelve una URL firmada para abrir un archivo privado; RLS de storage decide si corresponde. */
export async function getMaterialFileUrlAction(materialId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const { data: material } = await supabase.from("materials").select("id, storage_path").eq("id", materialId).maybeSingle();
    if (!material?.storage_path) return fail(new Error("sin archivo"), "Este material no tiene un archivo asociado.");
    const url = await getMaterialSignedUrl(supabase, material.storage_path);
    if (!url) return fail(new Error("sin acceso"), "No pudimos generar el enlace. Intentá de nuevo.");
    await markMaterialProgress(supabase, patient.id, materialId, false);
    return ok({ url });
  } catch (error) {
    return fail(error);
  }
}
