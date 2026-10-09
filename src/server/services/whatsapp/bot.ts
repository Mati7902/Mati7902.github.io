import "server-only";

import { addDays } from "date-fns";

import { formatLongDate, formatTime, capitalize, toDateKey } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger, errorMeta } from "@/lib/logger";
import { groupSlotsByPeriod, type Slot } from "@/lib/scheduling/slots";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { buildCrisisMessage, detectCrisis } from "@/server/services/ai/crisis";
import { getAIProvider, type IntentKey, type IntentResult } from "@/server/services/ai/provider";
import { assertSlotAvailable, cancelAppointment, canPatientModify, confirmAppointment, createAppointment, getAvailableSlots, initialStatusForPatientBooking, rescheduleAppointment } from "@/server/services/appointments";
import { createNotification } from "@/server/services/notifications";
import { getSettings } from "@/server/services/settings";
import { isWhatsAppConfigured, markAsRead, sendInteractiveButtons, sendInteractiveList, sendText, type SendResult } from "@/server/services/whatsapp/client";
import {
  asksForAnotherAppointment,
  asksForProfessional,
  classifyCancelAnswer,
  isBareConfirm,
  isBareNo,
  isBareTimeChoice,
  isBareYes,
  isCrisisHandoff,
  mentionsNotify,
  refersToExistingAppointment,
  slotKey,
  slotKeyToDate,
} from "@/server/services/whatsapp/answers";
import { type ConversationContext, type ConversationState, recordInbound, recordOutbound, resolveConversation, saveState } from "@/server/services/whatsapp/conversation";
import { renderTemplate, getTemplate } from "@/server/services/whatsapp/templates";
import type { NormalizedInbound } from "@/server/services/whatsapp/webhook";
import { ACTIVE_APPOINTMENT_STATUSES, MODALITY_LABEL, type Appointment } from "@/types/domain";

const log = createLogger("whatsapp.bot");

type Settings = Awaited<ReturnType<typeof loadSettings>>;
async function loadSettings(admin: AdminSupabaseClient) {
  return getSettings(admin, ["site.identity", "scheduling", "whatsapp", "emergency"] as const);
}

type Reply =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: { id: string; title: string }[]; footer?: string }
  | { kind: "list"; body: string; button: string; section: string; rows: { id: string; title: string; description?: string }[] };

/**
 * Punto de entrada: procesa un mensaje entrante ya normalizado.
 * Flujo: identificación → crisis → payload de botón → flujo activo → clasificación de intención →
 * validación → consulta/acción en backend → respuesta → registro.
 * La IA solo interpreta; cada acción sensible se valida y ejecuta en el backend.
 */
export async function handleInboundMessage(inbound: NormalizedInbound): Promise<void> {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const ctx = await resolveConversation(admin, inbound);
  const tz = settings.scheduling.timezone;

  if (!settings.whatsapp.enabled || !isWhatsAppConfigured()) {
    await recordInbound(admin, ctx, inbound, "DISABLED");
    return;
  }
  if (ctx.contact.opted_out) {
    // La baja es de los mensajes automáticos: un mensaje con señales de crisis igual recibe el
    // protocolo y se avisa al profesional.
    if (inbound.type !== "unsupported" && detectCrisis(inbound.text).detected) {
      await recordInbound(admin, ctx, inbound, "CRISIS", 1);
      await handleCrisis(admin, ctx, settings);
      return;
    }
    await recordInbound(admin, ctx, inbound, "OPTED_OUT");
    return;
  }
  void markAsRead(inbound.waMessageId);

  // 0) Conversación derivada al profesional (crisis o pedido de hablar con una persona):
  //    la asistente deja de responder con menús automáticos.
  if (ctx.conversation.status === "handed_off") {
    const handled = await handleHandedOff(admin, ctx, settings, inbound);
    if (handled) return;
  }

  if (inbound.type === "unsupported") {
    await recordInbound(admin, ctx, inbound, "UNSUPPORTED");
    // kind propio: no reemplaza a la última pregunta pendiente (ver lastOutbound).
    await reply(admin, ctx, { kind: "text", body: "Por ahora solo puedo leer mensajes de texto. ¿En qué te puedo ayudar con tu agenda?" }, UNSUPPORTED_KIND);
    return;
  }

  // Un flujo a medias de hace horas no captura mensajes nuevos (ni listas viejas).
  if (ctx.state.flow && ctx.state.updatedAt && Date.now() - Date.parse(ctx.state.updatedAt) > FLOW_TTL_MS) {
    await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null, pendingYes: ctx.state.pendingYes ?? null });
  }

  // 1) Crisis: siempre primero, por reglas (nunca depende de la IA).
  const crisis = detectCrisis(inbound.text);
  if (crisis.detected) {
    await recordInbound(admin, ctx, inbound, "CRISIS", 1);
    await handleCrisis(admin, ctx, settings);
    return;
  }

  // 2) Respuestas estructuradas de botones/listas: no hace falta IA.
  if (inbound.payloadId) {
    await recordInbound(admin, ctx, inbound, `PAYLOAD:${inbound.payloadId.split(":")[0]}`, 1);
    await handlePayload(admin, ctx, settings, inbound.payloadId);
    return;
  }

  // 2b) "Sí" escrito a la última pregunta de sí/no ("¿Le aviso al profesional?"): equivale al botón.
  const yesPayload = await pendingYesPayload(admin, ctx, inbound.text, ["yes_no"]);
  if (yesPayload) {
    await recordInbound(admin, ctx, inbound, `YES:${yesPayload.split(":")[0]}`, 1);
    await saveState(admin, ctx, { ...ctx.state, pendingYes: null });
    await handlePayload(admin, ctx, settings, yesPayload);
    return;
  }

  // 2c) "Sí"/"confirmo" escrito justo después de un pedido de confirmación (recordatorio, aviso de
  //     cambio o "¿Confirmás tu asistencia?"): confirma ESE turno. En cualquier otro contexto, un
  //     "sí" suelto no confirma nada (ver askConfirmAttendance).
  const confirmTarget = await confirmReplyTarget(admin, ctx, inbound.text);
  if (confirmTarget) {
    await recordInbound(admin, ctx, inbound, "CONFIRM_REPLY", 1);
    await doConfirm(admin, ctx, settings, confirmTarget, { strict: true });
    return;
  }

  // 3) Clasificación (IA o reglas) con contexto mínimo.
  const provider = await getAIProvider();
  const todayKey = toDateKey(new Date(), tz);
  const { data: recent } = await admin
    .from("whatsapp_messages")
    .select("direction, body")
    .eq("conversation_id", ctx.conversation.id)
    .order("created_at", { ascending: false })
    .limit(6);
  let intent: IntentResult;
  try {
    intent = await provider.classifyIntent({
      message: inbound.text,
      todayDateKey: todayKey,
      timezone: tz,
      activeFlow: ctx.state.flow ?? null,
      recentMessages: (recent ?? []).reverse().map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", text: m.body ?? "" })),
    });
  } catch (error) {
    log.warn("Clasificación falló", errorMeta(error));
    intent = { intent: "OTHER", confidence: 0, clinical_content: false, crisis_signal: false };
  }
  if (intent.crisis_signal) {
    await recordInbound(admin, ctx, inbound, "CRISIS", intent.confidence);
    await handleCrisis(admin, ctx, settings);
    return;
  }
  await recordInbound(admin, ctx, inbound, intent.intent, intent.confidence);

  // 4) Flujo activo (slot filling) tiene prioridad si el mensaje no cambia claramente de tema.
  //    Una pregunta de cancelación pendiente se responde dentro del flujo, salvo que haya vencido
  //    (30 min) o que la persona pida hablar con el profesional.
  if (ctx.state.flow === "cancel") {
    if ((await hasPendingCancelPrompt(admin, ctx)) && intent.intent !== "SPEAK_TO_HUMAN") {
      await continueCancel(admin, ctx, settings, inbound.text, intent.intent);
      return;
    }
    if (ctx.state.flow === "cancel") await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
  }
  if (ctx.state.flow && !["CANCEL_APPOINTMENT", "SPEAK_TO_HUMAN", "GREETING", "THANKS"].includes(intent.intent)) {
    const handled = await continueFlow(admin, ctx, settings, inbound.text, intent);
    if (handled) return;
  }

  const threshold = settings.whatsapp.ai_confidence_threshold;
  const effective: IntentKey = intent.confidence >= threshold ? intent.intent : "OTHER";
  // "No voy a poder ir" o "quiero cambiarla" en respuesta a un recordatorio se refieren a ESE turno.
  const about = ["CONFIRM_APPOINTMENT", "CANCEL_APPOINTMENT", "RESCHEDULE_APPOINTMENT"].includes(effective) ? await contextAppointmentId(admin, ctx) : null;
  await handleIntent(admin, ctx, settings, effective, intent, inbound.text, about);
}

/**
 * Payload del "sí" escrito a una pregunta pendiente. Cuenta si esa pregunta es lo último enviado
 * (de uno de los kinds dados) o, si el texto la nombra ("sí, avisale"), aunque después haya
 * llegado otro mensaje (por ejemplo, un recordatorio).
 */
