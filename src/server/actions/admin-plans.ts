"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation";
import { deletePlan, upsertPlan } from "@/server/services/admin-plans";
import { audit } from "@/server/services/audit";

const planSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Usá minúsculas, números y guiones."),
  name: z.string().trim().min(2, "Ingresá el nombre.").max(120),
  short_description: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  price_amount: z.union([z.literal(""), z.coerce.number().min(0).max(999_999_999)]).optional().default(""),
  currency: z.string().trim().length(3).default("PYG"),
  duration_minutes: z.union([z.literal(""), z.coerce.number().int().min(10).max(600)]).optional().default(""),
  sessions_included: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).optional().default(""),
  features: z.string().optional().default(""),
  cta_label: z.string().trim().min(2).max(40).default("Solicitar turno"),
  cta_type: z.enum(["book", "consult"]).default("book"),
  is_active: z.coerce.boolean().default(true),
  is_featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function savePlanAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(planSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const d = parsed.data;
  try {
    await assertAdmin();
    const supabase = await createClient();
    const plan = await upsertPlan(supabase, {
      id: d.id,
      slug: d.slug,
      name: d.name,
      short_description: d.short_description,
      description: d.description,
      price_amount: typeof d.price_amount === "number" ? d.price_amount : null,
      currency: d.currency.toUpperCase(),
      duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
      sessions_included: typeof d.sessions_included === "number" ? d.sessions_included : null,
      features: d.features.split("\n").map((f) => f.trim()).filter(Boolean),
      cta_label: d.cta_label,
      cta_type: d.cta_type,
      is_active: d.is_active,
      is_featured: d.is_featured,
      sort_order: d.sort_order,
    });
    await audit(supabase, d.id ? "plan.updated" : "plan.created", { type: "therapy_plan", id: plan.id });
    revalidatePath("/admin/planes");
    revalidatePath("/planes");
    revalidatePath("/");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deletePlanAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await deletePlan(supabase, id);
    await audit(supabase, "plan.deleted", { type: "therapy_plan", id });
    revalidatePath("/admin/planes");
    revalidatePath("/planes");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
