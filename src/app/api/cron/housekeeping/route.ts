import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullGoogleChanges } from "@/server/services/google-calendar/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("cron.housekeeping");

/**
 * Tareas diarias de mantenimiento:
 *  - limpiar contadores de rate limiting,
 *  - sincronizar cambios del calendario externo,
 *  - marcar como "ausente" los turnos confirmados que quedaron sin cerrar (más de 2 días atrás).
 */
export async function GET(request: NextRequest) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const [{ data: cleaned }, google] = await Promise.all([admin.rpc("cleanup_rate_limits"), pullGoogleChanges()]);
    // Retención mínima: los eventos de webhook solo sirven para idempotencia (30 días alcanzan).
    const { count: purgedEvents } = await admin
      .from("whatsapp_webhook_events")
      .delete({ count: "exact" })
      .lt("received_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString());
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
    const { data: stale } = await admin
      .from("appointments")
      .update({ status: "no_show" })
      .in("status", ["pending", "rescheduled"])
      .lt("end_time", twoDaysAgo)
      .select("id");
    return NextResponse.json({ ok: true, rate_limit_rows_removed: cleaned ?? 0, webhook_events_purged: purgedEvents ?? 0, google, stale_marked_no_show: stale?.length ?? 0 });
  } catch (error) {
    log.error("Housekeeping falló", errorMeta(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