async function pendingYesPayload(admin: AdminSupabaseClient, ctx: ConversationContext, text: string, kinds: string[]): Promise<string | null> {
  if (!ctx.state.pendingYes || !isBareYes(text)) return null;
  const fresh = (m: { at: number } | null) => Boolean(m && Date.now() - m.at <= YES_NO_TTL_MS);
  const last = await lastOutbound(admin, ctx);
  if (last && kinds.includes(last.kind ?? "") && fresh(last)) return ctx.state.pendingYes;
  if (mentionsNotify(text) && fresh(await lastOutbound(admin, ctx, kinds))) return ctx.state.pendingYes;
  return null;
}

/** Turno que confirma un "sí"/"confirmo" escrito: el del pedido de confirmación que se acaba de enviar. */
async function confirmReplyTarget(admin: AdminSupabaseClient, ctx: ConversationContext, text: string): Promise<string | null> {
  if (!isBareConfirm(text)) return null;
  const last = await lastOutbound(admin, ctx);
  return last?.appointmentId && last.kind && CONFIRM_REQUEST_KINDS.has(last.kind) && Date.now() - last.at <= YES_NO_TTL_MS ? last.appointmentId : null;
}

/** Turno del último aviso enviado (recordatorio, cambio), si sigue vigente: a ese se refiere la respuesta. */
async function contextAppointmentId(admin: AdminSupabaseClient, ctx: ConversationContext): Promise<string | null> {
  if (!ctx.patient) return null;
  const last = await lastOutbound(admin, ctx);
  if (!last?.appointmentId || !last.kind || !CONTEXT_KINDS.has(last.kind) || Date.now() - last.at > YES_NO_TTL_MS) return null;
  const { data } = await admin.from("appointments").select("*").eq("id", last.appointmentId).eq("patient_id", ctx.patient.id).maybeSingle();
  return data && isLive(data) ? data.id : null;
}

/** Turno activo y que todavía no terminó. */
function isLive(a: Appointment): boolean {
  return ACTIVE_APPOINTMENT_STATUSES.includes(a.status) && Date.parse(a.end_time) > Date.now();
}

/** Respuesta para un botón viejo sobre un turno cancelado o que ya pasó. */
function notLiveReply(admin: AdminSupabaseClient, ctx: ConversationContext, a: Appointment) {
  const body = a.status === "cancelled" ? "Ese turno ya está cancelado. ¿Querés agendar uno nuevo?" : "Ese turno ya no está vigente. ¿Querés agendar uno nuevo?";
  return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
}

/* ------------------------------------------------------------------------ */
/* Respuestas                                                                */
/* ------------------------------------------------------------------------ */
async function reply(admin: AdminSupabaseClient, ctx: ConversationContext, message: Reply, kind = "reply", appointmentId?: string | null): Promise<SendResult> {
  const to = ctx.contact.phone;
  let result: SendResult;
  if (message.kind === "buttons") result = await sendInteractiveButtons(to, message.body, message.buttons, message.footer);
  else if (message.kind === "list") result = await sendInteractiveList(to, message.body, message.button, message.section, message.rows);
  else result = await sendText(to, message.body);
  await recordOutbound(admin, ctx, message.body, result, kind, appointmentId);
  return result;
}

/**
 * Pregunta de sí/no con un único botón de acción (p. ej. "¿Le aviso al profesional?").
 * Un "sí" escrito como respuesta equivale a tocar el botón (ver handleInboundMessage).
 * Con keepFlow, la reserva o reprogramación en curso sigue activa (p. ej. "no hay horarios ese día":
 * la persona todavía puede pedir otro día sin perder qué turno estaba cambiando).
 */
async function askYesNo(admin: AdminSupabaseClient, ctx: ConversationContext, body: string, button: { id: string; title: string }, options: { keepFlow?: boolean } = {}) {
  const base: ConversationState = options.keepFlow ? ctx.state : { flow: null, step: null, offered: [], appointmentId: null };
  await saveState(admin, ctx, { ...base, pendingYes: button.id });
  return reply(admin, ctx, { kind: "buttons", body, buttons: [button] }, "yes_no");
}

function firstName(ctx: ConversationContext): string | null {
  return ctx.patient?.first_name ?? ctx.contact.display_name?.split(" ")[0] ?? null;
}

function greet(ctx: ConversationContext, settings: Settings): string {
  const name = firstName(ctx);
  const base = settings.whatsapp.greeting || `Hola. Soy la asistente virtual del ${settings["site.identity"].professional_name}.`;
  return name ? base.replace(/^Hola\.?/, `Hola, ${name}.`) : base;
}

const CANCEL_PROMPT_TTL_MS = 30 * 60_000;
/** Un "sí" escrito vale como respuesta a "¿Le aviso al profesional?" durante un día. */
const YES_NO_TTL_MS = 24 * 3600_000;
/** Un flujo de reserva/reprogramación sin actividad por más de 2 horas se descarta. */
const FLOW_TTL_MS = 2 * 3600_000;
/** Respuesta automática a audios, fotos, etc.: no cuenta como "último mensaje" para las preguntas pendientes. */
const UNSUPPORTED_KIND = "unsupported";
/** Mensajes que piden confirmar un turno con un botón "Confirmar" (ver appointment-notifications). */
const CONFIRM_REQUEST_KINDS = new Set(["reminder_24h", "appointment_changed", "request_approved", "booking_registered", "confirm_prompt"]);
/** Mensajes sobre un turno concreto: una respuesta escrita inmediata ("no voy a poder ir") se refiere a ese turno. */
const CONTEXT_KINDS = new Set([...CONFIRM_REQUEST_KINDS, "reminder_2h", "booking_requested", "booking_confirmation", "confirmation"]);

const MAIN_MENU = [
  { id: "MENU:BOOK", title: "Agendar sesión" },
  { id: "MENU:AVAIL", title: "Ver horarios" },
  { id: "MENU:INFO", title: "Planes y precios" },
];

/* ------------------------------------------------------------------------ */
/* Crisis                                                                    */
/* ------------------------------------------------------------------------ */
async function handleCrisis(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  const { data: resources } = await admin.from("emergency_resources").select("name, phone, url").eq("is_active", true).order("sort_order");
  const body = buildCrisisMessage({
    message: settings.emergency.message,
    contactNote: settings.emergency.contact_note,
    showContactProfessional: settings.emergency.show_contact_professional,
    resources: resources ?? [],
    professionalName: settings["site.identity"].professional_name,
  });
  const now = new Date().toISOString(); // mismo instante: la derivación vigente es "por crisis"
  // Se descarta cualquier flujo en curso (incluida la lista de horarios ofrecidos). Un "sí" escrito
  // a "Avisar al psicólogo" equivale al botón (ver handleHandedOff).
  const pendingYes = settings.emergency.show_contact_professional ? "HUMAN:CRISIS" : null;
  await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null, pendingYes }, { crisis_flagged_at: now, status: "handed_off", handed_off_at: now });
  await reply(admin, ctx, settings.emergency.show_contact_professional
    ? { kind: "buttons", body, buttons: [{ id: "HUMAN:CRISIS", title: "Avisar al psicólogo" }] }
    : { kind: "text", body }, "crisis");
  await notifyAdminsHandoff(admin, ctx, "Posible situación de crisis detectada en WhatsApp. Revisá la conversación cuanto antes.", "crisis");
}

type HandoffReason = "crisis" | "human_request" | "message" | "reschedule_request";

/**
 * Aviso al profesional. `about` distingue pedidos del mismo motivo (cancelación, cambio, crisis…):
 * la deduplicación es por motivo y tema, así un pedido nunca tapa a otro distinto.
 */
async function notifyAdminsHandoff(admin: AdminSupabaseClient, ctx: ConversationContext, body: string, reason: HandoffReason, about = "GENERAL") {
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["admin", "professional"]).eq("is_active", true);
  const who = ctx.patient ? `${ctx.patient.first_name} ${ctx.patient.last_name}` : (ctx.contact.display_name ?? ctx.contact.phone);
  for (const a of admins ?? []) {
    await createNotification(admin, { userId: a.id, type: "system", title: `WhatsApp: ${who}`, body, data: { conversation_id: ctx.conversation.id, contact_id: ctx.contact.id, reason, about } });
  }
}

/** Avisa un pedido de hablar con el profesional, salvo que el mismo pedido se haya avisado hace menos de 10 minutos. */
async function notifyHumanRequest(admin: AdminSupabaseClient, ctx: ConversationContext, about: string | null, crisisThread: boolean) {
  const topic = about ?? "GENERAL";
  if ((await msSinceLastNotification(admin, ctx, "human_request", topic)) > HUMAN_RENOTIFY_MS) {
    await notifyAdminsHandoff(admin, ctx, humanRequestNotice(about, crisisThread), "human_request", topic);
  }
}

