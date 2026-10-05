import "server-only";

import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { getSettings, settingsSchemas, type SettingsValue } from "@/server/services/settings";
import type { Database } from "@/types/database";

const log = createLogger("public-settings");

const PUBLIC_KEYS = ["site.identity", "scheduling", "emergency", "theme", "legal", "landing"] as const;
type PublicKey = (typeof PUBLIC_KEYS)[number];
export type PublicSettings = { [K in PublicKey]: SettingsValue<K> };

function defaults(): PublicSettings {
  const out = {} as PublicSettings;
  for (const key of PUBLIC_KEYS) {
    (out as Record<string, unknown>)[key] = settingsSchemas[key].parse({});
  }
  return out;
}

/**
 * Cliente anónimo SIN cookies: permite leer configuración pública desde páginas estáticas/ISR
 * (landing, metadata) sin convertirlas en dinámicas.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Configuración pública con degradación a valores por defecto si Supabase no responde. */
export const getPublicSettingsSafe = cache(async (): Promise<PublicSettings> => {
  if (!isSupabaseConfigured()) return defaults();
  try {
    return await getSettings(createAnonClient(), PUBLIC_KEYS);
  } catch (error) {
    log.warn("No se pudo leer la configuración pública; se usan valores por defecto", errorMeta(error));
    return defaults();
  }
});
