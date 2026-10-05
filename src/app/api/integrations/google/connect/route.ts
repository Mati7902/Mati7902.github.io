import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { buildAuthUrl, isGoogleConfigured } from "@/server/services/google-calendar/client";

/** Inicia el flujo OAuth de Google Calendar (solo administradores). */
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.redirect(`${publicEnv.appUrl}/login`);
  if (!isGoogleConfigured()) return NextResponse.redirect(`${publicEnv.appUrl}/admin/configuracion?tab=agenda&google=no-configurado`);
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("psms_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return NextResponse.redirect(buildAuthUrl(state));
}