/** Texto del aviso al profesional según desde dónde se pidió hablar con él (argumento del botón HUMAN). */
function humanRequestNotice(about: string | null, crisisThread: boolean): string {
  const fromCrisis = crisisThread ? " desde una conversación con señales de crisis" : "";
  if (about === "CRISIS") return "Pidió que le avises desde el mensaje de crisis. Escribile cuanto antes.";
  if (about === "CANCEL") return `Pidió que coordines personalmente la cancelación de un turno${fromCrisis}.`;
  if (about === "RESCHEDULE") return `Pidió que coordines personalmente el cambio de un turno${fromCrisis}.`;
  if (about === "NOSLOTS") return `No encontró horarios libres y pidió que le ofrezcas una alternativa${fromCrisis}.`;
  if (about === "NEW") return "Escribió desde un número que no corresponde a ningún paciente y pidió que se pongan en contacto.";
  if (about === "LOGIN") return "No puede ingresar a la app y pidió ayuda por WhatsApp.";
  if (crisisThread) return "Pidió que le avises desde el mensaje de crisis. Escribile cuanto antes.";
  return "Pidió hablar con el profesional por WhatsApp.";
}

/** Milisegundos desde el último aviso al profesional por esta conversación (opcionalmente, de un motivo y tema). */
async function msSinceLastNotification(admin: AdminSupabaseClient, ctx: ConversationContext, reason?: HandoffReason, about?: string): Promise<number> {
  let query = admin.from("notifications").select("created_at").eq("data->>conversation_id", ctx.conversation.id);
  if (reason) query = query.eq("data->>reason", reason);
  if (about) query = query.eq("data->>about", about);
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? Date.now() - new Date(data.created_at).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * Último mensaje enviado a este contacto: por el contacto (no por la conversación) para incluir los
 * avisos del sistema (recordatorios, cambios de turno), que se registran sin conversación.
 * La respuesta automática a audios o fotos no cuenta: no reemplaza la pregunta pendiente.
 */
async function lastOutbound(admin: AdminSupabaseClient, ctx: ConversationContext, kinds?: string[]): Promise<{ kind: string | null; at: number; appointmentId: string | null } | null> {
  let query = admin
    .from("whatsapp_messages")
    .select("kind, created_at, appointment_id")
    .eq("contact_id", ctx.contact.id)
    .eq("direction", "outbound")
    .neq("status", "failed") // un mensaje que no llegó no es lo último que vio la persona
    .or(`kind.is.null,kind.neq.${UNSUPPORTED_KIND}`);
  if (kinds) query = query.in("kind", kinds);
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { kind: data.kind, at: new Date(data.created_at).getTime(), appointmentId: data.appointment_id } : null;
}

/**
 * Una respuesta escrita se toma como respuesta a "¿Querés cancelar…?" solo si esa pregunta es lo
 * último que envió la asistente y tiene menos de 30 minutos. Si no, la pregunta se descarta.
 */
async function hasPendingCancelPrompt(admin: AdminSupabaseClient, ctx: ConversationContext): Promise<boolean> {
  if (ctx.state.flow !== "cancel") return false;
  const askedAt = ctx.state.updatedAt ? Date.parse(ctx.state.updatedAt) : 0;
  const last = await lastOutbound(admin, ctx);
  const valid = ctx.state.step === "confirm" && Date.now() - askedAt <= CANCEL_PROMPT_TTL_MS && last?.kind === "cancel_prompt";
  if (!valid) await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
  return valid;
}

const HANDOFF_EXPIRY_MS = 24 * 3600_000;
const HANDOFF_ACK_INTERVAL_MS = 60 * 60_000;
const HUMAN_RENOTIFY_MS = 10 * 60_000;
const TAP_ACK_MIN_INTERVAL_MS = 60_000;
/** Respuestas a mensajes del propio sistema sobre un turno (recordatorios, cambios, reprogramación en curso). */
const APPOINTMENT_PAYLOADS = new Set(["CONFIRM", "CANCEL", "CANCELYES", "CANCELNO", "RESCHEDULE", "DATE", "DATES", "NEWDATE", "SLOT"]);
/** En una derivación por crisis solo se aceptan acciones de un paso sobre un turno (nada de flujos con menús). */
const CRISIS_SAFE_PAYLOADS = new Set(["CONFIRM", "CANCEL", "CANCELYES", "CANCELNO"]);
/** Mensajes que ya le dicen a la persona que el profesional fue avisado. */
const ACK_KINDS = new Set(["handoff_ack", "handoff", "crisis"]);

/** Avisa al profesional de un mensaje nuevo en una conversación derivada (en crisis, con más frecuencia). */
async function notifyNewMessage(admin: AdminSupabaseClient, ctx: ConversationContext, crisisThread: boolean, what = "Nuevo mensaje") {
  const interval = crisisThread ? HUMAN_RENOTIFY_MS : HANDOFF_ACK_INTERVAL_MS;
  if ((await msSinceLastNotification(admin, ctx)) > interval) {
    await notifyAdminsHandoff(admin, ctx, `${what} en una conversación ${crisisThread ? "con señales de crisis" : "derivada"}.`, "message");
  }
}

/**
 * Conversación derivada: el profesional se ocupa personalmente. La asistente no ofrece menús ni
 * turnos por iniciativa propia (sería frío e inadecuado tras una crisis). Reglas:
 *  - una nueva señal de crisis re-envía el protocolo,
 *  - un pedido explícito de avisar al profesional (botón, "sí" escrito o "quiero hablar con el
 *    psicólogo" durante una pregunta pendiente) siempre recibe respuesta; el mismo pedido se avisa
 *    como máximo una vez cada 10 minutos (pedidos distintos se avisan siempre),
 *  - un audio o una foto siempre reciben respuesta (no se pueden leer),
 *  - "sí"/"confirmo" escrito a un recordatorio confirma ese turno, igual que fuera de la derivación,
 *  - derivación común: tocar un botón de un turno (recordatorio, aviso) o "Volver al menú"
 *    retoma la conversación con la asistente,
 *  - derivación por crisis: solo se aceptan confirmar/cancelar un turno (acciones de un paso) y la
 *    respuesta escrita a una pregunta pendiente; los cambios de horario los coordina el profesional,
 *  - cualquier otro botón recibe un acuse inmediato; los mensajes escritos, como máximo uno por hora.
 * A las 24 h sin novedades la derivación vence y la conversación vuelve a la normalidad.
 * Devuelve false si la conversación debe procesarse normalmente.
 */
async function handleHandedOff(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, inbound: NormalizedInbound): Promise<boolean> {
  // "Sin novedades": se cuenta desde el último mensaje de la conversación, no desde que empezó.
  const handedOffAt = ctx.conversation.handed_off_at ? Date.parse(ctx.conversation.handed_off_at) : 0;
  const lastActivity = Math.max(handedOffAt, ctx.conversation.last_message_at ? Date.parse(ctx.conversation.last_message_at) : 0);
  if (Date.now() - lastActivity > HANDOFF_EXPIRY_MS) {
    await saveState(admin, ctx, { flow: null, step: null }, { status: "open" });
    ctx.conversation = { ...ctx.conversation, status: "open" };
    return false;
  }

  const isCrisisThread = isCrisisHandoff(ctx.conversation);
  const professional = settings["site.identity"].professional_name;
  if (inbound.type !== "unsupported" && detectCrisis(inbound.text).detected) {
    await recordInbound(admin, ctx, inbound, "CRISIS", 1);
    await handleCrisis(admin, ctx, settings);
    return true;
  }

  // Audio, foto, etc.: no se puede leer, así que siempre se responde (sin contar como acuse).
  if (inbound.type === "unsupported") {
    await recordInbound(admin, ctx, inbound, "UNSUPPORTED");
    await notifyNewMessage(admin, ctx, isCrisisThread, "Nuevo audio o archivo");
    const body = isCrisisThread
      ? `No puedo escuchar audios ni ver archivos, pero ya le avisé al ${professional}. Si podés, escribime en texto. ${settings.emergency.message}`.trim()
      : `No puedo escuchar audios ni ver archivos, pero ya le avisé al ${professional}; te va a escribir personalmente.`;
    await reply(admin, ctx, { kind: "text", body }, UNSUPPORTED_KIND);
    return true;
  }

  // Un "sí" escrito a la última pregunta de sí/no ("¿Le aviso?", "Avisar al psicólogo") equivale al botón.
  let payloadId = inbound.payloadId;
  if (!payloadId) {
    const yes = await pendingYesPayload(admin, ctx, inbound.text, ["yes_no", "crisis"]);
    if (yes) {
      payloadId = yes;
      await saveState(admin, ctx, { ...ctx.state, pendingYes: null });
    }
  }

  // "Sí"/"confirmo" a un recordatorio confirma ese turno también durante una derivación.
  if (!payloadId) {
    const target = await confirmReplyTarget(admin, ctx, inbound.text);
    if (target) {
      await recordInbound(admin, ctx, inbound, "CONFIRM_REPLY", 1);
      await doConfirm(admin, ctx, settings, target, { strict: true });
      return true;
    }
  }

  // Derivación común: el contacto vuelve a usar la asistente (menú o botón de un turno).
  let action = payloadId ? payloadId.split(":")[0]! : null;
  if (!isCrisisThread && payloadId && (payloadId === "RESUME:BOT" || (action && APPOINTMENT_PAYLOADS.has(action)))) {
    await recordInbound(admin, ctx, inbound, `PAYLOAD:${action}`, 1);
    await saveState(admin, ctx, ctx.state, { status: "open" });
    ctx.conversation = { ...ctx.conversation, status: "open" };
    await handlePayload(admin, ctx, settings, payloadId);
    return true;
  }

  // Derivación por crisis: confirmar o cancelar un turno sigue funcionando, sin levantar la derivación.
  if (isCrisisThread && payloadId && action && CRISIS_SAFE_PAYLOADS.has(action)) {
    await recordInbound(admin, ctx, inbound, `PAYLOAD:${action}`, 1);
    await handlePayload(admin, ctx, settings, payloadId);
    return true;
  }
  if (isCrisisThread && !payloadId && (await hasPendingCancelPrompt(admin, ctx))) {
    if (asksForProfessional(inbound.text)) {
      // Pedir al profesional nunca se responde con otra pregunta sobre el turno.
      await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
      payloadId = "HUMAN:CRISIS";
      action = "HUMAN";
    } else {
      await recordInbound(admin, ctx, inbound, "CANCEL_ANSWER", 1);
      await continueCancel(admin, ctx, settings, inbound.text, null, { allowReschedule: false });
      return true;
    }
  }

  // Pregunta "¿Le aviso?" pendiente en una crisis: una respuesta que no es "sí" no se toma como sí,
  // ni se responde "ya le avisé" como si se hubiera transmitido el pedido.
  if (isCrisisThread && !payloadId && ctx.state.pendingYes) {
    const last = await lastOutbound(admin, ctx);
    if (last?.kind === "yes_no" && Date.now() - last.at <= YES_NO_TTL_MS) {
      await recordInbound(admin, ctx, inbound, "YES_NO_ANSWER", 1);
      await notifyNewMessage(admin, ctx, true);
      if (isBareNo(inbound.text)) {
        await saveState(admin, ctx, { ...ctx.state, pendingYes: null });
        await reply(admin, ctx, { kind: "text", body: `Entendido. ${settings.emergency.message}`.trim() }, "handoff_ack");
      } else {
        await reply(admin, ctx, { kind: "buttons", body: "¿Querés que le avise al profesional? Tocá el botón o respondé «sí».", buttons: [{ id: ctx.state.pendingYes, title: "Sí, avisale" }] }, "yes_no");
      }
      return true;
    }
  }

  if (action === "HUMAN") {
    await recordInbound(admin, ctx, inbound, "PAYLOAD:HUMAN", 1);
    // El mismo pedido repetido genera un solo aviso; pedidos distintos se avisan siempre. La persona siempre recibe respuesta.
    await notifyHumanRequest(admin, ctx, payloadId?.slice("HUMAN:".length) || null, isCrisisThread);
    await reply(
      admin,
      ctx,
      {
        kind: "text",
        body: isCrisisThread
          ? `Listo, ya le avisé al ${professional}. ${settings.emergency.message}`.trim()
          : settings.whatsapp.handoff_message || `Listo, ya le avisé al ${professional}; te va a escribir personalmente.`,
      },
      "handoff_ack",
    );
    return true;
  }

  if (isCrisisThread && action && APPOINTMENT_PAYLOADS.has(action)) {
    // Reprogramar implica elegir día y horario con menús: lo coordina el profesional.
    await recordInbound(admin, ctx, inbound, `PAYLOAD:${action}`, 1);
    // Un día u horario de una lista vieja puede ser de una reserva o de un cambio: el texto no lo asume.
    const isChange = action === "RESCHEDULE";
    await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null });
    if ((await msSinceLastNotification(admin, ctx, "reschedule_request")) > HUMAN_RENOTIFY_MS) {
      await notifyAdminsHandoff(
        admin,
        ctx,
        `Pidió ${isChange ? "cambiar un turno" : "agendar o cambiar un turno"} desde una conversación con señales de crisis. Coordinalo personalmente.`,
        "reschedule_request",
      );
    }
    await reply(admin, ctx, { kind: "text", body: `Le aviso al ${professional} para que coordine ${isChange ? "el cambio" : "el turno"} con vos personalmente. ${settings.emergency.message}`.trim() }, "handoff_ack");
    return true;
  }

  await recordInbound(admin, ctx, inbound, "HANDED_OFF");
  const last = await lastOutbound(admin, ctx);
  // El mensaje de derivación y el de crisis ya avisan que el profesional va a escribir: cuentan como acuse.
  const sinceLastAck = last && ACK_KINDS.has(last.kind ?? "") ? Date.now() - last.at : Number.POSITIVE_INFINITY;

  if (payloadId) {
    // Un botón siempre recibe respuesta, salvo toques repetidos justo después de un acuse.
    if (sinceLastAck < TAP_ACK_MIN_INTERVAL_MS) return true;
  } else {
    // Texto libre: el aviso al profesional depende del último AVISO real (no de cualquier mensaje)
    // y el acuse a la persona, del último acuse.
    await notifyNewMessage(admin, ctx, isCrisisThread);
    if (sinceLastAck < HANDOFF_ACK_INTERVAL_MS) return true;
  }
  if (isCrisisThread) {
    await reply(admin, ctx, { kind: "text", body: `Ya le avisé al ${professional}. ${settings.emergency.message}`.trim() }, "handoff_ack");
  } else {
    await reply(
      admin,
      ctx,
      { kind: "buttons", body: settings.whatsapp.handoff_message || "Ya le avisé al profesional; te va a escribir personalmente.", buttons: [{ id: "RESUME:BOT", title: "Volver al menú" }] },
      "handoff_ack",
    );
  }
  return true;
}

