import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";
import { publicEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";
import { emailFromIdToken, exchangeCode, GOOGLE_SCOPES } from "@/server/services/google-calendar/client";

const log = createLogger("google-oauth");

export async function GET(request: NextRequest) {
  const back = (status: string) => NextResponse.redirect(`${publicEnv.appUrl}/admin/configuracion?tab=agenda&google=${status}`);
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.redirect(`${publicEnv.appUrl}/login`);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get("psms_google_oauth_state")?.value;
  cookieStore.delete("psms_google_oauth_state");
  if (!code || !state || !expected || state !== expected) return back("estado-invalido");

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();
    const { error } = await supabase.from("calendar_integrations").upsert(
      {
        provider: "google",
        owner_profile_id: session.userId,
        external_account_email: emailFromIdToken(tokens.id_token),
        calendar_id: "primary",
        access_token_encrypted: encryptSecret(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: (tokens.scope ?? GOOGLE_SCOPES.join(" ")).split(" "),
        is_active: true,
        last_error: null,
      },
      { onConflict: "provider,owner_profile_id" },
    );
    if (error) throw error;
    await audit(supabase, "integration.google_connected", { type: "calendar_integration", id: session.userId });
    return back("conectado");
  } catch (error) {
    log.error("Callback de Google falló", errorMeta(error));
    return back("error");
  }
}
