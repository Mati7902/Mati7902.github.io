/**
 * Dirección pública de la página (sin barra final), usada en emails, enlaces del chatbot,
 * SEO y redirecciones.
 *
 * 1. `NEXT_PUBLIC_APP_URL`, si está definida.
 * 2. En Vercel, el dominio de producción del proyecto (`VERCEL_PROJECT_PRODUCTION_URL`): es el
 *    dominio propio cuando hay uno conectado y, si no, el `.vercel.app`. Así, al comprar un
 *    dominio y conectarlo, alcanza con volver a publicar.
 * 3. `http://localhost:3000` en desarrollo.
 */
export function resolveAppUrl(explicit?: string | null, vercelProductionHost?: string | null): string {
  const value = explicit?.trim() || (vercelProductionHost?.trim() ? `https://${vercelProductionHost.trim()}` : "");
  if (!value) return "http://localhost:3000";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

/** Host sin puerto ni "www." para comparar direcciones. */
function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/**
 * Si el panel se está usando desde un dominio propio distinto del configurado, devuelve ambos
 * hosts para avisar: los emails y enlaces seguirían saliendo con la dirección vieja.
 * No avisa en desarrollo ni desde direcciones de Vercel (`*.vercel.app`).
 */
export function domainMismatch(requestHost: string | null | undefined, appUrl: string): { requestHost: string; appHost: string } | null {
  if (!requestHost) return null;
  let appHost: string;
  try {
    appHost = new URL(appUrl).host;
  } catch {
    return null;
  }
  const current = bareHost(requestHost);
  if (!current || current === "localhost" || current === "127.0.0.1" || current.endsWith(".vercel.app")) return null;
  if (current === bareHost(appHost)) return null;
  return { requestHost: requestHost.trim().toLowerCase(), appHost };
}
