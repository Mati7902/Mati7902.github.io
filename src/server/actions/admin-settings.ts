"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import { audit } from "@/server/services/audit";
import { saveSetting, settingsSchemas, type SettingsKey, type SettingsValue } from "@/server/services/settings";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveSettingsAction<K extends SettingsKey>(key: K, value: unknown): Promise<ActionResult<SettingsValue<K>>> {
  const schema = settingsSchemas[key];
  if (!schema) return fail(new AppError("VALIDATION", "Clave de configuración desconocida."));
  const parsed = schema.safeParse(value);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const saved = await saveSetting(supabase, key, parsed.data as SettingsValue<K>, session.userId);
    await audit(supabase, "settings.updated", { type: "settings", id: key });
    revalidateAll();
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}

const faqSchema = z.object({ id: z.string().uuid().optional(), question: z.string().trim().min(3).max(300), answer: z.string().trim().min(3).max(3000), sort_order: z.number().int().min(0).max(999).default(0), is_published: z.boolean().default(true) });

export async function saveFaqAction(input: z.infer<typeof faqSchema>): Promise<ActionResult> {
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { id, ...rest } = parsed.data;
    const { error } = id ? await supabase.from("faqs").update(rest).eq("id", id) : await supabase.from("faqs").insert(rest);
    if (error) throw error;
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) throw error;
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  url: z.union([z.literal(""), z.string().trim().url()]).optional().nullable(),
  sort_order: z.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(false),
});

export async function saveEmergencyResourceAction(input: z.infer<typeof resourceSchema>): Promise<ActionResult> {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { id, ...rest } = parsed.data;
    const payload = { ...rest, description: rest.description || null, phone: rest.phone || null, url: rest.url || null, verified_at: rest.is_active ? new Date().toISOString() : null };
    const { error } = id ? await supabase.from("emergency_resources").update(payload).eq("id", id) : await supabase.from("emergency_resources").insert(payload);
    if (error) throw error;
    await audit(supabase, "emergency_resource.saved", { type: "emergency_resource", id: id ?? null }, { is_active: rest.is_active });
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEmergencyResourceAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("emergency_resources").delete().eq("id", id);
    if (error) throw error;
    revalidateAll();
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const templateSchema = z.object({ key: z.string().min(1), body: z.string().trim().min(5).max(1500), wa_template_name: z.string().trim().max(120).optional().nullable(), is_active: z.boolean().default(true) });

export async function saveNotificationTemplateAction(input: z.infer<typeof templateSchema>): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_templates")
      .update({ body: parsed.data.body, wa_template_name: parsed.data.wa_template_name || null, is_active: parsed.data.is_active })
      .eq("key", parsed.data.key);
    if (error) throw error;
    await audit(supabase, "notification_template.updated", { type: "notification_template", id: parsed.data.key });
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const BRANDING = {
  photo: { field: "photo_url", prefix: "profesional", types: ["image/png", "image/jpeg", "image/webp"], label: "PNG, JPG o WebP" },
  logo: { field: "logo_url", prefix: "logo", types: ["image/png", "image/webp", "image/svg+xml", "image/jpeg"], label: "SVG, PNG, WebP o JPG" },
} as const;
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

/**
 * Sube la foto profesional o el logo al bucket público "branding" y actualiza
 * site.identity (photo_url o logo_url).
 */
export async function uploadBrandingImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const kind = formData.get("kind") === "logo" ? "logo" : "photo";
  const spec = BRANDING[kind];
  const file = formData.get("file") ?? formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail(new AppError("VALIDATION", "Elegí una imagen."));
  if (!(spec.types as readonly string[]).includes(file.type)) return fail(new AppError("VALIDATION", `Formato no permitido (${spec.label}).`));
  if (file.size > 5 * 1024 * 1024) return fail(new AppError("VALIDATION", "La imagen supera los 5 MB."));
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const path = `${spec.prefix}-${Date.now()}.${EXTENSIONS[file.type] ?? "png"}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new AppError("EXTERNAL", `No pudimos subir la imagen: ${error.message}`);
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    const { data: current } = await supabase.from("settings").select("value").eq("key", "site.identity").maybeSingle();
    const identity = settingsSchemas["site.identity"].parse(current?.value ?? {});
    await saveSetting(supabase, "site.identity", { ...identity, [spec.field]: data.publicUrl }, session.userId);
    revalidateAll();
    return ok({ url: data.publicUrl });
  } catch (error) {
    return fail(error);
  }
}

/** Compatibilidad: sube la foto profesional. */
export async function uploadProfessionalPhotoAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  formData.set("kind", "photo");
  return uploadBrandingImageAction(formData);
}
