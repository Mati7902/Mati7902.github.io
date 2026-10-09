import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { TherapyPlan } from "@/types/domain";

export async function listPlansAdmin(client: ServerSupabaseClient): Promise<TherapyPlan[]> {
  const { data, error } = await client.from("therapy_plans").select("*").order("sort_order").order("name");
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export type PlanInput = {
  slug: string;
  name: string;
  short_description?: string | null;
  description?: string | null;
  price_amount: number | null;
  currency: string;
  duration_minutes?: number | null;
  sessions_included?: number | null;
  features: string[];
  cta_label: string;
  cta_type: "book" | "consult";
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
};

export async function upsertPlan(client: ServerSupabaseClient, input: PlanInput & { id?: string }): Promise<TherapyPlan> {
  const { id, ...rest } = input;
  const payload = { ...rest, short_description: rest.short_description || null, description: rest.description || null, duration_minutes: rest.duration_minutes ?? null, sessions_included: rest.sessions_included ?? null };
  const query = id ? client.from("therapy_plans").update(payload).eq("id", id) : client.from("therapy_plans").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar el plan.");
  return data;
}

export async function deletePlan(client: ServerSupabaseClient, id: string) {
  const { error } = await client.from("therapy_plans").delete().eq("id", id);
  if (error) throw fromDatabaseError(error, "No se puede eliminar un plan con turnos asociados. Desactivalo en su lugar.");
}
