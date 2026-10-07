// @vitest-environment node
/**
 * Recorridos de conversación del chatbot de WhatsApp contra la base de la vista previa local
 * (Postgres + PostgREST + pasarela). Los envíos a WhatsApp se simulan; todo lo demás (estado de la
 * conversación, turnos, avisos al profesional) es real.
 *
 * Requiere la vista previa corriendo (pnpm preview:local) y se ejecuta con: pnpm test:bot
 * Crea pacientes ficticios propios y los borra al terminar. Nunca usar contra producción.
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
  if (originalWhatsApp) await db.from("settings").update({ value: originalWhatsApp as never }).eq("key", "whatsapp");
  const { data: contacts } = await db.from("whatsapp_contacts").select("id").in("phone", createdPhones);
  const contactIds = (contacts ?? []).map((c) => c.id);
  if (contactIds.length) {
    for (const id of contactIds) await db.from("notifications").delete().eq("data->>contact_id", id);
    await db.from("whatsapp_messages").delete().in("contact_id", contactIds);
    await db.from("whatsapp_conversations").delete().in("contact_id", contactIds);
    await db.from("whatsapp_contacts").delete().in("id", contactIds);
  }
  if (createdPatients.length) {
    await db.from("appointments").update({ status: "cancelled" }).in("patient_id", createdPatients);
    await db.from("appointments").delete().in("patient_id", createdPatients);
    await db.from("patients").delete().in("id", createdPatients);
  }
}

/** Paciente ficticio con turnos propios en horarios que no se pisan con otras pruebas. */
async function newPatient(appointments: { inDays: number; status: Database["public"]["Enums"]["appointment_status"]; at?: Date }[] = []) {
  const n = ++seq;
  const phone = `+5959819${String(Date.now()).slice(-4)}${String(n).padStart(2, "0")}`;
  const { data: patient, error } = await db
    .from("patients")
    .insert({ first_name: "Prueba", last_name: `Bot ${n}`, phone, whatsapp_phone: phone })
    .select("*")
    .single();
  if (error) throw error;
  createdPatients.push(patient.id);
  createdPhones.push(phone);
  const ids: string[] = [];
  for (const [i, a] of appointments.entries()) {
    // 03:00 UTC (madrugada local) de días lejanos: no choca con turnos de la demo ni con otras pruebas.
    const start = a.at ? new Date(a.at) : new Date();
    if (!a.at) {
      start.setUTCHours(3 + i, (n * 7) % 60, 0, 0);
      start.setUTCDate(start.getUTCDate() + a.inDays + n * 3);
    }
    const end = new Date(start.getTime() + 30 * 60_000);
    const { data, error: e } = await db
      .from("appointments")
      .insert({ patient_id: patient.id, start_time: start.toISOString(), end_time: end.toISOString(), modality: "virtual", status: a.status, source: "admin" })
      .select("id")
      .single();
    if (e) throw e;
    ids.push(data.id);
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
    const soon = new Date(Date.now() + 3 * 3600_000 + 17 * 60_000);
    soon.setUTCSeconds(0, 0);
    const { phone, ids } = await newPatient([{ inDays: 0, status: "confirmed", at: soon }]);
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
    expect(out.at(-1)?.buttons).toEqual(["NEWDATE:2030-01-07", `RESCHEDULE:${ids[0]}`]);
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
});
