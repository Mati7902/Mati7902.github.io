import "server-only";

import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger, errorMeta } from "@/lib/logger";

const log = createLogger("whatsapp.client");

/**
 * Cliente mínimo de la WhatsApp Cloud API (Graph API oficial de Meta).
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Verificar la versión vigente de Graph API antes de desplegar (META_GRAPH_API_VERSION).
 */
export type SendResult = { ok: true; messageId: string } | { ok: false; error: string; status?: number };

export type InteractiveButton = { id: string; title: string }; // máx. 3, título ≤ 20 caracteres
export type InteractiveListRow = { id: string; title: string; description?: string }; // máx. 10 filas, título ≤ 24

export function isWhatsAppConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID);
}

function endpoint(): string {
  const env = getServerEnv();
  return `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  const env = getServerEnv();
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "WhatsApp no está configurado (META_WHATSAPP_TOKEN / PHONE_NUMBER_ID)." };
  }
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`;
      log.warn("Envío de WhatsApp rechazado", { status: res.status, code: json.error?.code, message });
      return { ok: false, error: message, status: res.status };
    }
    const id = json.messages?.[0]?.id;
    if (!id) return { ok: false, error: "Respuesta sin message id" };
    return { ok: true, messageId: id };
  } catch (error) {
    log.error("Error de red enviando WhatsApp", errorMeta(error));
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
}

function toWaId(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "");
}

export async function sendText(to: string, body: string, previewUrl = false): Promise<SendResult> {
  return post({ to: toWaId(to), type: "text", text: { body: body.slice(0, 4096), preview_url: previewUrl } });
}

/** Mensaje de plantilla aprobada (obligatorio fuera de la ventana de 24 h de servicio al cliente). */
export async function sendTemplate(to: string, templateName: string, language: string, bodyParams: string[] = [], buttonPayloads: string[] = []): Promise<SendResult> {
  const components: Record<string, unknown>[] = [];
  if (bodyParams.length) {
    components.push({ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) });
  }
  buttonPayloads.forEach((payload, index) => {
    components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] });
  });
  return post({ to: toWaId(to), type: "template", template: { name: templateName, language: { code: language }, components } });
}

export async function sendInteractiveButtons(to: string, body: string, buttons: InteractiveButton[], footer?: string): Promise<SendResult> {
  if (buttons.length === 0 || buttons.length > 3) throw new AppError("VALIDATION", "Los botones interactivos admiten entre 1 y 3 opciones.");
  return post({
    to: toWaId(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
    },
  });
}

export async function sendInteractiveList(to: string, body: string, buttonLabel: string, sectionTitle: string, rows: InteractiveListRow[], footer?: string): Promise<SendResult> {
  if (rows.length === 0 || rows.length > 10) throw new AppError("VALIDATION", "Las listas interactivas admiten entre 1 y 10 opciones.");
  return post({
    to: toWaId(to),
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [{ title: sectionTitle.slice(0, 24), rows: rows.map((r) => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) }],
      },
    },
  });
}

export async function sendLocation(to: string, latitude: number, longitude: number, name: string, address: string): Promise<SendResult> {
  return post({ to: toWaId(to), type: "location", location: { latitude, longitude, name, address } });
}

/** Marca un mensaje entrante como leído (mejora la experiencia del usuario). */
export async function markAsRead(messageId: string): Promise<void> {
  await post({ status: "read", message_id: messageId }).catch(() => undefined);
}
