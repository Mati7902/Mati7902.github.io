import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import { applySessionOnly, SESSION_ONLY_COOKIE } from "@/lib/supabase/cookies";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Respeta RLS: actúa en nombre del usuario autenticado.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const sessionOnly = cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applySessionOnly(options, sessionOnly)),
          );
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
