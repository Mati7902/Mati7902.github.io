import "server-only";

import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { Notification } from "@/types/domain";
import type { Database } from "@/types/database";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export async function getUnreadCount(client: ServerSupabaseClient, userId: string): Promise<number> {
  const { count } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function listNotifications(client: ServerSupabaseClient, userId: string, limit = 30): Promise<Notification[]> {
  const { data } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function markAllRead(client: ServerSupabaseClient, userId: string) {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function markRead(client: ServerSupabaseClient, userId: string, id: string) {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

/** Crea una notificación in-app para un usuario (requiere admin o service_role). */
export async function createNotification(
  client: ServerSupabaseClient | AdminSupabaseClient,
  input: { userId: string; type: NotificationType; title: string; body?: string; data?: Record<string, unknown> },
) {
  const { error } = await client.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: (input.data ?? {}) as never,
  });
  if (error) throw error;
}
