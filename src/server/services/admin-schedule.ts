import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AvailabilityRule, BlockedSlot } from "@/types/domain";

export async function listAvailabilityRules(client: ServerSupabaseClient): Promise<AvailabilityRule[]> {
  const { data, error } = await client.from("availability_rules").select("*").order("weekday").order("start_time");
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export type AvailabilityRuleInput = {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  modality: AvailabilityRule["modality"];
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
};

export async function upsertAvailabilityRule(client: ServerSupabaseClient, input: AvailabilityRuleInput & { id?: string }): Promise<AvailabilityRule> {
  const { id, ...rest } = input;
  const payload = { ...rest, valid_from: rest.valid_from || null, valid_until: rest.valid_until || null };
  const query = id ? client.from("availability_rules").update(payload).eq("id", id) : client.from("availability_rules").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw fromDatabaseError(error, "No pudimos guardar la regla de disponibilidad.");
  return data;
}

export async function deleteAvailabilityRule(client: ServerSupabaseClient, id: string) {
  const { error } = await client.from("availability_rules").delete().eq("id", id);
  if (error) throw fromDatabaseError(error);
}

export async function listBlockedSlots(client: ServerSupabaseClient, from?: Date): Promise<BlockedSlot[]> {
  let q = client.from("blocked_slots").select("*").order("start_time");
  if (from) q = q.gte("end_time", from.toISOString());
  const { data, error } = await q;
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export async function createBlockedSlot(client: ServerSupabaseClient, input: { start: Date; end: Date; type: BlockedSlot["type"]; reason?: string | null; createdBy: string }): Promise<BlockedSlot> {
  const { data, error } = await client
    .from("blocked_slots")
    .insert({ start_time: input.start.toISOString(), end_time: input.end.toISOString(), type: input.type, reason: input.reason || null, created_by: input.createdBy })
    .select("*")
    .single();
  if (error) throw fromDatabaseError(error, "No pudimos crear el bloqueo.");
  return data;
}

export async function deleteBlockedSlot(client: ServerSupabaseClient, id: string) {
  const { error } = await client.from("blocked_slots").delete().eq("id", id);
  if (error) throw fromDatabaseError(error);
}
