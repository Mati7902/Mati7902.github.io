import "server-only";

import { createLogger, errorMeta } from "@/lib/logger";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import { getPatientByPhone } from "@/server/services/patients";
import type { NormalizedInbound } from "@/server/services/whatsapp/webhook";
import type { Patient, WhatsAppContact, WhatsAppConversation } from "@/types/domain";

const log = createLogger("whatsapp.conversation");

export type ConversationState = {
  flow?: "booking" | "reschedule" | "cancel" | null;
  step?: string | null;
  modality?: "presencial" | "virtual" | null;
  dateKey?: string | null;
  appointmentId?: string | null;
  offered?: { start: string; end: string; label: string }[];
  /** Payload que ejecuta un "sí" escrito a la última pregunta de sí/no (p. ej. "¿Le aviso al profesional?"). */
  pendingYes?: string | null;
  updatedAt?: string;
};

export type ConversationContext = {
  contact: WhatsAppContact;
  conversation: WhatsAppConversation;
  patient: Patient | null;
  state: ConversationState;
};

/** Busca o crea el contacto, lo vincula al paciente por teléfono y abre (o reutiliza) una conversación. */
export async function resolveConversation(admin: AdminSupabaseClient, inbound: NormalizedInbound): Promise<ConversationContext> {
  let { data: contact } = await admin.from("whatsapp_contacts").select("*").eq("phone", inbound.fromPhoneE164).maybeSingle();
  const patient = await getPatientByPhone(admin, inbound.fromPhoneE164);

  if (!contact) {
    const { data: created, error } = await admin
      .from("whatsapp_contacts")
      .insert({ phone: inbound.fromPhoneE164, wa_id: inbound.waId, display_name: inbound.displayName, patient_id: patient?.id ?? null, last_inbound_at: inbound.timestamp.toISOString() })
      .select("*")
      .single();
    if (error) throw error;
    contact = created;
  } else {
    await admin
      .from("whatsapp_contacts")
      .update({ last_inbound_at: inbound.timestamp.toISOString(), display_name: contact.display_name ?? inbound.displayName, patient_id: contact.patient_id ?? patient?.id ?? null, wa_id: contact.wa_id ?? inbound.waId })
      .eq("id", contact.id);
  }

  // Conversación abierta reciente (últimas 24 h) o nueva.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  let { data: conversation } = await admin
    .from("whatsapp_conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .neq("status", "closed")
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) {
    const { data: created, error } = await admin
      .from("whatsapp_conversations")
      .insert({ contact_id: contact.id, status: "open", state: {}, last_message_at: inbound.timestamp.toISOString() })
      .select("*")
      .single();
    if (error) throw error;
    conversation = created;
  }

  return { contact, conversation, patient, state: (conversation.state as ConversationState | null) ?? {} };
}

export async function recordInbound(admin: AdminSupabaseClient, ctx: ConversationContext, inbound: NormalizedInbound, intent?: string | null, confidence?: number | null) {
  const { error } = await admin.from("whatsapp_messages").insert({
    conversation_id: ctx.conversation.id,
    contact_id: ctx.contact.id,
    direction: "inbound",
    wa_message_id: inbound.waMessageId,
    message_type: inbound.rawType,
    body: inbound.text || null,
    payload: inbound.payloadId ? { payload_id: inbound.payloadId } : null,
    intent: intent ?? null,
    confidence: confidence ?? null,
    status: "received",
  });
  if (error && error.code !== "23505") log.warn("No se pudo registrar el mensaje entrante", errorMeta(error));
  await admin.from("whatsapp_conversations").update({ last_message_at: inbound.timestamp.toISOString(), current_intent: intent ?? ctx.conversation.current_intent }).eq("id", ctx.conversation.id);
}

export async function recordOutbound(admin: AdminSupabaseClient, ctx: ConversationContext, body: string, result: { ok: true; messageId: string } | { ok: false; error: string }, kind = "reply", appointmentId?: string | null) {
  const { error } = await admin.from("whatsapp_messages").insert({
    conversation_id: ctx.conversation.id,
    contact_id: ctx.contact.id,
    direction: "outbound",
    wa_message_id: result.ok ? result.messageId : null,
    message_type: "text",
    body,
    kind,
    appointment_id: appointmentId ?? null,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
    sent_at: result.ok ? new Date().toISOString() : null,
  });
  if (error) log.warn("No se pudo registrar el mensaje saliente", errorMeta(error));
  await admin.from("whatsapp_contacts").update({ last_outbound_at: new Date().toISOString() }).eq("id", ctx.contact.id);
  await admin.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", ctx.conversation.id);
}

export async function saveState(admin: AdminSupabaseClient, ctx: ConversationContext, state: ConversationState, patch: Partial<Pick<WhatsAppConversation, "status" | "current_intent" | "crisis_flagged_at" | "handed_off_at">> = {}) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await admin.from("whatsapp_conversations").update({ state: next as never, ...patch }).eq("id", ctx.conversation.id);
  ctx.state = next;
}

export async function updateDeliveryStatus(admin: AdminSupabaseClient, waMessageId: string, status: string, error: string | null) {
  const mapped = status === "failed" ? "failed" : status === "read" ? "read" : status === "delivered" ? "delivered" : "sent";
  await admin.from("whatsapp_messages").update({ status: mapped, error }).eq("wa_message_id", waMessageId);
}
