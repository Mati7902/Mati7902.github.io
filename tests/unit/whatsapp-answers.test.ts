import { describe, expect, it } from "vitest";

import { classifyByRules } from "@/server/services/ai/rules";
import { classifyCancelAnswer, isBareConfirm, isBareYes, isCrisisHandoff, slotKey, slotKeyToDate } from "@/server/services/whatsapp/answers";

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
    "dale",
    "ok",
    "perfecto",
    "si, cancelala",
    "Cancelala por favor",
    "No voy a poder ir",
    "No voy a ir",
    "No, no voy a ir",
    "no puedo asistir",
    "No, cancelalo",
    "anulala",
    "quiero cancelar",
    "No asistiré",
    "No, ya no voy a ir",
    "No, igual no voy a poder ir",
    "No. Al final no puedo ir",
    "sí, cancelala, la saqué por error",
    "Me equivoqué de día al reservar, cancelala",
    "Estoy apurado, cancelala porfa",
    "No puedo ir, no la mantengas",
    "Dejala, no voy a ir",
    "confirmo que no voy",
  ])("'%s' pide confirmar la cancelación con el botón (nunca cancela directo)", (text) => {
    expect(answer(text)).toBe("cancel_intent");
  });

  it.each([
    "No",
    "no gracias",
    "Mejor no",
    "No la canceles",
    "nooo la canceles",
    "no quiero cancelar",
    "no quiero cancelarla",
    "No, no voy a cancelar",
    "No, no quería cancelar",
    "no quería cancelarla, me equivoqué",
    "Perdón, toqué cancelar sin querer",
    "No, le di a cancelar por error",
    "No quiero que la canceles",
    "no hace falta que la canceles",
    "No la cancelo",
    "no me la canceles",
    "mantenela",
    "dejala así",
    "No, voy a ir",
    "No no, voy a ir",
    "no, voy a ir igual",
    "No, voy a poder ir",
    "No, puedo ir igual",
    "No, la mantengo. Si no puedo ir te aviso",
    "Perdón, me equivoqué de botón, confirmo que voy",
    "sí voy",
    "voy igual",
    "ahí estaré",
  ])("'%s' mantiene el turno", (text) => {
    expect(answer(text)).toBe("keep");
  });

  it.each(["mejor cambiarla para otro día", "quiero reprogramar", "se puede pasar a otro horario"])("'%s' inicia una reprogramación", (text) => {
    expect(answer(text)).toBe("reschedule");
  });

  it.each(["¿Hasta cuándo puedo cancelar sin que me cobren?", "pero hasta cuándo puedo cancelar?", "se cobra si cancelo?", "no, solo preguntaba hasta cuándo puedo cancelar"])(
    "'%s' es una pregunta: se informa la política y se vuelve a preguntar",
    (text) => {
      expect(answer(text)).toBe("question");
    },
  );

  it.each(["hmm", "¿a qué hora era?", "te confirmo mañana", "nos vemos la próxima"])("'%s' vuelve a preguntar o no cancela", (text) => {
    expect(["unclear", "question"]).toContain(answer(text));
  });

  it("ninguna respuesta escrita produce una acción irreversible", () => {
    const outcomes = new Set(["keep", "reschedule", "cancel_intent", "question", "unclear"]);
    for (const text of ["Sí", "No, voy a ir", "llego tarde", "no voy a llegar a tiempo", "capaz no voy a poder ir", "confirmo que no voy"]) {
      expect(outcomes.has(answer(text))).toBe(true);
    }
  });
});

describe("sí suelto a una pregunta de sí/no", () => {
  it.each(["Sí", "sii", "dale", "Ok.", "sí, avisale", "si por favor"])("'%s' cuenta como sí", (text) => {
    expect(isBareYes(text)).toBe(true);
  });
  it.each(["sí, pero mañana", "no", "sí cancelala", "¿qué?"])("'%s' no es un sí suelto", (text) => {
    expect(isBareYes(text)).toBe(false);
  });
});

describe("confirmación escrita a un recordatorio", () => {
  it.each(["Sí", "confirmo", "Confirmo, gracias", "sí, confirmo", "Ahí estaré", "voy", "dale", "Confirmado!"])("'%s' confirma", (text) => {
    expect(isBareConfirm(text)).toBe(true);
  });
  it.each(["no", "no voy", "sí, pero cambiala", "confirmo que no voy", "voy a llegar tarde", "¿a qué hora era?", "gracias", ""])("'%s' no confirma", (text) => {
    expect(isBareConfirm(text)).toBe(false);
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
