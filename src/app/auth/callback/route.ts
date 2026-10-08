import { NextResponse, type NextRequest } from "next/server";

import { fragmentSessionPage, parseEmailOtpType, resolveAuthNext } from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/server";

/**
 * Punto de entrada de los enlaces de email de Supabase (invitación, recuperación, acceso).
 * Soporta:
 *  - token_hash (?token_hash=&type=): el formato recomendado, el de las plantillas de
 *    supabase/templates. Funciona aunque el email se abra en otro navegador o dispositivo.
 *  - PKCE (?code=): solo funciona en el mismo navegador donde se pidió el enlace.
 *  - sesión en el fragmento (#access_token=…): la plantilla por defecto de Supabase con las
 *    invitaciones enviadas desde el servidor. El fragmento no llega acá, así que se responde una
 *    página que lo lee y lo envía a /auth/callback/session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailOtpType(searchParams.get("type"));
  const next = searchParams.get("next");
  const invalid = NextResponse.redirect(`${origin}/login?error=enlace-invalido`);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? invalid : NextResponse.redirect(`${origin}${resolveAuthNext(next, type)}`);
  }
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? invalid : NextResponse.redirect(`${origin}${resolveAuthNext(next, type)}`);
  }
  // Supabase informa enlaces vencidos o ya usados con ?error=… (o en el fragmento, que resuelve la página).
  if (searchParams.get("error")) return invalid;

  return new NextResponse(fragmentSessionPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
