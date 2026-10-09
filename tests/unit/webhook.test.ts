import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { eventKeyFor, normalizeWebhook, verifySignature, webhookPayloadSchema } from "@/server/services/whatsapp/webhook";

const SECRET = "app-secret-de-prueba";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`;
}

const samplePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "595981000000", phone_number_id: "PHONE_ID" },
            contacts: [{ wa_id: "595981123456", profile: { name: "Juan Pérez" } }],
            messages: [
              { id: "wamid.TEXT", from: "595981123456", timestamp: "1760000000", type: "text", text: { body: "  Hola, ¿tenés turno mañana?  " } },
              { id: "wamid.BTN", from: "595981123456", timestamp: "1760000001", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "CONFIRM:abc", title: "Confirmar" } } },
              { id: "wamid.IMG", from: "595981123456", timestamp: "1760000002", type: "image" },
            ],
            statuses: [{ id: "wamid.OUT", status: "delivered", timestamp: "1760000003", recipient_id: "595981123456" }],
          },
        },
      ],
    },
  ],
};

describe("webhook de WhatsApp", () => {
  it("acepta una firma válida y rechaza las inválidas", () => {
    const body = JSON.stringify(samplePayload);
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
    expect(verifySignature(body, sign(body + " "), SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=00", SECRET)).toBe(false);
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, sign(body), "otro-secreto")).toBe(false);
  });

  it("valida el payload con Zod", () => {
    expect(webhookPayloadSchema.safeParse(samplePayload).success).toBe(true);
    expect(webhookPayloadSchema.safeParse({ object: "page", entry: [] }).success).toBe(false);
  });

  it("normaliza mensajes de texto, botones y no soportados, y los estados", () => {
    const parsed = webhookPayloadSchema.parse(samplePayload);
    const events = normalizeWebhook(parsed);
    expect(events.messages).toHaveLength(3);
    const [text, button, image] = events.messages;
    expect(text).toMatchObject({ waMessageId: "wamid.TEXT", type: "text", text: "Hola, ¿tenés turno mañana?", fromPhoneE164: "+595981123456", displayName: "Juan Pérez", phoneNumberId: "PHONE_ID" });
    expect(button).toMatchObject({ type: "interactive", payloadId: "CONFIRM:abc", text: "Confirmar" });
    expect(image).toMatchObject({ type: "unsupported", rawType: "image" });
    expect(events.statuses[0]).toMatchObject({ waMessageId: "wamid.OUT", status: "delivered", error: null });
    expect(text?.timestamp.toISOString()).toBe(new Date(1760000000 * 1000).toISOString());
  });

  it("genera claves de idempotencia distintas por mensaje y por estado", () => {
    expect(eventKeyFor("message", "wamid.1")).toBe("msg:wamid.1");
    expect(eventKeyFor("status", "wamid.1", "delivered")).not.toBe(eventKeyFor("status", "wamid.1", "read"));
  });
});
