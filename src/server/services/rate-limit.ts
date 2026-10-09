import "server-only";

import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const log = createLogger("rate-limit");

/**
 * Ventana fija de intentos por clave (login:<ip>, booking:<paciente>, …).
 * Se ejecuta SOLO con service_role: si un usuario pudiera llamar a check_rate_limit con
 * una clave arbitraria podría bloquear el acceso de otra cuenta.
 * Falla abierto (permite) si la infraestructura no está disponible, para no impedir el uso.
 */
export async function allowAttempt(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) return true;
    const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) {
      log.warn("check_rate_limit falló; se permite el intento", errorMeta(error));
      return true;
    }
    return data !== false;
  } catch (error) {
    log.warn("Rate limit no disponible; se permite el intento", errorMeta(error));
    return true;
  }
}