/* ------------------------------------------------------------------------ */
/* Payloads de botones                                                       */
/* ------------------------------------------------------------------------ */
async function handlePayload(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, payload: string) {
  // Se separa solo en el PRIMER ":" (los argumentos pueden contener ":").
  const sep = payload.indexOf(":");
  const action = sep === -1 ? payload : payload.slice(0, sep);
  const arg = sep === -1 ? undefined : payload.slice(sep + 1);
  switch (action) {
    case "MENU":
      if (arg === "BOOK") return startBooking(admin, ctx, settings, {});
      // "Ver horarios" del menú siempre es una consulta nueva (nunca continúa una reprogramación vieja).
      if (arg === "AVAIL") return startBooking(admin, ctx, settings, { onlyShow: true });
      if (arg === "INFO") return replyPlans(admin, ctx, settings);
      return;
    case "CONFIRM":
      return doConfirm(admin, ctx, settings, arg ?? null);
    case "CANCEL":
      return askCancelConfirmation(admin, ctx, settings, arg ?? null);
    case "CANCELYES":
      return doCancel(admin, ctx, settings, arg ?? null);
    case "CANCELNO":
      await saveState(admin, ctx, { ...ctx.state, flow: null, step: null, appointmentId: null });
      return reply(admin, ctx, { kind: "text", body: "Perfecto, tu turno sigue en pie." });
    case "RESCHEDULE": {
      // "RESCHEDULE:<id>" o "RESCHEDULE:<id>@<día>" (cambiar esa sesión al día que ya se eligió).
      const [id, day] = (arg ?? "").split("@");
      return startReschedule(admin, ctx, settings, id || null, day && isDateKey(day) ? day : null);
    }
    case "MOD":
      // Reprogramar mueve el horario, no cambia la modalidad: eso lo coordina el profesional.
      if (ctx.state.flow === "reschedule" && (arg === "presencial" || arg === "virtual") && arg !== ctx.state.modality) {
        const current = ctx.state.modality ? MODALITY_LABEL[ctx.state.modality].toLowerCase() : "actual";
        await reply(admin, ctx, { kind: "text", body: `El cambio de modalidad lo coordina el profesional. Sigo con el cambio de horario de tu sesión ${current}.` });
        return ctx.state.step === "slot" && ctx.state.dateKey ? offerSlots(admin, ctx, settings, ctx.state.dateKey) : offerDates(admin, ctx, settings);
      }
      if ((arg === "presencial" || arg === "virtual") && !settings.scheduling.modalities_enabled.includes(arg)) {
        const enabled = settings.scheduling.modalities_enabled.map((m) => MODALITY_LABEL[m].toLowerCase()).join(" o ");
        await reply(admin, ctx, { kind: "text", body: `Por ahora las sesiones son ${enabled || "a coordinar con el profesional"}.` });
        if (ctx.state.flow === "booking" || ctx.state.flow === "reschedule") return askModality(admin, ctx, settings);
        return startBooking(admin, ctx, settings, { onlyShow: !ctx.patient });
      }
      if (arg === "presencial" || arg === "virtual") {
        // Dentro de un flujo activo se conserva lo ya elegido (por ejemplo, el día pedido).
        if (ctx.state.flow === "booking" || ctx.state.flow === "reschedule") {
          const dateKey = ctx.state.flow === "booking" ? (ctx.state.dateKey ?? null) : null;
          await saveState(admin, ctx, { ...ctx.state, modality: arg, step: dateKey ? "slot" : "date" });
          return dateKey ? offerSlots(admin, ctx, settings, dateKey) : offerDates(admin, ctx, settings);
        }
        // Botón suelto (sin flujo): quien no es paciente igual puede ver horarios.
        return startBooking(admin, ctx, settings, { modality: arg, onlyShow: !ctx.patient || ctx.conversation.current_intent === "CHECK_AVAILABILITY" });
      }
      return;
    case "DATE":
      if (!arg || !isDateKey(arg)) return;
      if (ctx.state.flow === "booking" || ctx.state.flow === "reschedule") {
        await saveState(admin, ctx, { ...ctx.state, dateKey: arg, step: "slot" });
        return offerSlots(admin, ctx, settings, arg);
      }
      // Lista vieja sin un flujo activo: no se sabe si era una reserva o un cambio de turno.
      return startFromStaleList(admin, ctx, settings, arg);
    case "DATES":
      // "Otros días": conserva la reserva o reprogramación en curso.
      if (ctx.state.flow === "booking" || ctx.state.flow === "reschedule") {
        await saveState(admin, ctx, { ...ctx.state, step: "date", dateKey: null, offered: [] });
        return offerDates(admin, ctx, settings);
      }
      return startFromStaleList(admin, ctx, settings, null);
    case "NEWDATE":
      // Respuesta a "¿Sesión nueva o cambiar la que tenés?": sesión nueva para ese día.
      return startBooking(admin, ctx, settings, { dateKey: arg && isDateKey(arg) ? arg : null });
    case "SLOT":
      return chooseSlot(admin, ctx, settings, arg ?? null);
    case "HUMAN":
      return handOff(admin, ctx, settings, arg ?? null);
    case "RESUME":
      await saveState(admin, ctx, { flow: null, step: null }, { status: "open" });
      return reply(admin, ctx, { kind: "buttons", body: "Listo, sigo por acá. ¿Qué necesitás?", buttons: MAIN_MENU });
    case "STOP":
      await admin.from("whatsapp_contacts").update({ opted_out: true }).eq("id", ctx.contact.id);
      return reply(admin, ctx, { kind: "text", body: "Listo. No vas a recibir más mensajes automáticos por este medio." });
    default:
      return reply(admin, ctx, { kind: "buttons", body: "No reconocí esa opción. ¿Qué necesitás?", buttons: MAIN_MENU });
  }
}

