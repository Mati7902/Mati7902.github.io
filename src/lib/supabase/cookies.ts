/**
 * "Mantener sesión iniciada": @supabase/ssr siempre escribe cookies de larga duración.
 * Cuando el usuario NO quiere mantener la sesión, guardamos un flag (cookie de sesión del
 * navegador) y quitamos maxAge/expires a las cookies de auth, que así expiran al cerrar el navegador.
 */
export const SESSION_ONLY_COOKIE = "psms_session_only";

type CookieOptions = Record<string, unknown> & { maxAge?: number; expires?: Date };

export function applySessionOnly<T extends CookieOptions | undefined>(options: T, sessionOnly: boolean): T {
  if (!sessionOnly || !options) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest as T;
}
