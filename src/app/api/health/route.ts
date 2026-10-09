import { NextResponse } from "next/server";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Health check mínimo para monitoreo externo (sin exponer configuración sensible). `app_url` permite comprobar qué dirección usan los emails. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "psicologia-matias-sanchez", time: new Date().toISOString(), database_configured: isSupabaseConfigured(), app_url: publicEnv.appUrl });
}