/* ------------------------------------------------------------------------ */
/* Intenciones                                                               */
/* ------------------------------------------------------------------------ */
/**
 * `about`: turno al que se refiere el mensaje (el del recordatorio o aviso que se acaba de enviar);
 * si es null se usa el próximo turno del paciente.
 */
async function handleIntent(
  admin: AdminSupabaseClient,
  ctx: ConversationContext,
  settings: Settings,
  intent: IntentKey,
  details: IntentResult,
  text: string,
  about: string | null = null,
) {
  switch (intent) {
    case "GREETING":
      return reply(admin, ctx, { kind: "buttons", body: greet(ctx, settings), buttons: MAIN_MENU });
    case "THANKS":
      return reply(admin, ctx, { kind: "text", body: "De nada. Cuando necesites algo de la agenda, escribime por acá." });
    case "BOOK_APPOINTMENT":
      return startBooking(admin, ctx, settings, { modality: details.modality ?? null, dateKey: details.requested_date ?? null, timePreference: details.time_preference ?? null });
    case "CHECK_AVAILABILITY":
      return startBooking(admin, ctx, settings, { onlyShow: true, modality: details.modality ?? null, dateKey: details.requested_date ?? null, timePreference: details.time_preference ?? null });
    case "RESCHEDULE_APPOINTMENT":
      return startReschedule(admin, ctx, settings, about, details.requested_date ?? null);
    case "CANCEL_APPOINTMENT":
      return askCancelConfirmation(admin, ctx, settings, about);
    case "CONFIRM_APPOINTMENT":
      // Un "sí"/"confirmo" escrito puede responder a otra cosa: la confirmación se hace con el botón.
      return askConfirmAttendance(admin, ctx, settings, about);
    case "PRICING":
    case "PLANS":
      return replyPlans(admin, ctx, settings);
    case "LOCATION":
      return replyLocation(admin, ctx, settings);
    case "ONLINE_SESSION":
      return replyOnline(admin, ctx, settings);
    case "LOGIN_HELP":
      return replyLoginHelp(admin, ctx);
    case "SPEAK_TO_HUMAN":
      return handOff(admin, ctx, settings);
    case "OTHER":
    default: {
      if (details.clinical_content) {
        const body = settings.whatsapp.out_of_scope_message || `Gracias por contarlo. Por este medio puedo ayudarte principalmente con cuestiones administrativas y de agenda. Si querés, puedo ayudarte a reservar una sesión con el ${settings["site.identity"].professional_name}.`;
        return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }, { id: "HUMAN:ASK", title: "Hablar con él" }] });
      }
      log.debug("Mensaje no reconocido", { length: text.length });
      return reply(admin, ctx, { kind: "buttons", body: `${greet(ctx, settings)}\n\nNo estoy segura de haber entendido. ¿Qué necesitás?`, buttons: MAIN_MENU });
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Flujo de reserva                                                          */
/* ------------------------------------------------------------------------ */
type BookingHints = { onlyShow?: boolean; modality?: "presencial" | "virtual" | null; dateKey?: string | null; timePreference?: IntentResult["time_preference"] };

async function startBooking(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, hints: BookingHints) {
  if (!ctx.patient && !hints.onlyShow) {
    await saveState(admin, ctx, { flow: null, step: null });
    return reply(admin, ctx, {
      kind: "buttons",
      body: `Para agendar una sesión necesito identificarte. Este número no está asociado a ningún paciente. Si ya sos paciente, escribinos desde el número que registraste; si es tu primera vez, el ${settings["site.identity"].professional_name} se pone en contacto con vos.`,
      buttons: [{ id: "HUMAN:NEW", title: "Que me contacten" }, { id: "MENU:AVAIL", title: "Ver horarios" }],
    });
  }
  const enabled = settings.scheduling.modalities_enabled;
  const modality = hints.modality && enabled.includes(hints.modality) ? hints.modality : enabled.length === 1 ? enabled[0]! : null;
  const state: ConversationState = { flow: "booking", step: modality ? "date" : "modality", modality, dateKey: hints.dateKey ?? null, offered: [] };
  await saveState(admin, ctx, state, { current_intent: hints.onlyShow ? "CHECK_AVAILABILITY" : "BOOK_APPOINTMENT" });
  if (!modality) return askModality(admin, ctx, settings);
  if (state.dateKey) return offerSlots(admin, ctx, settings, state.dateKey, hints.timePreference ?? null);
  return offerDates(admin, ctx, settings);
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Toque en una lista de días sin un flujo activo (vencido, derivado o terminado). La lista no dice
 * si era una reserva o el cambio de un turno: si el paciente tiene una sesión próxima, se le pregunta
 * en vez de reservar una segunda sesión sin avisar.
 */
async function startFromStaleList(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, dateKey: string | null) {
  if (!ctx.patient) return startBooking(admin, ctx, settings, { dateKey, onlyShow: true });
  const upcoming = await findTargetAppointment(admin, ctx, null);
  if (!upcoming) return startBooking(admin, ctx, settings, { dateKey });
  const tz = settings.scheduling.timezone;
  const day = dateKey ? ` para el ${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))}` : "";
  return reply(admin, ctx, {
    kind: "buttons",
    body: `Ya tenés una sesión el ${describe(upcoming, tz)}. ¿Querés reservar otra sesión${day} o cambiar esa?`,
    buttons: [
      { id: dateKey ? `NEWDATE:${dateKey}` : "MENU:BOOK", title: "Sesión nueva" },
      { id: dateKey ? `RESCHEDULE:${upcoming.id}@${dateKey}` : `RESCHEDULE:${upcoming.id}`, title: "Cambiar esa sesión" },
    ],
  });
}

async function askModality(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  // Solo se ofrecen las modalidades habilitadas en la configuración.
  const buttons = [
    { id: "MOD:presencial", title: "Presencial", modality: "presencial" as const },
    { id: "MOD:virtual", title: "Videollamada", modality: "virtual" as const },
  ]
    .filter((b) => settings.scheduling.modalities_enabled.includes(b.modality))
    .map(({ id, title }) => ({ id, title }));
  if (buttons.length === 0) {
    return askYesNo(admin, ctx, "Por ahora no hay modalidades habilitadas para reservar. ¿Querés que le avise al profesional?", { id: "HUMAN:NOSLOTS", title: "Sí, avisale" }, { keepFlow: true });
  }
  return reply(admin, ctx, { kind: "buttons", body: "¿Cómo preferís la sesión?", buttons });
}

async function offerDates(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  const modality = ctx.state.modality ?? "presencial";
  const { days } = await getAvailableSlots({ modality, days: 14, excludeAppointmentId: ctx.state.appointmentId ?? undefined });
  if (days.length === 0) {
    return askYesNo(admin, ctx, "No encuentro horarios libres en las próximas dos semanas. ¿Querés que le avise al profesional para buscar una alternativa?", { id: "HUMAN:NOSLOTS", title: "Sí, avisale" }, { keepFlow: true });
  }
  const rows = days.slice(0, 10).map((d) => ({
    id: `DATE:${d.dateKey}`,
    title: capitalize(formatLongDate(`${d.dateKey}T12:00:00`, settings.scheduling.timezone)).slice(0, 24),
    description: `${d.slots.length} horario(s) · ${MODALITY_LABEL[modality]}`,
  }));
  return reply(admin, ctx, { kind: "list", body: "Estos son los próximos días con disponibilidad. ¿Cuál te queda mejor?", button: "Elegir día", section: "Días disponibles", rows });
}

async function offerSlots(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, dateKey: string, preference: IntentResult["time_preference"] = null) {
  const modality = ctx.state.modality ?? "presencial";
  const tz = settings.scheduling.timezone;
  const { days } = await getAvailableSlots({ modality, fromDateKey: dateKey, days: 1, excludeAppointmentId: ctx.state.appointmentId ?? undefined });
  let slots: Slot[] = days.find((d) => d.dateKey === dateKey)?.slots ?? [];
  if (preference && preference !== "any") {
    const groups = groupSlotsByPeriod(slots, tz);
    const preferred = preference === "morning" ? groups.morning : preference === "afternoon" ? groups.afternoon : groups.evening;
    if (preferred.length > 0) slots = preferred;
  }
  if (slots.length === 0) {
    await saveState(admin, ctx, { ...ctx.state, step: "date", dateKey: null });
    const alt = await getAvailableSlots({ modality, fromDateKey: toDateKey(addDays(new Date(`${dateKey}T12:00:00Z`), 1), tz), days: 7 });
    const next = alt.days[0];
    if (!next) return askYesNo(admin, ctx, `Para el ${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} no tengo lugar y tampoco en la semana siguiente. ¿Querés que le avise al profesional?`, { id: "HUMAN:NOSLOTS", title: "Sí, avisale" }, { keepFlow: true });
    return reply(admin, ctx, {
      kind: "buttons",
      body: `Para el ${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} no tengo lugar. El siguiente día con disponibilidad es el ${capitalize(formatLongDate(`${next.dateKey}T12:00:00`, tz))}.`,
      buttons: [{ id: `DATE:${next.dateKey}`, title: "Ver ese día" }, { id: "DATES", title: "Otros días" }],
    });
  }
  // Hasta 9 horarios: la lista admite 10 filas y la última es "Otros días".
  const offered = slots.slice(0, Math.min(settings.whatsapp.max_slots_to_offer, 9)).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: s.label }));
  await saveState(admin, ctx, { ...ctx.state, step: "slot", dateKey, offered });
  const body = `${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} · ${MODALITY_LABEL[modality]}. Tengo disponibles estos horarios:\n${offered.map((s) => `• ${s.label}`).join("\n")}\n¿Cuál preferís?`;
  // Id derivado del horario (no de la posición): un toque en una lista anterior no reserva otro horario.
  const rows = [...offered.map((s) => ({ id: `SLOT:${slotKey(s.start)}`, title: s.label, description: MODALITY_LABEL[modality] })), { id: "DATES", title: "Otros días", description: "Ver otras fechas" }];
  return reply(admin, ctx, { kind: "list", body, button: "Elegir horario", section: "Horarios", rows });
}

