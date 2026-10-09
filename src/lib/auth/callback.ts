import type { EmailOtpType } from "@supabase/supabase-js";

import { safeInternalPath } from "@/lib/safe-redirect";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Tipo de enlace de email de Supabase, o null si no es uno conocido. */
export function parseEmailOtpType(value: string | null | undefined): EmailOtpType | null {
  return value && (EMAIL_OTP_TYPES as readonly string[]).includes(value) ? (value as EmailOtpType) : null;
}

/**
 * A dónde va la persona después de abrir un enlace de email: la invitación define la contraseña
 * en /bienvenida y la recuperación en /restablecer; el resto respeta `next` (solo rutas internas).
 */
export function resolveAuthNext(next: string | null | undefined, type: EmailOtpType | null): string {
  if (type === "invite" || type === "signup") return "/bienvenida";
  if (type === "recovery") return "/restablecer";
  return safeInternalPath(next ?? null, "/app");
}

/**
 * Página intermedia para enlaces que traen la sesión en el fragmento (#access_token=…): es lo
 * que hace la plantilla por defecto de Supabase con las invitaciones enviadas desde el servidor.
 * El fragmento no llega al servidor, así que esta página lo lee y lo entrega a
 * /auth/callback/session por POST, que crea la sesión con cookies. Si no hay sesión en el
 * fragmento, el enlace es inválido o venció.
 */
export function fragmentSessionPage(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ingresando…</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fbfdfc;color:#0f2333}</style>
</head>
<body>
<p>Ingresando…</p>
<noscript><p>Para continuar, activá JavaScript o pedí un enlace nuevo.</p></noscript>
<script>
(function () {
  var fail = "/login?error=enlace-invalido";
  var hash = new URLSearchParams(location.hash.slice(1));
  var accessToken = hash.get("access_token");
  var refreshToken = hash.get("refresh_token");
  // Se borra el fragmento de la barra de direcciones: no debe quedar en el historial.
  history.replaceState(null, "", location.pathname + location.search);
  if (!accessToken || !refreshToken) { location.replace(fail); return; }
  fetch("/auth/callback/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      type: hash.get("type"),
      next: new URLSearchParams(location.search).get("next")
    })
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { location.replace(d && d.next ? d.next : fail); })
    .catch(function () { location.replace(fail); });
})();
</script>
</body>
</html>`;
}
