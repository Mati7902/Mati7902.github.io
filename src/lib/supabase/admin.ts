import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente con service_role: OMITE RLS. Usar únicamente en el servidor para tareas de sistema
 * (webhooks, crons, invitaciones, cálculo de disponibilidad). Nunca exponer al cliente.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada. Esta operación requiere privilegios de servidor.");
  }
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminSupabaseClient = SupabaseClient<Database>;
