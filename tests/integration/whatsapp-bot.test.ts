// @vitest-environment node
/**
 * Recorridos de conversación del chatbot de WhatsApp contra la base de la vista previa local
 * (Postgres + PostgREST + pasarela). Los envíos a WhatsApp se simulan; todo lo demás (estado de la
 * conversación, turnos, avisos al profesional) es real.
 *
 * Requiere la vista previa corriendo (pnpm preview:local) y se ejecuta con: pnpm test:bot
 * Crea pacientes ficticios propios y los borra al terminar (turnos, mensajes y avisos incluidos).
 * No correr dos ejecuciones a la vez sobre la misma base. Nunca usar contra producción.
 */
import { createHmac } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { handleInboundMessage as HandleInbound } from "@/server/services/whatsapp/bot";
import type { Database } from "@/types/database";

const RUN = process.env.BOT_IT === "1";

const env = vi.hoisted(() => {
  const url = process.env.BOT_IT_SUPABASE_URL ?? "http://127.0.0.1:54321";
  // Misma clave determinística que genera scripts/preview/gateway.mjs (secreto fijo de desarrollo).
  const secret = process.env.PREVIEW_JWT_SECRET ?? "preview-local-jwt-secret-solo-para-desarrollo-0001";
  return { url, secret };
});

