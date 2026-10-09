import "server-only";

import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/types/domain";

export async function listAuditLogs(client: ServerSupabaseClient, limit = 100): Promise<(AuditLog & { actor_name?: string | null })[]> {
  const { data } = await client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  const logs = data ?? [];
  const actorIds = Array.from(new Set(logs.map((l) => l.actor_id).filter((id): id is string => Boolean(id))));
  const { data: profiles } = actorIds.length ? await client.from("profiles").select("id, full_name, email").in("id", actorIds) : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  return logs.map((l) => ({ ...l, actor_name: l.actor_id ? (names.get(l.actor_id) ?? null) : "Sistema" }));
}

export async function listWebhookEvents(client: ServerSupabaseClient, limit = 50) {
  const { data } = await client.from("whatsapp_webhook_events").select("id, event_key, event_type, status, error, received_at, processed_at").order("received_at", { ascending: false }).limit(limit);
  return data ?? [];
}