/**
 * Elige un horario de la última lista enviada por su clave (payload "SLOT:<yyyymmddThhmm>").
 * Si la clave no está en la lista vigente (lista vieja o formato anterior), no se reserva nada.
 */
async function chooseSlot(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, key: string | null) {
  const tz = settings.scheduling.timezone;
  const inFlow = ctx.state.flow === "booking" || ctx.state.flow === "reschedule";
  // Sin un flujo de reserva o reprogramación activo, una lista vieja nunca reserva nada.
  const slot = key && inFlow ? ctx.state.offered?.find((s) => slotKey(s.start) === key) : undefined;
  if (!slot) {
    const tapped = key ? slotKeyToDate(key) : null;
    if (inFlow && tapped && tapped.getTime() > Date.now()) {
      await reply(admin, ctx, { kind: "text", body: "Esa lista ya no está vigente. Te paso los horarios actualizados de ese día." });
      const dateKey = toDateKey(tapped, tz);
      await saveState(admin, ctx, { ...ctx.state, dateKey, step: "slot" });
      return offerSlots(admin, ctx, settings, dateKey);
    }
    // Sin flujo, la lista vieja pudo ser de una reserva o de un cambio: se pregunta (nunca se reserva a ciegas).
    if (!inFlow) {
      await reply(admin, ctx, { kind: "text", body: "Ese horario es de una lista que ya no está vigente." });
      return startFromStaleList(admin, ctx, settings, tapped && tapped.getTime() > Date.now() ? toDateKey(tapped, tz) : null);
    }
    // Dentro de un flujo, "Ver días" (DATES) lo conserva: una reprogramación sigue siendo reprogramación.
    return reply(admin, ctx, { kind: "buttons", body: "Ese horario ya no figura entre las opciones vigentes. ¿Querés ver los horarios de nuevo?", buttons: [{ id: "DATES", title: "Ver días" }] });
  }
  const modality = ctx.state.modality ?? "presencial";
  const start = new Date(slot.start);
  const when = `${capitalize(formatLongDate(start, tz))} a las ${formatTime(start, tz)}`;

  // Reprogramación: el turno puede haber cambiado desde que se ofrecieron los horarios
  // (cancelado por el profesional, o ya dentro de la ventana mínima). La RPC corre con
  // service_role, así que las reglas del paciente se vuelven a aplicar acá.
  if (ctx.state.flow === "reschedule") {
    const current = ctx.state.appointmentId ? await findTargetAppointment(admin, ctx, ctx.state.appointmentId) : null;
    if (!current || current.id !== ctx.state.appointmentId || !canPatientModify(current, settings.scheduling, "reschedule")) {
      await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null });
      return askYesNo(admin, ctx, "Este turno ya no se puede cambiar desde acá. ¿Querés que le avise al profesional para coordinarlo?", { id: "HUMAN:RESCHEDULE", title: "Sí, avisale" });
    }
  }

  try {
    // Segunda verificación de disponibilidad justo antes de confirmar (el fin lo define la grilla).
    const { settings: scheduling, end } = await assertSlotAvailable(start, modality, ctx.state.appointmentId ?? undefined);
    if (ctx.state.flow === "reschedule" && ctx.state.appointmentId) {
      const newStatus = scheduling.booking_mode === "auto" ? "confirmed" : "requested";
      const updated = await rescheduleAppointment(admin, { appointmentId: ctx.state.appointmentId, start, end, newStatus, reason: "Reprogramado por WhatsApp", source: "whatsapp" });
      await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null }, { current_intent: "RESCHEDULE_APPOINTMENT" });
      return reply(admin, ctx, { kind: "text", body: newStatus === "confirmed" ? `Listo. Tu sesión quedó reprogramada para el ${when} (${MODALITY_LABEL[updated.modality].toLowerCase()}).` : `Registré tu pedido de cambio para el ${when}. Te confirmo en cuanto el profesional lo apruebe.` }, "booking_confirmation", updated.id);
    }
    if (!ctx.patient) return startBooking(admin, ctx, settings, {});
    const status = initialStatusForPatientBooking(scheduling);
    const appointment = await createAppointment(admin, { patientId: ctx.patient.id, start, end, modality, status, source: "whatsapp" });
    await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null }, { current_intent: "BOOK_APPOINTMENT" });
    const body = status === "confirmed" ? `Tu turno quedó confirmado: ${when}, ${MODALITY_LABEL[modality].toLowerCase()}. Te recordamos un día antes.` : `Tu solicitud fue registrada: ${when}, ${MODALITY_LABEL[modality].toLowerCase()}. Te aviso en cuanto el profesional la confirme.`;
    return reply(admin, ctx, { kind: "text", body }, "booking_confirmation", appointment.id);
  } catch (error) {
    log.info("Reserva por WhatsApp rechazada", errorMeta(error));
    // Doble toque: otra ejecución ya reservó (o movió) este mismo horario para esta persona. No se
    // revive el flujo ni se ofrece otra lista, que podría terminar en un segundo turno.
    if (ctx.patient) {
      const { data: mine } = await admin
        .from("appointments")
        .select("id")
        .eq("patient_id", ctx.patient.id)
        .eq("start_time", start.toISOString())
        .in("status", ACTIVE_APPOINTMENT_STATUSES)
        .limit(1)
        .maybeSingle();
      if (mine) {
        await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null });
        return reply(admin, ctx, { kind: "text", body: `Ese horario ya quedó registrado a tu nombre: ${when}.` }, "reply", mine.id);
      }
    }
    const dateKey = ctx.state.dateKey ?? toDateKey(start, tz);
    const taken = error instanceof AppError && error.code === "CONFLICT";
    await reply(admin, ctx, { kind: "text", body: taken ? "Ese horario se acaba de ocupar. Te paso los que siguen disponibles." : "Ese horario ya no se puede reservar. Te paso los que siguen disponibles." });
    return offerSlots(admin, ctx, settings, dateKey);
  }
}

