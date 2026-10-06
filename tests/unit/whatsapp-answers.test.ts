import { describe, expect, it } from "vitest";

import { classifyByRules } from "@/server/services/ai/rules";
import { classifyCancelAnswer, isCrisisHandoff, slotKey, slotKeyToDate } from "@/server/services/whatsapp/answers";

// La intención se calcula con el clasificador real por reglas (el que corre por defecto):
// así los casos reflejan lo que llega en producción, no una intención idealizada.
function answer(text: string) {
  const { intent } = classifyByRules({ message: text, todayDateKey: "2026-10-06", timezone: "America/Asuncion", activeFlow: "cancel", recentMessages: [] });
  return classifyCancelAnswer(text, intent);
}

describe("respuesta a '¿Querés cancelar tu sesión?'", () => {
  it.each([
    "Sí",
    "sí.",
    "Si",
    "dale",
    "ok",
    "Ok.",
    "listo",
    "perfecto",
    "si, cancelala",
    "Sí por favor",
    "claro",
    "Cancelala por favor",
    "No voy a poder ir",
    "No voy a ir",
    "No, no voy a ir",
    "no puedo asistir",
    "No, cancelalo",
    "anulala",
    "quiero cancelar",
    "no sé, cancelala nomás",
  ])("cancela ante '%s'", (text) => {
    expect(answer(text)).toBe("cancel");
  });

  it.each([
    "No",
    "no gracias",
    "Mejor no",
    "No la canceles",
    "no quiero cancelar",
    "no quiero cancelarla",
    "No, no voy a cancelar",
    "no hace falta cancelar",
    "no la quiero cancelar",
    "mantenela",
    "dejala así",
  ])("mantiene el turno ante '%s'", (text) => {
    expect(answer(text)).toBe("keep");
  });

  it.each(["Perdón, me equivoqué de botón, confirmo que voy", "confirmo", "sí voy", "voy igual", "ahí estaré"])("confirma asistencia ante '%s'", (text) => {
    expect(answer(text)).toBe("confirm_attendance");
  });

  it.each(["mejor cambiarla para otro día", "quiero reprogramar", "¿se puede pasar a otro horario?"])("detecta un pedido de cambio en '%s'", (text) => {
    expect(answer(text)).toBe("reschedule");
  });

  it.each(["hmm no sé", "¿a qué hora era?", "Sí, confirmo", "no sé si voy a poder ir", "capaz voy", "tal vez vaya", "no sé si cancelarla"])("ante lo ambiguo ('%s') vuelve a preguntar", (text) => {
    expect(answer(text)).toBe("unclear");
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
