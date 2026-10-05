import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Utilidades puras del webhook de WhatsApp Cloud API (sin acceso a base de datos):
 * verificación de firma, validación del payload y normalización de mensajes.
 * Se mantienen puras para poder testearlas.
 */

/** Verifica X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(appSecret, rawBody). Comparación en tiempo constante. */
export function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

const textMessage = z.object({ body: z.string() });
const interactive = z.object({
  type: z.enum(["button_reply", "list_reply"]),
  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
  list_reply: z.object({ id: z.string(), title: z.string(), description: z.string().optional() }).optional(),
});
const button = z.object({ payload: z.string().optional(), text: z.string().optional() });

export const inboundMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: textMessage.optional(),
  interactive: interactive.optional(),
  button: button.optional(),
  context: z.object({ id: z.string().optional() }).optional(),
});

export const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed", "deleted", "warning"]).or(z.string()),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.object({ code: z.number().optional(), title: z.string().optional(), message: z.string().optional() })).optional(),
});

export const webhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messaging_product: z.string().optional(),
            metadata: z.object({ display_phone_number: z.string().optional(), phone_number_id: z.string().optional() }).optional(),
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string().optional() }).optional() })).optional(),
            messages: z.array(inboundMessageSchema).optional(),
            statuses: z.array(statusSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export type NormalizedInbound = {
  waMessageId: string;
  fromPhoneE164: string;
  waId: string;
  displayName: string | null;
  phoneNumberId: string | null;
  timestamp: Date;
  type: "text" | "interactive" | "button" | "unsupported";
  text: string;
  /** ID del botón / fila de lista (payload estructurado) cuando aplica. */
  payloadId: string | null;
  rawType: string;
};

export type NormalizedStatus = { waMessageId: string; status: string; timestamp: Date; error: string | null };

export type NormalizedEvents = { messages: NormalizedInbound[]; statuses: NormalizedStatus[] };

/** Extrae mensajes y estados de un payload válido, en un formato plano y estable. */
export function normalizeWebhook(payload: WebhookPayload): NormalizedEvents {
  const messages: NormalizedInbound[] = [];
  const statuses: NormalizedStatus[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of value.messages ?? []) {
        let type: NormalizedInbound["type"] = "unsupported";
        let text = "";
        let payloadId: string | null = null;
        if (m.type === "text" && m.text) {
          type = "text";
          text = m.text.body;
        } else if (m.type === "interactive" && m.interactive) {
          type = "interactive";
          const reply = m.interactive.button_reply ?? m.interactive.list_reply;
          text = reply?.title ?? "";
          payloadId = reply?.id ?? null;
        } else if (m.type === "button" && m.button) {
          type = "button";
          text = m.button.text ?? "";
          payloadId = m.button.payload ?? null;
        }
        messages.push({
          waMessageId: m.id,
          fromPhoneE164: `+${m.from.replace(/\D/g, "")}`,
          waId: m.from,
          displayName: names.get(m.from) ?? null,
          phoneNumberId: value.metadata?.phone_number_id ?? null,
          timestamp: new Date(Number(m.timestamp) * 1000),
          type,
          text: text.trim(),
          payloadId,
          rawType: m.type,
        });
      }
      for (const s of value.statuses ?? []) {
        statuses.push({
          waMessageId: s.id,
          status: s.status,
          timestamp: new Date(Number(s.timestamp) * 1000),
          error: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null,
        });
      }
    }
  }
  return { messages, statuses };
}

/** Clave de idempotencia: un mensaje o estado se procesa una sola vez. */
export function eventKeyFor(kind: "message" | "status", id: string, status?: string): string {
  return kind === "message" ? `msg:${id}` : `status:${id}:${status ?? ""}`;
}