async function continueFlow(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, text: string, intent: IntentResult): Promise<boolean> {
  const state = ctx.state;
  // Las respuestas a una pregunta de cancelación se resuelven antes (hasPendingCancelPrompt).
  if (state.flow === "cancel") return false;
  // El mensaje contradice el flujo en curso ("quiero cambiar mi turno" durante una reserva, "quiero
  // sacar otro turno" durante una reprogramación): se pregunta antes de reservar o mover nada.
  if ((state.flow === "booking" && refersToExistingAppointment(text)) || (state.flow === "reschedule" && asksForAnotherAppointment(text))) {
    await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null });
    await startFromStaleList(admin, ctx, settings, intent.requested_date ?? state.dateKey ?? null);
    return true;
  }
  if (state.step === "modality" && intent.modality) {
    // Igual que el botón: si ya se pidió un día, se muestran directamente sus horarios.
    const dateKey = state.flow === "booking" ? (state.dateKey ?? null) : null;
    await saveState(admin, ctx, { ...state, modality: intent.modality, step: dateKey ? "slot" : "date" });
    if (dateKey) await offerSlots(admin, ctx, settings, dateKey);
    else await offerDates(admin, ctx, settings);
    return true;
  }
  if ((state.step === "date" || state.step === "slot") && intent.requested_date) {
    await saveState(admin, ctx, { ...state, dateKey: intent.requested_date, step: "slot" });
    await offerSlots(admin, ctx, settings, intent.requested_date, intent.time_preference ?? null);
    return true;
  }
  if (state.step === "slot" && intent.requested_time && state.dateKey) {
    if (!isBareTimeChoice(text)) {
      // Mencionó una hora sin elegirla ("a las 15 no puedo", "¿tenés algo después de las 17?"): no se reserva nada.
      await reply(admin, ctx, { kind: "text", body: "Para no equivocarme, elegí el horario tocándolo en la lista, o decime otro día." });
      await offerSlots(admin, ctx, settings, state.dateKey);
      return true;
    }
    // "a las 4" en una lista de la tarde es 16:00.
    const [h, m] = intent.requested_time.split(":").map(Number) as [number, number];
    const pm = h < 12 ? `${String(h + 12).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null;
    const match = state.offered?.find((s) => s.label === intent.requested_time) ?? (pm && !/ma[nñ]ana/i.test(text) ? state.offered?.find((s) => s.label === pm) : undefined);
    if (match) {
      await chooseSlot(admin, ctx, settings, slotKey(match.start));
      return true;
    }
    await reply(admin, ctx, { kind: "text", body: `A las ${intent.requested_time} no tengo lugar ese día. Elegí uno de los horarios de la lista o decime otro día.` });
    return true;
  }
  // Un "sí"/"dale" suelto en medio de una reserva no confirma otro turno: se repite el paso actual.
  if ((state.flow === "booking" || state.flow === "reschedule") && intent.intent === "CONFIRM_APPOINTMENT") {
    if (state.step === "modality") await askModality(admin, ctx, settings);
    else if (state.step === "slot" && state.dateKey) await offerSlots(admin, ctx, settings, state.dateKey);
    else await offerDates(admin, ctx, settings);
    return true;
  }
  return false;
}

/**
 * Respuesta escrita a "¿Querés cancelar tu sesión…?" (ver classifyCancelAnswer).
 * El texto nunca cancela: si suena a cancelar, se piden los botones para confirmarlo.
 */
async function continueCancel(
  admin: AdminSupabaseClient,
  ctx: ConversationContext,
  settings: Settings,
  text: string,
  intent: IntentKey | null,
  options: { allowReschedule: boolean } = { allowReschedule: true },
) {
  const appointmentId = ctx.state.appointmentId ?? null;
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) {
    await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
    return reply(admin, ctx, { kind: "text", body: "No encuentro ese turno." });
  }
  const tz = settings.scheduling.timezone;
  switch (classifyCancelAnswer(text, intent)) {
    case "keep": {
      await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
      if (appointment.status === "pending" || appointment.status === "rescheduled") {
        return reply(
          admin,
          ctx,
          { kind: "buttons", body: "Perfecto, tu turno sigue en pie. ¿Querés confirmar tu asistencia?", buttons: [{ id: `CONFIRM:${appointment.id}`, title: "Confirmar asistencia" }] },
          "confirm_prompt",
          appointment.id,
        );
      }
      return reply(admin, ctx, { kind: "text", body: "Perfecto, tu turno sigue en pie." });
    }
    case "reschedule":
      if (!options.allowReschedule) {
        await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
        if ((await msSinceLastNotification(admin, ctx, "reschedule_request")) > HUMAN_RENOTIFY_MS) {
          await notifyAdminsHandoff(admin, ctx, "Pidió cambiar un turno desde una conversación con señales de crisis. Coordinalo personalmente.", "reschedule_request");
        }
        return reply(admin, ctx, { kind: "text", body: `Le aviso al ${settings["site.identity"].professional_name} para que coordine el cambio con vos personalmente.` }, "handoff_ack");
      }
      return startReschedule(admin, ctx, settings, appointment.id);
    case "cancel_intent":
      await saveState(admin, ctx, { flow: "cancel", step: "confirm", appointmentId: appointment.id });
      return reply(
        admin,
        ctx,
        {
          kind: "buttons",
          body: `Para cancelar tu sesión del ${describe(appointment, tz)}, tocá «Sí, cancelar». Si preferís mantenerla, tocá «No, mantener».`,
          buttons: [
            { id: `CANCELYES:${appointment.id}`, title: "Sí, cancelar" },
            { id: `CANCELNO:${appointment.id}`, title: "No, mantener" },
          ],
        },
        "cancel_prompt",
        appointment.id,
      );
    case "question": {
      const hours = settings.scheduling.cancel_min_hours;
      await saveState(admin, ctx, { flow: "cancel", step: "confirm", appointmentId: appointment.id });
      return reply(
        admin,
        ctx,
        {
          kind: "buttons",
          body: `Podés cancelar o reprogramar por acá o desde la app hasta ${hours} horas antes de la sesión; después, se coordina directamente con el profesional. ¿Querés cancelar tu sesión del ${describe(appointment, tz)}?`,
          buttons: cancelPromptButtons(appointment.id),
        },
        "cancel_prompt",
        appointment.id,
      );
    }
    default:
      return askCancelConfirmation(admin, ctx, settings, appointment.id);
  }
}

function cancelPromptButtons(appointmentId: string) {
  return [
    { id: `CANCELYES:${appointmentId}`, title: "Sí, cancelar" },
    { id: `RESCHEDULE:${appointmentId}`, title: "Mejor cambiarla" },
    { id: `CANCELNO:${appointmentId}`, title: "No, mantener" },
  ];
}

/* ------------------------------------------------------------------------ */
/* Confirmar / cancelar / reprogramar                                        */
/* ------------------------------------------------------------------------ */
/**
 * Turno sobre el que se actúa. Con un id (botón, aviso, flujo en curso) es ESE turno del paciente o
 * ninguno: nunca se cae a otro turno, porque un id ajeno o borrado no autoriza a tocar otro.
 * Sin id, el próximo turno activo.
 */
async function findTargetAppointment(admin: AdminSupabaseClient, ctx: ConversationContext, appointmentId: string | null): Promise<Appointment | null> {
  if (!ctx.patient) return null;
  if (appointmentId) {
    const { data } = await admin.from("appointments").select("*").eq("id", appointmentId).eq("patient_id", ctx.patient.id).maybeSingle();
    return data ?? null;
  }
  const { data } = await admin
    .from("appointments")
    .select("*")
    .eq("patient_id", ctx.patient.id)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .gte("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function describe(a: Appointment, tz: string): string {
  return `${capitalize(formatLongDate(a.start_time, tz))} a las ${formatTime(a.start_time, tz)} (${MODALITY_LABEL[a.modality].toLowerCase()})`;
}

/**
 * Confirma un turno. Con strict (respuesta escrita a un pedido de confirmación), solo ese turno:
 * nunca se confirma otro en su lugar.
 */
async function doConfirm(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null, options: { strict?: boolean } = {}) {
  const found = await findTargetAppointment(admin, ctx, appointmentId);
  const appointment = options.strict && found?.id !== appointmentId ? null : found;
  if (!appointment) return reply(admin, ctx, { kind: "buttons", body: "No encuentro un turno próximo a tu nombre. ¿Querés agendar uno?", buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
  // La RPC corre con service_role: las reglas del paciente se aplican acá.
  if (!isLive(appointment)) return notLiveReply(admin, ctx, appointment);
  if (appointment.status === "requested") return reply(admin, ctx, { kind: "text", body: `Tu solicitud para el ${describe(appointment, settings.scheduling.timezone)} todavía está pendiente de aprobación. Te aviso en cuanto esté confirmada.` });
  try {
    if (appointment.status !== "confirmed") await confirmAppointment(admin, appointment.id, "whatsapp");
    // Confirmar un turno no corta la reserva o reprogramación de OTRO turno que esté en curso.
    if (ctx.state.flow === "cancel" || (ctx.state.flow && ctx.state.appointmentId === appointment.id)) {
      await saveState(admin, ctx, { ...ctx.state, flow: null, step: null, appointmentId: null, offered: [] });
    }
    const template = await getTemplate(admin, "confirmation_thanks");
    return reply(admin, ctx, { kind: "text", body: template ? renderTemplate(template.body, {}) : "Gracias. Tu turno quedó confirmado." }, "confirmation", appointment.id);
  } catch (error) {
    log.warn("Confirmación por WhatsApp falló", errorMeta(error));
    return reply(admin, ctx, { kind: "text", body: "No pude registrar la confirmación. Intentá de nuevo en un momento o escribile al profesional." });
  }
}

/** "Confirmo" escrito: se muestra el turno y la confirmación queda a un toque (nunca se confirma por texto). */
async function askConfirmAttendance(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null = null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "buttons", body: "No encuentro un turno próximo a tu nombre. ¿Querés agendar uno?", buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
  const when = describe(appointment, settings.scheduling.timezone);
  if (appointment.status === "requested") return reply(admin, ctx, { kind: "text", body: `Tu solicitud para el ${when} todavía está pendiente de aprobación. Te aviso en cuanto esté confirmada.` });
  if (appointment.status === "confirmed") return reply(admin, ctx, { kind: "text", body: `Tu sesión del ${when} ya está confirmada.` });
  return reply(
    admin,
    ctx,
    {
      kind: "buttons",
      body: `Tu próxima sesión es el ${when}. ¿Confirmás tu asistencia?`,
      buttons: [
        { id: `CONFIRM:${appointment.id}`, title: "Confirmar asistencia" },
        { id: `RESCHEDULE:${appointment.id}`, title: "Reprogramar" },
        { id: `CANCEL:${appointment.id}`, title: "Cancelar" },
      ],
    },
    "confirm_prompt",
    appointment.id,
  );
}

async function askCancelConfirmation(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "text", body: appointmentId ? "No encuentro ese turno." : "No encuentro un turno próximo a tu nombre para cancelar." });
  if (!isLive(appointment)) return notLiveReply(admin, ctx, appointment);
  await saveState(admin, ctx, { flow: "cancel", step: "confirm", appointmentId: appointment.id }, { current_intent: "CANCEL_APPOINTMENT" });
  // kind "cancel_prompt": una respuesta escrita solo se interpreta si esta pregunta es lo último enviado.
  return reply(
    admin,
    ctx,
    { kind: "buttons", body: `¿Querés cancelar tu sesión del ${describe(appointment, settings.scheduling.timezone)}?`, buttons: cancelPromptButtons(appointment.id) },
    "cancel_prompt",
    appointment.id,
  );
}

async function doCancel(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId ?? ctx.state.appointmentId ?? null);
  await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
  if (!appointment) return reply(admin, ctx, { kind: "text", body: "No encuentro ese turno." });
  // Botón viejo sobre un turno ya cancelado o pasado: no es un problema de "cercanía de la fecha".
  if (!isLive(appointment)) return notLiveReply(admin, ctx, appointment);
  // La RPC corre con service_role (privilegiada): las reglas del paciente se aplican acá.
  if (!canPatientModify(appointment, settings.scheduling, "cancel")) {
    return askYesNo(admin, ctx, "Por la cercanía de la fecha, esta cancelación la tiene que coordinar el profesional directamente. ¿Le aviso?", { id: "HUMAN:CANCEL", title: "Sí, avisale" });
  }
  try {
    const updated = await cancelAppointment(admin, appointment.id, "Cancelado por WhatsApp", "whatsapp");
    const tpl = await getTemplate(admin, "cancellation_done");
    const tz = settings.scheduling.timezone;
    const body = tpl ? renderTemplate(tpl.body, { first_name: firstName(ctx) ?? "", date: capitalize(formatLongDate(updated.start_time, tz)), time: formatTime(updated.start_time, tz) }) : "Listo, tu turno fue cancelado.";
    return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "MENU:BOOK", title: "Pedir otro turno" }] }, "cancellation", updated.id);
  } catch (error) {
    log.warn("Cancelación por WhatsApp rechazada", errorMeta(error));
    return askYesNo(admin, ctx, "Este turno ya no puede cancelarse automáticamente por la cercanía de la fecha. ¿Querés que le avise al profesional?", { id: "HUMAN:CANCEL", title: "Sí, avisale" });
  }
}

/** Reprograma un turno. Con dateKey (día ya pedido), se muestran directamente los horarios de ese día. */
async function startReschedule(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null, dateKey: string | null = null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "buttons", body: "No encuentro un turno próximo para reprogramar. ¿Querés agendar uno nuevo?", buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
  if (!isLive(appointment)) return notLiveReply(admin, ctx, appointment);
  if (!canPatientModify(appointment, settings.scheduling, "reschedule")) {
    return askYesNo(admin, ctx, "Por la cercanía de la fecha, este cambio lo tiene que coordinar el profesional directamente. ¿Le aviso?", { id: "HUMAN:RESCHEDULE", title: "Sí, avisale" });
  }
  const state: ConversationState = { flow: "reschedule", step: dateKey ? "slot" : "date", appointmentId: appointment.id, modality: appointment.modality, dateKey, offered: [] };
  await saveState(admin, ctx, state, { current_intent: "RESCHEDULE_APPOINTMENT" });
  const current = `Tu sesión actual es el ${describe(appointment, settings.scheduling.timezone)}.`;
  await reply(admin, ctx, { kind: "text", body: dateKey ? current : `${current} Elegí un nuevo día:` });
  return dateKey ? offerSlots(admin, ctx, settings, dateKey) : offerDates(admin, ctx, settings);
}

/* ------------------------------------------------------------------------ */
/* Información administrativa                                                */
/* ------------------------------------------------------------------------ */
async function replyPlans(admin: AdminSupabaseClient, ctx: ConversationContext, _settings: Settings) {
  const { data: plans } = await admin.from("therapy_plans").select("name, price_amount, currency, duration_minutes, sessions_included").eq("is_active", true).order("sort_order");
  const lines = (plans ?? []).map((p) => `• ${p.name}: ${formatCurrency(p.price_amount, p.currency)}${p.duration_minutes ? ` (${p.duration_minutes} min)` : ""}${p.sessions_included && p.sessions_included > 1 ? `, ${p.sessions_included} sesiones` : ""}`);
  const body = lines.length ? `Estos son los planes de atención:\n${lines.join("\n")}\n\nMás detalle en ${getServerEnv().NEXT_PUBLIC_APP_URL}/planes` : "Los planes se publican próximamente. Si querés, le aviso al profesional para que te cuente las opciones.";
  return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }, { id: "HUMAN:PLANS", title: "Consultar" }] });
}

async function replyLocation(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  const id = settings["site.identity"];
  if (!id.location_address) return reply(admin, ctx, { kind: "text", body: "La dirección del consultorio se comparte al confirmar el turno presencial. También podemos coordinar una videollamada." });
  const body = `El consultorio queda en ${id.location_name ? `${id.location_name}, ` : ""}${id.location_address}.${id.location_map_url ? `\nMapa: ${id.location_map_url}` : ""}`;
  return reply(admin, ctx, { kind: "text", body });
}

async function replyOnline(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  const appointment = ctx.patient ? await findTargetAppointment(admin, ctx, null) : null;
  if (appointment?.modality === "virtual" && appointment.video_link && ["confirmed", "pending", "rescheduled"].includes(appointment.status)) {
    return reply(admin, ctx, { kind: "text", body: `Tu próxima videollamada es el ${describe(appointment, settings.scheduling.timezone)}. Enlace: ${appointment.video_link}` });
  }
  if (!settings.scheduling.modalities_enabled.includes("virtual")) {
    return reply(admin, ctx, { kind: "buttons", body: "Por ahora las sesiones son presenciales. ¿Querés ver los horarios disponibles?", buttons: [{ id: "MENU:AVAIL", title: "Ver horarios" }] });
  }
  return reply(admin, ctx, { kind: "buttons", body: "Sí, las sesiones pueden ser por videollamada. El enlace se envía antes de cada sesión virtual. ¿Querés agendar una?", buttons: [{ id: "MOD:virtual", title: "Agendar virtual" }] });
}

async function replyLoginHelp(admin: AdminSupabaseClient, ctx: ConversationContext) {
  const tpl = await getTemplate(admin, "login_help");
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const body = tpl ? renderTemplate(tpl.body, { app_url: appUrl }) : `Para ingresar entrá a ${appUrl}/login con tu email. Si no recordás tu contraseña, usá “Olvidé mi contraseña”.`;
  return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "HUMAN:LOGIN", title: "Sigo sin poder" }] });
}

async function handOff(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, about: string | null = null) {
  const now = new Date().toISOString();
  // "Avisar al psicólogo" de un mensaje de crisis anterior (la derivación ya venció o se reactivó la
  // asistente): sigue siendo un pedido urgente y la derivación vuelve a ser por crisis.
  const crisis = about === "CRISIS";
  // Se descarta el flujo en curso: una lista vieja tocada después no debe reservar nada.
  await saveState(admin, ctx, { flow: null, step: null, offered: [], appointmentId: null }, { status: "handed_off", handed_off_at: now, ...(crisis ? { crisis_flagged_at: now } : {}) });
  // El mismo pedido repetido enseguida no vuelve a notificar; un pedido distinto sí.
  await notifyHumanRequest(admin, ctx, about, crisis);
  const professional = settings["site.identity"].professional_name;
  if (crisis) return reply(admin, ctx, { kind: "text", body: `Listo, ya le avisé al ${professional}. ${settings.emergency.message}`.trim() }, "handoff");
  return reply(admin, ctx, { kind: "text", body: settings.whatsapp.handoff_message || `Perfecto. Le aviso al ${professional} para que te escriba personalmente. Tené en cuenta que por este medio la respuesta puede demorar.` }, "handoff");
}
