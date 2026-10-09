import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { parseEmailOtpType, resolveAuthNext } from "@/lib/auth/callback";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(1024),
  type: z.string().max(32).nullish(),
  next: z.string().max(512).nullish(),
});

/**
 * Crea la sesión (cookies) a partir de los tokens que traía el fragmento de un enlace de email
 * (ver fragmentSessionPage). Solo acepta pedidos de la propia página: otro sitio no puede iniciar
 * en este navegador una sesión ajena (login CSRF). Supabase valida los tokens al crear la sesión.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && host && new URL(origin).host === host);
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "unsupported" }, { status: 415 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession({ access_token: parsed.data.access_token, refresh_token: parsed.data.refresh_token });
  if (error || !data.user) return NextResponse.json({ error: "invalid" }, { status: 401 });

  return NextResponse.json({ next: resolveAuthNext(parsed.data.next, parseEmailOtpType(parsed.data.type)) }, { headers: { "Cache-Control": "no-store" } });
}
