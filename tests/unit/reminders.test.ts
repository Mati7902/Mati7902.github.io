import { describe, expect, it } from "vitest";

import { isQuietHour, selectReminderCandidates } from "@/server/services/reminders";

const now = new Date("2026-10-12T15:00:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * 3600_000).toISOString();

const base = { patient_id: "p1", reminder_24h_sent_at: null, reminder_2h_sent_at: null };

describe("selección de recordatorios (sin duplicados)", () => {
  it("elige turnos confirmados/pendientes dentro de la ventana de 24 h", () => {
    const rows = [
      { ...base, id: "in-window", status: "confirmed", start_time: at(23.5) },
      { ...base, id: "pending-in-window", status: "pending", start_time: at(23.9) },
      { ...base, id: "too-early", status: "confirmed", start_time: at(26) },
      { ...base, id: "too-late", status: "confirmed", start_time: at(20) },
      { ...base, id: "cancelled", status: "cancelled", start_time: at(23.5) },
      { ...base, id: "requested", status: "requested", start_time: at(23.5) },
    ];
    const picked = selectReminderCandidates(rows, "reminder_24h", 24, 90, now).map((r) => r.id);
    expect(picked).toEqual(["in-window", "pending-in-window"]);
  });

  it("nunca repite un recordatorio ya enviado", () => {
    const rows = [
      { ...base, id: "already", status: "confirmed", start_time: at(23.5), reminder_24h_sent_at: "2026-10-11T15:00:00Z" },
      { ...base, id: "fresh", status: "confirmed", start_time: at(23.5) },
    ];
    expect(selectReminderCandidates(rows, "reminder_24h", 24, 90, now).map((r) => r.id)).toEqual(["fresh"]);
    // El recordatorio adicional tiene su propia marca independiente.
    const extra = [{ ...base, id: "x", status: "confirmed", start_time: at(1.8), reminder_24h_sent_at: "2026-10-11T15:00:00Z" }];
    expect(selectReminderCandidates(extra, "reminder_2h", 2, 30, now)).toHaveLength(1);
    expect(selectReminderCandidates([{ ...extra[0]!, reminder_2h_sent_at: "x" }], "reminder_2h", 2, 30, now)).toHaveLength(0);
  });

  it("ejecutar dos veces el mismo ciclo no selecciona dos veces (idempotencia lógica)", () => {
    const rows = [{ ...base, id: "a", status: "confirmed", start_time: at(23.5) }];
    const first = selectReminderCandidates(rows, "reminder_24h", 24, 90, now);
    const afterSend = rows.map((r) => (first.some((f) => f.id === r.id) ? { ...r, reminder_24h_sent_at: now.toISOString() } : r));
    expect(selectReminderCandidates(afterSend, "reminder_24h", 24, 90, now)).toHaveLength(0);
  });

  it("ignora turnos que ya empezaron", () => {
    const rows = [{ ...base, id: "past", status: "confirmed", start_time: at(-1) }];
    expect(selectReminderCandidates(rows, "reminder_2h", 2, 300, now)).toHaveLength(0);
  });
});

describe("horas de silencio", () => {
  it("respeta rangos que cruzan la medianoche", () => {
    const tz = "America/Asuncion";
    expect(isQuietHour(new Date("2026-10-13T02:00:00Z"), tz, "22:00", "08:00")).toBe(true); // 23:00 local
    expect(isQuietHour(new Date("2026-10-13T18:00:00Z"), tz, "22:00", "08:00")).toBe(false); // 15:00 local
    expect(isQuietHour(new Date("2026-10-13T10:30:00Z"), tz, "22:00", "08:00")).toBe(true); // 07:30 local
    expect(isQuietHour(new Date("2026-10-13T12:00:00Z"), tz, "09:00", "09:00")).toBe(false);
  });
});
