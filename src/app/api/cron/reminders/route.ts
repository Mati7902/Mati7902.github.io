import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { runReminders } from "@/server/services/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("cron.reminders");

/** Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado, el endpoint se niega. */
function authorized(request: NextRequest): boolean {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const results = await runReminders();
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), results });
  } catch (error) {
    log.error("Cron de recordatorios falló", errorMeta(error));
    return NextResponse.json({ ok: false, error: "reminders_failed" }, { status: 500 });
  }
}
