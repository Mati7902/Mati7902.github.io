import "server-only";

import { addDays } from "date-fns";

import { formatLongDate, formatTime, capitalize, toDateKey } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { groupSlotsByPeriod, type Slot } from "@/lib/scheduling/slots";
import { createAdminClient, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { buildCrisisMessage, detectCrisis } from "@/server/services/ai/crisis";
import { getAIProvider, type IntentKey, type IntentResult } from "@/server/services/ai/provider";
import { assertSlotAvailable, cancelAppointment, confirmAppointment, createAppointment, getAvailableSlots, initialStatusForPatientBooking, rescheduleAppointment } from "@/server/services/appointments";
import { createNotification } from "@/server/services/notifications";
import { getSettings } from "@/server/services/settings";
import { isWhatsAppConfigured, markAsRead, sendInteractiveButtons, sendInteractiveList, sendText, type SendResult } from "@/server/services/whatsapp/client";
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
    await recordInbound(admin, ctx, inbound, "OPTED_OUT");
    return;
  }
  void markAsRead(inbound.waMessageId);

  if (inbound.type === "unsupported") {
    await recordInbound(admin, ctx, inbound, "UNSUPPORTED");
    await reply(admin, ctx, { kind: "text", body: "Por ahora solo puedo leer mensajes de texto. ¿En qué te puedo ayudar con tu agenda?" });
    return;
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
  if (ctx.state.flow && !["CANCEL_APPOINTMENT", "SPEAK_TO_HUMAN", "GREETING", "THANKS"].includes(intent.intent)) {
    const handled = await continueFlow(admin, ctx, settings, inbound.text, intent);
    if (handled) return;
  }

  const threshold = settings.whatsapp.ai_confidence_threshold;
  const effective: IntentKey = intent.confidence >= threshold ? intent.intent : "OTHER";
  await handleIntent(admin, ctx, settings, effective, intent, inbound.text);
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

function firstName(ctx: ConversationContext): string | null {
  return ctx.patient?.first_name ?? ctx.contact.display_name?.split(" ")[0] ?? null;
}

function greet(ctx: ConversationContext, settings: Settings): string {
  const name = firstName(ctx);
  const base = settings.whatsapp.greeting || `Hola. Soy la asistente virtual del ${settings["site.identity"].professional_name}.`;
  return name ? base.replace(/^Hola\.?/, `Hola, ${name}.`) : base;
}

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
  await saveState(admin, ctx, { ...ctx.state, flow: null, step: null }, { crisis_flagged_at: new Date().toISOString(), status: "handed_off", handed_off_at: new Date().toISOString() });
  await reply(admin, ctx, settings.emergency.show_contact_professional
    ? { kind: "buttons", body, buttons: [{ id: "HUMAN:CRISIS", title: "Avisar al profesional" }] }
    : { kind: "text", body }, "crisis");
  await notifyAdminsHandoff(admin, ctx, "Posible situación de crisis detectada en WhatsApp. Revisá la conversación cuanto antes.");
}

async function notifyAdminsHandoff(admin: AdminSupabaseClient, ctx: ConversationContext, body: string) {
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["admin", "professional"]).eq("is_active", true);
  const who = ctx.patient ? `${ctx.patient.first_name} ${ctx.patient.last_name}` : (ctx.contact.display_name ?? ctx.contact.phone);
  for (const a of admins ?? []) {
    await createNotification(admin, { userId: a.id, type: "system", title: `WhatsApp: ${who}`, body, data: { conversation_id: ctx.conversation.id, contact_id: ctx.contact.id } });
  }
}

