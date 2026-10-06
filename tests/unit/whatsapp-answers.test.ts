import { describe, expect, it } from "vitest";

import { classifyCancelAnswer, isCrisisHandoff, slotKey, slotKeyToDate } from "@/server/services/whatsapp/answers";

describe("respuesta a '¿Querés cancelar tu sesión?'", () => {
  it.each([
    ["Sí", null],
    ["si, cancelala", null],
    ["dale", null],
    ["Cancelala por favor", null],
    ["No voy a poder ir", null],
    ["No, cancelalo", null],
    ["no puedo asistir", null],
    ["anulala", null],
    ["quiero cancelar", "CANCEL_APPOINTMENT"],
  ])("cancela ante '%s'", (text, intent) => {
    expect(classifyCancelAnswer(text, intent)).toBe("cancel");
  });

  it.each([
    ["No", null],
    ["no gracias", null],
    ["Mejor no", null],
    ["No la canceles", null],
    ["no quiero cancelar", null],
    ["mantenela", null],
    ["dejala así", null],
  ])("mantiene el turno ante '%s'", (text, intent) => {
    expect(classifyCancelAnswer(text, intent)).toBe("keep");
  });

  it("confirmar asistencia nunca cancela", () => {
    expect(classifyCancelAnswer("Perdón, me equivoqué de botón, confirmo que voy", "CONFIRM_APPOINTMENT")).toBe("confirm_attendance");
    expect(classifyCancelAnswer("confirmo", null)).toBe("confirm_attendance");
    expect(classifyCancelAnswer("sí voy", "CONFIRM_APPOINTMENT")).toBe("confirm_attendance");
  });

  it("detecta pedidos de cambio", () => {
    expect(classifyCancelAnswer("mejor cambiarla para otro día", null)).toBe("reschedule");
    expect(classifyCancelAnswer("quiero reprogramar", "RESCHEDULE_APPOINTMENT")).toBe("reschedule");
  });

  it("ante respuestas ambiguas vuelve a preguntar", () => {
    expect(classifyCancelAnswer("hmm no sé", null)).toBe("unclear");
    expect(classifyCancelAnswer("¿a qué hora era?", "OTHER")).toBe("unclear");
  });
});

describe("claves de horario ofrecido", () => {
  it("son estables, sin ':' y reversibles", () => {
    const key = slotKey("2026-10-07T21:00:00.000Z");
    expect(key).toBe("20261007T2100");
    expect(key).not.toContain(":");
    expect(slotKeyToDate(key)?.toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });

  it("rechazan formatos viejos o inválidos", () => {
    expect(slotKeyToDate("1")).toBeNull();
    expect(slotKeyToDate("2026-10-07")).toBeNull();
  });
});

describe("derivación por crisis", () => {
  it("es de crisis si la señal es de la derivación vigente", () => {
    const at = "2026-10-05T12:00:00.000Z";
    expect(isCrisisHandoff({ crisis_flagged_at: at, handed_off_at: at })).toBe(true);
  });

  it("una crisis ya atendida no marca derivaciones posteriores", () => {
    expect(isCrisisHandoff({ crisis_flagged_at: "2026-10-01T12:00:00.000Z", handed_off_at: "2026-10-05T12:00:00.000Z" })).toBe(false);
    expect(isCrisisHandoff({ crisis_flagged_at: null, handed_off_at: "2026-10-05T12:00:00.000Z" })).toBe(false);
  });
});
