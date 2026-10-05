import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Punto de entrada de los enlaces de email de Supabase (invitación, recuperación, confirmación).
 * Soporta flujo PKCE (?code=) y flujo token_hash (?token_hash=&type=).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/app";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${resolveNext(next, type)}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${resolveNext(next, type)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=enlace-invalido`);
}

function resolveNext(next: string, type: EmailOtpType | null): string {
  if (type === "invite" || type === "signup") return "/bienvenida";
  if (type === "recovery") return "/restablecer";
  return next;
}