/* ------------------------------------------------------------------------ */
/* Payloads de botones                                                       */
/* ------------------------------------------------------------------------ */
async function handlePayload(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, payload: string) {
  const [action, arg] = payload.split(":") as [string, string | undefined];
  switch (action) {
    case "MENU":
      if (arg === "BOOK") return startBooking(admin, ctx, settings, {});
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
    case "RESCHEDULE":
      return startReschedule(admin, ctx, settings, arg ?? null);
    case "MOD":
      if (arg === "presencial" || arg === "virtual") {
        await saveState(admin, ctx, { ...ctx.state, modality: arg, step: "date" });
        return offerDates(admin, ctx, settings);
      }
      return;
    case "DATE":
      if (arg) {
        await saveState(admin, ctx, { ...ctx.state, dateKey: arg, step: "slot" });
        return offerSlots(admin, ctx, settings, arg);
      }
      return;
    case "SLOT":
      return chooseSlot(admin, ctx, settings, arg ?? null);
    case "HUMAN":
      return handOff(admin, ctx, settings);
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
async function handleIntent(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, intent: IntentKey, details: IntentResult, text: string) {
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
      return startReschedule(admin, ctx, settings, null);
    case "CANCEL_APPOINTMENT":
      return askCancelConfirmation(admin, ctx, settings, null);
    case "CONFIRM_APPOINTMENT":
      return doConfirm(admin, ctx, settings, null);
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
  if (!modality) return askModality(admin, ctx);
  if (state.dateKey) return offerSlots(admin, ctx, settings, state.dateKey, hints.timePreference ?? null);
  return offerDates(admin, ctx, settings);
}

async function askModality(admin: AdminSupabaseClient, ctx: ConversationContext) {
  return reply(admin, ctx, { kind: "buttons", body: "¿Cómo preferís la sesión?", buttons: [{ id: "MOD:presencial", title: "Presencial" }, { id: "MOD:virtual", title: "Videollamada" }] });
}

async function offerDates(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  const modality = ctx.state.modality ?? "presencial";
  const { days } = await getAvailableSlots({ modality, days: 14, excludeAppointmentId: ctx.state.appointmentId ?? undefined });
  if (days.length === 0) {
    return reply(admin, ctx, { kind: "buttons", body: "No encuentro horarios libres en las próximas dos semanas. ¿Querés que le avise al profesional para buscar una alternativa?", buttons: [{ id: "HUMAN:NOSLOTS", title: "Sí, avisale" }] });
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
    if (!next) return reply(admin, ctx, { kind: "text", body: `Para el ${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} no tengo lugar y tampoco en la semana siguiente. ¿Querés que le avise al profesional?` });
    return reply(admin, ctx, {
      kind: "buttons",
      body: `Para el ${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} no tengo lugar. El siguiente día con disponibilidad es el ${capitalize(formatLongDate(`${next.dateKey}T12:00:00`, tz))}.`,
      buttons: [{ id: `DATE:${next.dateKey}`, title: "Ver ese día" }, { id: "MENU:AVAIL", title: "Otros días" }],
    });
  }
  const offered = slots.slice(0, settings.whatsapp.max_slots_to_offer).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: s.label }));
  await saveState(admin, ctx, { ...ctx.state, step: "slot", dateKey, offered });
  const body = `${capitalize(formatLongDate(`${dateKey}T12:00:00`, tz))} · ${MODALITY_LABEL[modality]}. Tengo disponibles estos horarios:\n${offered.map((s) => `• ${s.label}`).join("\n")}\n¿Cuál preferís?`;
  return reply(admin, ctx, { kind: "list", body, button: "Elegir horario", section: "Horarios", rows: offered.map((s) => ({ id: `SLOT:${s.start}`, title: s.label, description: MODALITY_LABEL[modality] })) });
}

async function chooseSlot(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, startIso: string | null) {
  const slot = ctx.state.offered?.find((s) => s.start === startIso);
  if (!slot || !startIso) return reply(admin, ctx, { kind: "text", body: "Ese horario ya no figura entre las opciones. Escribime el día que preferís y te paso los horarios de nuevo." });
  const modality = ctx.state.modality ?? "presencial";
  const tz = settings.scheduling.timezone;
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const when = `${capitalize(formatLongDate(start, tz))} a las ${formatTime(start, tz)}`;

  try {
    // Segunda verificación de disponibilidad justo antes de confirmar.
    const scheduling = await assertSlotAvailable(start, end, modality, ctx.state.appointmentId ?? undefined);
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
    const dateKey = ctx.state.dateKey ?? toDateKey(start, tz);
    await reply(admin, ctx, { kind: "text", body: "Ese horario se acaba de ocupar. Te paso los que siguen disponibles." });
    return offerSlots(admin, ctx, settings, dateKey);
  }
}

