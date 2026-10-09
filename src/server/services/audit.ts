import "server-only";

import { createLogger, errorMeta } from "@/lib/logger";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";

const log = createLogger("audit");

/**
 * Registra una acción crítica en audit_logs. Nunca bloquea el flujo principal:
 * si falla, se loguea y se continúa.
 */
export async function audit(
  client: ServerSupabaseClient | AdminSupabaseClient,
  action: string,
  entity?: { type: string; id?: string | null },
  metadata: Record<string, unknown> = {},
) {
  try {
    const { error } = await client.rpc("audit_log", {
      p_action: action,
      p_entity_type: entity?.type ?? undefined,
      p_entity_id: entity?.id ?? undefined,
      p_metadata: metadata as never,
    });
    if (error) log.warn("No se pudo registrar auditoría", { action, ...errorMeta(error) });
  } catch (error) {
    log.warn("No se pudo registrar auditoría", { action, ...errorMeta(error) });
  }
}
