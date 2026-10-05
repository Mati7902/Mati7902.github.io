import { after, NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleInboundMessage } from "@/server/services/whatsapp/bot";
import { updateDeliveryStatus } from "@/server/services/whatsapp/conversation";
import { eventKeyFor, normalizeWebhook, verifySignature, webhookPayloadSchema } from "@/server/services/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("webhook.whatsapp");

/** Verificación del webhook (Meta llama con hub.mode=subscribe al configurar la URL). */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/**
 * Recepción de eventos. Pipeline:
 * firma → validación de payload → normalización → idempotencia (whatsapp_webhook_events)
 * → respuesta 200 inmediata → procesamiento diferido con after() → registro del resultado.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const rawBody = await request.text();

  if (!env.META_APP_SECRET) {
    log.error("META_APP_SECRET no configurado: se rechaza el webhook");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET)) {
    log.warn("Firma de webhook inválida");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = webhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    // Otros objetos (p. ej. cambios de cuenta) se aceptan sin procesar para que Meta no reintente.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const events = normalizeWebhook(parsed.data);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true, ignored: true });
  const admin = createAdminClient();

  // Idempotencia: insertamos cada evento; si la clave ya existe, se ignora.
  const toProcess: { key: string; kind: "message" | "status"; index: number }[] = [];
  for (const [index, m] of events.messages.entries()) {
    const key = eventKeyFor("message", m.waMessageId);
    const { error } = await admin.from("whatsapp_webhook_events").insert({ event_key: key, event_type: `message.${m.rawType}`, payload: m as never });
    if (!error) toProcess.push({ key, kind: "message", index });
    else if (error.code !== "23505") log.warn("No se pudo registrar el evento", { key, ...errorMeta(error) });
  }
  for (const [index, s] of events.statuses.entries()) {
    const key = eventKeyFor("status", s.waMessageId, s.status);
    const { error } = await admin.from("whatsapp_webhook_events").insert({ event_key: key, event_type: `status.${s.status}`, payload: s as never });
    if (!error) toProcess.push({ key, kind: "status", index });
  }

  after(async () => {
    for (const item of toProcess) {
      try {
        if (item.kind === "message") {
          await handleInboundMessage(events.messages[item.index]!);
        } else {
          const s = events.statuses[item.index]!;
          await updateDeliveryStatus(admin, s.waMessageId, s.status, s.error);
        }
        await admin.from("whatsapp_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("event_key", item.key);
      } catch (error) {
        log.error("Error procesando evento de WhatsApp", { key: item.key, ...errorMeta(error) });
        await admin
          .from("whatsapp_webhook_events")
          .update({ status: "failed", processed_at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) })
          .eq("event_key", item.key);
      }
    }
  });

  return NextResponse.json({ ok: true, received: toProcess.length });
}