async function continueFlow(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, text: string, intent: IntentResult): Promise<boolean> {
  const state = ctx.state;
  if (state.step === "modality" && intent.modality) {
    await saveState(admin, ctx, { ...state, modality: intent.modality, step: "date" });
    await offerDates(admin, ctx, settings);
    return true;
  }
  if ((state.step === "date" || state.step === "slot") && intent.requested_date) {
    await saveState(admin, ctx, { ...state, dateKey: intent.requested_date, step: "slot" });
    await offerSlots(admin, ctx, settings, intent.requested_date, intent.time_preference ?? null);
    return true;
  }
  if (state.step === "slot" && intent.requested_time && state.dateKey) {
    const match = state.offered?.find((s) => s.label === intent.requested_time);
    if (match) {
      await chooseSlot(admin, ctx, settings, match.start);
      return true;
    }
    await reply(admin, ctx, { kind: "text", body: `A las ${intent.requested_time} no tengo lugar ese día. Elegí uno de los horarios de la lista o decime otro día.` });
    return true;
  }
  if (state.step === "slot" && /^\s*\d{1,2}(:\d{2})?\s*(hs|h)?\s*$/i.test(text)) {
    const normalized = text.replace(/\D/g, "").padStart(4, "0");
    const label = `${normalized.slice(0, 2)}:${normalized.slice(2)}`;
    const match = state.offered?.find((s) => s.label === label || s.label.startsWith(`${normalized.slice(0, 2)}:`));
    if (match) {
      await chooseSlot(admin, ctx, settings, match.start);
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Confirmar / cancelar / reprogramar                                        */
/* ------------------------------------------------------------------------ */
async function findTargetAppointment(admin: AdminSupabaseClient, ctx: ConversationContext, appointmentId: string | null): Promise<Appointment | null> {
  if (!ctx.patient) return null;
  if (appointmentId) {
    const { data } = await admin.from("appointments").select("*").eq("id", appointmentId).eq("patient_id", ctx.patient.id).maybeSingle();
    if (data) return data;
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

async function doConfirm(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "buttons", body: "No encuentro un turno próximo a tu nombre. ¿Querés agendar uno?", buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
  if (appointment.status === "requested") return reply(admin, ctx, { kind: "text", body: `Tu solicitud para el ${describe(appointment, settings.scheduling.timezone)} todavía está pendiente de aprobación. Te aviso en cuanto esté confirmada.` });
  try {
    await confirmAppointment(admin, appointment.id, "whatsapp");
    const template = await getTemplate(admin, "confirmation_thanks");
    return reply(admin, ctx, { kind: "text", body: template ? renderTemplate(template.body, {}) : "Gracias. Tu turno quedó confirmado." }, "confirmation", appointment.id);
  } catch (error) {
    log.warn("Confirmación por WhatsApp falló", errorMeta(error));
    return reply(admin, ctx, { kind: "text", body: "No pude registrar la confirmación. Intentá de nuevo en un momento o escribile al profesional." });
  }
}

async function askCancelConfirmation(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "text", body: "No encuentro un turno próximo a tu nombre para cancelar." });
  await saveState(admin, ctx, { flow: "cancel", step: "confirm", appointmentId: appointment.id }, { current_intent: "CANCEL_APPOINTMENT" });
  return reply(admin, ctx, {
    kind: "buttons",
    body: `¿Querés cancelar tu sesión del ${describe(appointment, settings.scheduling.timezone)}?`,
    buttons: [{ id: `CANCELYES:${appointment.id}`, title: "Sí, cancelar" }, { id: `RESCHEDULE:${appointment.id}`, title: "Mejor cambiarla" }, { id: `CANCELNO:${appointment.id}`, title: "No, mantener" }],
  });
}

async function doCancel(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId ?? ctx.state.appointmentId ?? null);
  await saveState(admin, ctx, { flow: null, step: null, appointmentId: null });
  if (!appointment) return reply(admin, ctx, { kind: "text", body: "No encuentro ese turno." });
  try {
    const updated = await cancelAppointment(admin, appointment.id, "Cancelado por WhatsApp", "whatsapp");
    const tpl = await getTemplate(admin, "cancellation_done");
    const tz = settings.scheduling.timezone;
    const body = tpl ? renderTemplate(tpl.body, { first_name: firstName(ctx) ?? "", date: capitalize(formatLongDate(updated.start_time, tz)), time: formatTime(updated.start_time, tz) }) : "Listo, tu turno fue cancelado.";
    return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "MENU:BOOK", title: "Pedir otro turno" }] }, "cancellation", updated.id);
  } catch (error) {
    log.warn("Cancelación por WhatsApp rechazada", errorMeta(error));
    return reply(admin, ctx, { kind: "buttons", body: "Este turno ya no puede cancelarse automáticamente por la cercanía de la fecha. ¿Querés que le avise al profesional?", buttons: [{ id: "HUMAN:CANCEL", title: "Sí, avisale" }] });
  }
}