function previewKey(role: string): string {
  const b64 = (v: string) => Buffer.from(v).toString("base64url");
  const head = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify({ role, iss: "preview-local", iat: 1_760_000_000 }))}`;
  return `${head}.${createHmac("sha256", env.secret).update(head).digest("base64url")}`;
}

type Sent = { to: string; body: string; buttons: string[] };
const sent = vi.hoisted(() => [] as { to: string; body: string; buttons: string[] }[]);

vi.mock("@/server/services/whatsapp/client", () => {
  let n = 0;
  const ok = () => ({ ok: true as const, messageId: `wamid.test.${Date.now()}.${n++}` });
  return {
    isWhatsAppConfigured: () => true,
    markAsRead: async () => {},
    sendText: async (to: string, body: string) => (sent.push({ to, body, buttons: [] }), ok()),
    sendInteractiveButtons: async (to: string, body: string, buttons: { id: string }[]) => (sent.push({ to, body, buttons: buttons.map((b) => b.id) }), ok()),
    sendInteractiveList: async (to: string, body: string, _l: string, _s: string, rows: { id: string }[]) => (sent.push({ to, body, buttons: rows.map((r) => r.id) }), ok()),
    sendTemplate: async (to: string, name: string) => (sent.push({ to, body: `template:${name}`, buttons: [] }), ok()),
  };
});

const db = createClient<Database>(env.url, previewKey("service_role"), { auth: { persistSession: false, autoRefreshToken: false } });

let handleInboundMessage: typeof HandleInbound;
let originalWhatsApp: unknown;
const createdPatients: string[] = [];
const createdPhones: string[] = [];
let seq = 0;

async function setup() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previewKey("anon");
  process.env.SUPABASE_SERVICE_ROLE_KEY = previewKey("service_role");
  process.env.AI_PROVIDER = "rules";
  ({ handleInboundMessage } = await import("@/server/services/whatsapp/bot"));
  const { data } = await db.from("settings").select("value").eq("key", "whatsapp").single();
  originalWhatsApp = data!.value;
  await db.from("settings").update({ value: { ...(data!.value as object), enabled: true } }).eq("key", "whatsapp");
}

async function teardown() {
  const must = (label: string, result: { error: { message: string } | null }) => {
    if (result.error) throw new Error(`Limpieza incompleta (${label}): ${result.error.message}`);
  };
  if (originalWhatsApp) must("settings", await db.from("settings").update({ value: originalWhatsApp as never }).eq("key", "whatsapp"));
  const { data: contacts } = await db.from("whatsapp_contacts").select("id").in("phone", createdPhones);
  const contactIds = (contacts ?? []).map((c) => c.id);
  const { data: appts } = await db.from("appointments").select("id").in("patient_id", createdPatients);
  // Avisos al profesional y al paciente: por contacto, por paciente y por turno.
  for (const id of contactIds) must("avisos por contacto", await db.from("notifications").delete().eq("data->>contact_id", id));
  for (const id of createdPatients) must("avisos por paciente", await db.from("notifications").delete().eq("data->>patient_id", id));
  for (const { id } of appts ?? []) must("avisos por turno", await db.from("notifications").delete().eq("data->>appointment_id", id));
  if (contactIds.length) {
    must("mensajes", await db.from("whatsapp_messages").delete().in("contact_id", contactIds));
    must("conversaciones", await db.from("whatsapp_conversations").delete().in("contact_id", contactIds));
    must("contactos", await db.from("whatsapp_contacts").delete().in("id", contactIds));
  }
  if (createdPatients.length) {
    must("historial", await db.from("appointment_history").delete().in("appointment_id", (appts ?? []).map((a) => a.id)));
    must("turnos", await db.from("appointments").delete().in("patient_id", createdPatients));
    must("pacientes", await db.from("patients").delete().in("id", createdPatients));
  }
}

type ApptSpec = { inDays?: number; inHours?: number; status: Database["public"]["Enums"]["appointment_status"] };

/**
 * Paciente ficticio con turnos propios. `inDays`: madrugada (03:00 UTC) de un día lejano, fuera de la
 * grilla y de los turnos de la demo. `inHours`: dentro de unas horas (para probar plazos mínimos); si
 * el horario choca con otro turno, se corre de a 40 minutos.
 */
async function newPatient(appointments: ApptSpec[] = [], options: { phone?: string; whatsapp?: boolean } = {}) {
  const n = ++seq;
  const phone = options.phone ?? `+5959819${String(Date.now()).slice(-4)}${String(n).padStart(2, "0")}`;
  const { data: patient, error } = await db
    .from("patients")
    .insert({ first_name: "Prueba", last_name: `Bot ${n}`, phone, whatsapp_phone: options.whatsapp === false ? null : phone })
    .select("*")
    .single();
  if (error) throw error;
  createdPatients.push(patient.id);
  if (!createdPhones.includes(phone)) createdPhones.push(phone);
  const ids: string[] = [];
  for (const [i, a] of appointments.entries()) {
    let start = new Date();
    if (a.inHours !== undefined) {
      start = new Date(Date.now() + a.inHours * 3600_000 + n * 7 * 60_000);
      start.setUTCSeconds(0, 0);
    } else {
      start.setUTCHours(3 + i, (n * 7) % 60, 0, 0);
      start.setUTCDate(start.getUTCDate() + (a.inDays ?? 20) + n * 3);
    }
    for (let attempt = 0; ; attempt++) {
      const end = new Date(start.getTime() + 30 * 60_000);
      const { data, error: e } = await db
        .from("appointments")
        .insert({ patient_id: patient.id, start_time: start.toISOString(), end_time: end.toISOString(), modality: "virtual", status: a.status, source: "admin" })
        .select("id")
        .single();
      if (!e) {
        ids.push(data.id);
        break;
      }
      if (e.code !== "23P01" || attempt >= 8) throw e;
      start = new Date(start.getTime() + 40 * 60_000);
    }
  }
  return { patient, phone, ids };
}

let msgSeq = 0;
async function say(phone: string, text: string, opts: { payload?: string; type?: "text" | "interactive" | "unsupported" } = {}): Promise<Sent[]> {
  const before = sent.length;
  await handleInboundMessage({
    waMessageId: `wamid.in.${Date.now()}.${msgSeq++}`,
    fromPhoneE164: phone,
    waId: phone.slice(1),
    displayName: "Prueba",
    phoneNumberId: null,
    timestamp: new Date(),
    type: opts.type ?? (opts.payload ? "interactive" : "text"),
    text,
    payloadId: opts.payload ?? null,
    rawType: opts.type ?? (opts.payload ? "interactive" : "text"),
  });
  return sent.slice(before);
}

async function status(id: string) {
  const { data } = await db.from("appointments").select("status").eq("id", id).single();
  return data!.status;
}

async function conversationOf(phone: string) {
  const { data: contact } = await db.from("whatsapp_contacts").select("id").eq("phone", phone).single();
  const { data } = await db.from("whatsapp_conversations").select("*").eq("contact_id", contact!.id).order("created_at", { ascending: false }).limit(1).single();
  return { contactId: contact!.id, conversation: data! };
}

/** Simula un aviso del sistema (recordatorio, cambio de turno), que se registra sin conversación. */
async function systemMessage(phone: string, kind: string, appointmentId: string) {
  const { data: contact } = await db.from("whatsapp_contacts").select("id").eq("phone", phone).single();
  await db.from("whatsapp_messages").insert({ contact_id: contact!.id, direction: "outbound", body: kind, kind, appointment_id: appointmentId, status: "sent", sent_at: new Date().toISOString() });
}

async function notificationsFor(contactId: string) {
  const { data } = await db.from("notifications").select("body, data").eq("data->>contact_id", contactId);
  return data ?? [];
}

async function humanRequests(phone: string) {
  const { contactId } = await conversationOf(phone);
  return (await notificationsFor(contactId)).filter((n) => (n.data as { reason?: string }).reason === "human_request");
}

async function appointmentCount(patientId: string) {
  const { count } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", patientId).neq("status", "cancelled");
  return count ?? 0;
}

async function startOf(id: string) {
  const { data } = await db.from("appointments").select("start_time").eq("id", id).single();
  return Date.parse(data!.start_time);
}

/** Primer día de la lista de días enviada (payload DATE:…). */
function firstDate(out: Sent[]): string {
  const id = out.flatMap((m) => m.buttons).find((b) => b.startsWith("DATE:"));
  if (!id) throw new Error(`No se ofrecieron días: ${JSON.stringify(out)}`);
  return id;
}

async function offered(phone: string) {
  const state = (await conversationOf(phone)).conversation.state as { offered?: { start: string; label: string }[] };
  return state.offered ?? [];
}

describe.skipIf(!RUN)("chatbot de WhatsApp (vista previa local)", () => {
  beforeAll(setup, 60_000);
  afterAll(teardown, 60_000);
  beforeEach(() => {
    sent.length = 0;
  });

  it("un 'sí' sin contexto no confirma nada: ofrece el botón", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "pending" }]);
    const out = await say(phone, "Sí");
    expect(await status(ids[0]!)).toBe("pending");
    expect(out.at(-1)?.buttons).toContain(`CONFIRM:${ids[0]}`);
  });

  it("'confirmo' justo después de un recordatorio confirma ese turno", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }, { inDays: 21, status: "pending" }]);
    await say(phone, "hola");
    await systemMessage(phone, "reminder_24h", ids[1]!);
    await say(phone, "Confirmo, gracias");
    expect(await status(ids[1]!)).toBe("confirmed");
  });

  it("la respuesta automática a un audio no reemplaza al recordatorio pendiente", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "pending" }]);
    await say(phone, "hola");
    await systemMessage(phone, "reminder_24h", ids[0]!);
    await say(phone, "", { type: "unsupported" });
    await say(phone, "sí");
    expect(await status(ids[0]!)).toBe("confirmed");
  });

  it("un recordatorio enviado después de '¿Querés cancelar?' invalida la respuesta escrita", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero cancelar mi turno");
    await systemMessage(phone, "reminder_24h", ids[0]!);
    // Se toma como un pedido nuevo (vuelve a preguntar), no como respuesta a la pregunta vieja.
    const out = await say(phone, "No voy a poder ir");
    expect(out.at(-1)?.body).toMatch(/^¿Querés cancelar tu sesión/);
    expect(await status(ids[0]!)).toBe("confirmed");
  });

  it("cancelar por texto nunca cancela: pide el botón, y solo el botón cancela", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero cancelar mi turno");
    const keep = await say(phone, "No, voy a ir");
    expect(keep.at(-1)?.body).toMatch(/sigue en pie/);
    await say(phone, "quiero cancelar mi turno");
    const intent = await say(phone, "No voy a poder ir");
    expect(intent.at(-1)?.buttons).toContain(`CANCELYES:${ids[0]}`);
    expect(await status(ids[0]!)).toBe("confirmed");
    await say(phone, "Sí, cancelar", { payload: `CANCELYES:${ids[0]}` });
    expect(await status(ids[0]!)).toBe("cancelled");
    // El profesional se entera de la cancelación aunque la RPC corra sin usuario (service_role).
    const { data: notice } = await db.from("notifications").select("id").eq("title", "Un paciente canceló su turno").eq("data->>appointment_id", ids[0]!);
    expect(notice?.length).toBeGreaterThan(0);
  });

  it("crisis: un 'sí' escrito a «Avisar al psicólogo» avisa al profesional", async () => {
    const { phone } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    const crisis = await say(phone, "no quiero seguir viviendo");
    expect(crisis.at(-1)?.buttons).toContain("HUMAN:CRISIS");
    const { contactId } = await conversationOf(phone);
    const before = (await notificationsFor(contactId)).filter((n) => (n.data as { reason?: string }).reason === "human_request").length;
    const out = await say(phone, "sí");
    const after = (await notificationsFor(contactId)).filter((n) => (n.data as { reason?: string }).reason === "human_request").length;
    expect(after).toBeGreaterThan(before);
    expect(out.at(-1)?.body).toMatch(/ya le avisé/i);
  });

  it("crisis: un 'sí' escrito a «¿Le aviso?» por una cancelación fuera de plazo avisa al profesional", async () => {
    // Turno en ~3 horas (dentro de las 12 h mínimas): la cancelación la coordina el profesional.
    const { phone, ids } = await newPatient([{ inHours: 3, status: "confirmed" }]);
    await say(phone, "no quiero seguir viviendo");
    const ask = await say(phone, "Sí, cancelar", { payload: `CANCELYES:${ids[0]}` });
    expect(ask.at(-1)?.buttons).toEqual(["HUMAN:CANCEL"]);
    expect(await status(ids[0]!)).toBe("confirmed");
    await say(phone, "sí");
    const { contactId } = await conversationOf(phone);
    const notices = (await notificationsFor(contactId)).filter((n) => (n.data as { reason?: string }).reason === "human_request");
    expect(notices.some((n) => /cancelación/.test(n.body ?? ""))).toBe(true);
  });

  it("derivación común: el primer mensaje después de derivar no recibe otro acuse", async () => {
    const { phone } = await newPatient();
    const first = await say(phone, "quiero hablar con el psicólogo");
    expect(first).toHaveLength(1);
    const second = await say(phone, "hola? estás?");
    expect(second).toHaveLength(0);
  });

  it("dentro de una reprogramación, un horario vencido ofrece «Ver días» (no el menú de reservas)", async () => {
    const { phone } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero reprogramar mi turno");
    const out = await say(phone, "08:00", { payload: "SLOT:20200101T1100" });
    expect(out.at(-1)?.buttons).toEqual(["DATES"]);
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: "reschedule" });
  });

  it("crisis: el texto libre justo después del mensaje de crisis no genera un acuse duplicado", async () => {
    const { phone } = await newPatient();
    await say(phone, "no quiero seguir viviendo");
    const out = await say(phone, "ok gracias, igual me siento mal");
    expect(out).toHaveLength(0);
  });

  it("un día de una lista vieja (sin flujo activo) pregunta si es sesión nueva o cambio", async () => {
    const { phone, ids, patient } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    const out = await say(phone, "Lunes", { payload: "DATE:2030-01-07" });
    expect(out.at(-1)?.buttons).toEqual(["NEWDATE:2030-01-07", `RESCHEDULE:${ids[0]}@2030-01-07`]);
    const { count } = await db.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", patient.id);
    expect(count).toBe(1);
  });

  it("'Ver horarios' del menú no continúa una reprogramación abandonada", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero reprogramar mi turno");
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: "reschedule", appointmentId: ids[0] });
    await say(phone, "Ver horarios", { payload: "MENU:AVAIL" });
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: "booking" });
  });

  it("un flujo sin actividad por más de 2 horas se descarta", async () => {
    const { phone } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero reprogramar mi turno");
    const { conversation } = await conversationOf(phone);
    const stale = { ...(conversation.state as object), updatedAt: new Date(Date.now() - 3 * 3600_000).toISOString() };
    await db.from("whatsapp_conversations").update({ state: stale }).eq("id", conversation.id);
    await say(phone, "gracias");
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: null });
  });

  /* ---------------------------------------------------------------------- */
  /* Séptima ronda: hallazgos de la revisión de la sexta                     */
  /* ---------------------------------------------------------------------- */

  it("una hora mencionada sin elegirla («a las X no puedo») no mueve el turno; la hora sola sí", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    const days = await say(phone, "quiero reprogramar mi turno");
    await say(phone, "día", { payload: firstDate(days) });
    const [slot] = await offered(phone);
    expect(slot).toBeDefined();
    const before = await startOf(ids[0]!);
    await say(phone, `a las ${slot!.label} no puedo, ¿tenés otro día?`);
    expect(await startOf(ids[0]!)).toBe(before);
    await say(phone, `¿tenés algo después de las ${slot!.label}?`);
    expect(await startOf(ids[0]!)).toBe(before);
    await say(phone, slot!.label);
    expect(await startOf(ids[0]!)).toBe(Date.parse(slot!.start));
  });

  it("«quiero cambiar mi turno» durante una reserva pregunta antes de crear otro turno", async () => {
    const { phone, ids, patient } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero sacar un turno");
    const out = await say(phone, "quiero cambiar mi turno para el 12/11");
    expect(out.at(-1)?.buttons.some((b) => b.startsWith(`RESCHEDULE:${ids[0]}`))).toBe(true);
    expect(out.at(-1)?.buttons.some((b) => b.startsWith("NEWDATE:"))).toBe(true);
    expect(await appointmentCount(patient.id)).toBe(1);
  });

  it("un horario de una lista vieja sin flujo activo pregunta en vez de reservar", async () => {
    const { phone, ids, patient } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    const out = await say(phone, "16:00", { payload: "SLOT:20300107T1900" });
    expect(out.at(-1)?.buttons).toContain(`RESCHEDULE:${ids[0]}@2030-01-07`);
    expect(await appointmentCount(patient.id)).toBe(1);
  });

  it("durante una reprogramación, cambiar la modalidad no se aplica al turno", async () => {
    const { phone } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "quiero reprogramar mi turno");
    const out = await say(phone, "Agendar presencial", { payload: "MOD:presencial" });
    expect(out[0]?.body).toMatch(/modalidad lo coordina el profesional/);
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: "reschedule", modality: "virtual" });
  });

  it("doble toque simultáneo del mismo horario: un solo turno y sin lista nueva", async () => {
    const { phone, patient } = await newPatient();
    await say(phone, "quiero sacar un turno");
    const days = await say(phone, "Videollamada", { payload: "MOD:virtual" });
    await say(phone, "día", { payload: firstDate(days) });
    const [slot] = await offered(phone);
    const key = `SLOT:${new Date(slot!.start).toISOString().replace(/[-:]/g, "").slice(0, 13)}`;
    const before = sent.length;
    await Promise.all([say(phone, slot!.label, { payload: key }), say(phone, slot!.label, { payload: key })]);
    expect(await appointmentCount(patient.id)).toBe(1);
    expect(sent.slice(before).some((m) => m.buttons.some((b) => b.startsWith("SLOT:")))).toBe(false);
    expect((await conversationOf(phone)).conversation.state).toMatchObject({ flow: null });
  });

  it("botones viejos sobre un turno cancelado no hablan de «cercanía de la fecha» ni avisan", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "cancelled" }]);
    const out = await say(phone, "Sí, cancelar", { payload: `CANCELYES:${ids[0]}` });
    expect(out.at(-1)?.body).toMatch(/ya está cancelado/);
    const again = await say(phone, "Reprogramar", { payload: `RESCHEDULE:${ids[0]}` });
    expect(again.at(-1)?.body).toMatch(/ya está cancelado/);
    expect(await humanRequests(phone)).toHaveLength(0);
  });

  it("crisis: pedir al psicólogo mientras hay una pregunta de cancelación pendiente lo avisa", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }]);
    await say(phone, "no quiero seguir viviendo");
    await say(phone, "Cancelar", { payload: `CANCEL:${ids[0]}` });
    const out = await say(phone, "No sé, necesito hablar con el psicólogo por favor");
    expect(out.at(-1)?.body).toMatch(/ya le avisé/i);
    expect(await humanRequests(phone)).toHaveLength(1);
    expect(await status(ids[0]!)).toBe("confirmed");
  });

  it("derivación común: «sí, confirmo» a un recordatorio confirma ese turno", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "pending" }]);
    await say(phone, "quiero hablar con el psicólogo");
    await systemMessage(phone, "reminder_24h", ids[0]!);
    await say(phone, "Sí, confirmo");
    expect(await status(ids[0]!)).toBe("confirmed");
  });

  it("si la modalidad se escribe, se mantiene el día pedido", async () => {
    const { phone } = await newPatient();
    await say(phone, "quiero un turno el miércoles");
    const { conversation } = await conversationOf(phone);
    const day = (conversation.state as { dateKey?: string }).dateKey;
    expect(day).toBeTruthy();
    const out = await say(phone, "virtual");
    expect(out.at(-1)?.buttons.some((b) => b.startsWith("SLOT:") || b === `DATE:${day}`) || /no tengo lugar/.test(out.at(-1)?.body ?? "")).toBe(true);
  });

  it("crisis: «Sí, quiero» a «Avisar al psicólogo» avisa y responde", async () => {
    const { phone } = await newPatient();
    await say(phone, "no quiero seguir viviendo");
    const out = await say(phone, "Sí, quiero 🙏");
    expect(out.at(-1)?.body).toMatch(/ya le avisé/i);
    expect(await humanRequests(phone)).toHaveLength(1);
  });

  it("«Sí, avisale» responde a «¿Le aviso?» aunque después haya llegado un aviso de otro turno", async () => {
    const { phone, ids } = await newPatient([{ inHours: 5, status: "confirmed" }, { inDays: 20, status: "pending" }]);
    const ask = await say(phone, "quiero reprogramar mi turno");
    expect(ask.at(-1)?.buttons).toEqual(["HUMAN:RESCHEDULE"]);
    await systemMessage(phone, "appointment_changed", ids[1]!);
    await say(phone, "Sí, avisale");
    expect(await status(ids[1]!)).toBe("pending");
    expect((await humanRequests(phone)).some((n) => /cambio/.test(n.body ?? ""))).toBe(true);
  });

  it("«no voy a poder ir» después del aviso de un turno se refiere a ESE turno", async () => {
    const { phone, ids } = await newPatient([{ inDays: 20, status: "confirmed" }, { inDays: 22, status: "rescheduled" }]);
    await say(phone, "hola");
    await systemMessage(phone, "appointment_changed", ids[1]!);
    const out = await say(phone, "No voy a poder ir");
    expect(out.at(-1)?.buttons).toContain(`CANCELYES:${ids[1]}`);
  });

  it("crisis: un «no» a «¿Le aviso?» no se responde «ya le avisé»; otra cosa vuelve a preguntar", async () => {
    const { phone, ids } = await newPatient([{ inHours: 4, status: "confirmed" }]);
    await say(phone, "no quiero seguir viviendo");
    await say(phone, "Sí, cancelar", { payload: `CANCELYES:${ids[0]}` });
    const other = await say(phone, "mmm");
    expect(other.at(-1)?.buttons).toEqual(["HUMAN:CANCEL"]);
    const no = await say(phone, "no");
    expect(no.at(-1)?.body).not.toMatch(/ya le avisé/i);
    expect((await humanRequests(phone)).filter((n) => /cancelación/.test(n.body ?? ""))).toHaveLength(0);
  });

  it("un pedido distinto se avisa aunque haya habido otro hace menos de 10 minutos", async () => {
    const { phone, ids } = await newPatient([{ inHours: 6, status: "confirmed" }]);
    await say(phone, "quiero hablar con el psicólogo");
    await say(phone, "Sí, cancelar", { payload: `CANCELYES:${ids[0]}` });
    await say(phone, "sí");
    const notices = await humanRequests(phone);
    expect(notices).toHaveLength(2);
    expect(notices.some((n) => /cancelación/.test(n.body ?? ""))).toBe(true);
  });

  it("«Avisar al psicólogo» de un mensaje de crisis anterior sigue siendo urgente", async () => {
    const { phone } = await newPatient();
    const out = await say(phone, "Avisar al psicólogo", { payload: "HUMAN:CRISIS" });
    expect((await humanRequests(phone)).some((n) => /crisis/.test(n.body ?? ""))).toBe(true);
    const { conversation } = await conversationOf(phone);
    expect(conversation.status).toBe("handed_off");
    expect(conversation.crisis_flagged_at).toBeTruthy();
    expect(out.at(-1)?.body).toMatch(/ya le avisé/i);
  });

  it("la derivación por crisis no vence mientras la persona sigue escribiendo", async () => {
    const { phone } = await newPatient();
    await say(phone, "no quiero seguir viviendo");
    const { conversation } = await conversationOf(phone);
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    await db.from("whatsapp_conversations").update({ handed_off_at: old, crisis_flagged_at: old }).eq("id", conversation.id);
    await say(phone, "sigo esperando, estoy muy mal");
    expect((await conversationOf(phone)).conversation.status).toBe("handed_off");
  });

  it("un contacto dado de baja que escribe un mensaje de crisis recibe el protocolo", async () => {
    const { phone } = await newPatient();
    await say(phone, "hola");
    await db.from("whatsapp_contacts").update({ opted_out: true }).eq("phone", phone);
    const out = await say(phone, "no quiero seguir viviendo");
    expect(out.at(-1)?.buttons).toContain("HUMAN:CRISIS");
    await db.from("whatsapp_contacts").update({ opted_out: false }).eq("phone", phone);
  });

  it("crisis: un audio después del mensaje de crisis recibe respuesta", async () => {
    const { phone } = await newPatient();
    await say(phone, "no quiero seguir viviendo");
    const out = await say(phone, "", { type: "unsupported" });
    expect(out.at(-1)?.body).toMatch(/no puedo escuchar audios/i);
  });

  it("un botón con el turno de otra persona no actúa sobre el turno propio", async () => {
    const other = await newPatient([{ inDays: 20, status: "pending" }]);
    const { phone, ids } = await newPatient([{ inDays: 21, status: "pending" }]);
    const out = await say(phone, "Confirmar", { payload: `CONFIRM:${other.ids[0]}` });
    expect(out.at(-1)?.body).toMatch(/No encuentro/);
    expect(await status(ids[0]!)).toBe("pending");
    expect(await status(other.ids[0]!)).toBe("pending");
  });

  it("un número que es el WhatsApp de una ficha y el teléfono de otra no identifica a nadie", async () => {
    const shared = `+5959818${String(Date.now()).slice(-6)}`;
    const daughter = await newPatient([{ inDays: 20, status: "pending" }], { phone: shared });
    const mother = await newPatient([{ inDays: 21, status: "pending" }], { phone: shared, whatsapp: false });
    await say(shared, "Confirmar", { payload: `CONFIRM:${mother.ids[0]}` });
    expect(await status(mother.ids[0]!)).toBe("pending");
    expect(await status(daughter.ids[0]!)).toBe("pending");
  });
});