async function startReschedule(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings, appointmentId: string | null) {
  const appointment = await findTargetAppointment(admin, ctx, appointmentId);
  if (!appointment) return reply(admin, ctx, { kind: "buttons", body: "No encuentro un turno próximo para reprogramar. ¿Querés agendar uno nuevo?", buttons: [{ id: "MENU:BOOK", title: "Agendar sesión" }] });
  const minHours = settings.scheduling.reschedule_min_hours;
  if (!settings.scheduling.allow_patient_reschedule || new Date(appointment.start_time).getTime() - minHours * 3600_000 < Date.now()) {
    return reply(admin, ctx, { kind: "buttons", body: "Por la cercanía de la fecha, este cambio lo tiene que coordinar el profesional directamente. ¿Le aviso?", buttons: [{ id: "HUMAN:RESCHEDULE", title: "Sí, avisale" }] });
  }
  await saveState(admin, ctx, { flow: "reschedule", step: "date", appointmentId: appointment.id, modality: appointment.modality, offered: [] }, { current_intent: "RESCHEDULE_APPOINTMENT" });
  await reply(admin, ctx, { kind: "text", body: `Tu sesión actual es el ${describe(appointment, settings.scheduling.timezone)}. Elegí un nuevo día:` });
  return offerDates(admin, ctx, settings);
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
  return reply(admin, ctx, { kind: "buttons", body: "Sí, las sesiones pueden ser por videollamada. El enlace se envía antes de cada sesión virtual. ¿Querés agendar una?", buttons: [{ id: "MOD:virtual", title: "Agendar virtual" }] });
}

async function replyLoginHelp(admin: AdminSupabaseClient, ctx: ConversationContext) {
  const tpl = await getTemplate(admin, "login_help");
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const body = tpl ? renderTemplate(tpl.body, { app_url: appUrl }) : `Para ingresar entrá a ${appUrl}/login con tu email. Si no recordás tu contraseña, usá “Olvidé mi contraseña”.`;
  return reply(admin, ctx, { kind: "buttons", body, buttons: [{ id: "HUMAN:LOGIN", title: "Sigo sin poder" }] });
}

async function handOff(admin: AdminSupabaseClient, ctx: ConversationContext, settings: Settings) {
  await saveState(admin, ctx, { ...ctx.state, flow: null, step: null }, { status: "handed_off", handed_off_at: new Date().toISOString() });
  await notifyAdminsHandoff(admin, ctx, "Pidió hablar con el profesional por WhatsApp.");
  return reply(admin, ctx, { kind: "text", body: settings.whatsapp.handoff_message || `Perfecto. Le aviso al ${settings["site.identity"].professional_name} para que te escriba personalmente. Tené en cuenta que por este medio la respuesta puede demorar.` }, "handoff");
}
