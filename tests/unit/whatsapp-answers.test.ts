import { describe, expect, it } from "vitest";

import { classifyByRules } from "@/server/services/ai/rules";
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
    "No, la voy a tener que cancelar",
    "Sí, la reservé por error",
    "Sí, me equivoqué de día",
    "Si, la pedí sin querer",
    "Sí, voy a estar de viaje",
    "Sí, no la puedo mantener",
    "No voy a poder mantenerla",
    "Dejala sin efecto",
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
    "Perdón, me equivoqué de botón",
    "Sí, voy",
    "Perdón, me equivoqué de botón, confirmo que voy",
    "sí voy",
    "voy igual",
    "ahí estaré",
  ])("'%s' mantiene el turno", (text) => {
    expect(answer(text)).toBe("keep");
  });

  it.each(["mejor cambiarla para otro día", "quiero reprogramar", "se puede pasar a otro horario", "Dejala para otro día"])("'%s' inicia una reprogramación", (text) => {
    expect(answer(text)).toBe("reschedule");
  });

  it.each(["¿Hasta cuándo puedo cancelar sin que me cobren?", "pero hasta cuándo puedo cancelar?", "se cobra si cancelo?", "no, solo preguntaba hasta cuándo puedo cancelar"])(
    "'%s' es una pregunta: se informa la política y se vuelve a preguntar",
    (text) => {
      expect(answer(text)).toBe("question");
    },
  );

  it.each(["hmm", "¿a qué hora era?", "te confirmo mañana", "nos vemos la próxima", "No, me voy de viaje", "llego tarde", "no sé"])("'%s' vuelve a preguntar con botones", (text) => {
    expect(["unclear", "question", "cancel_intent"]).toContain(answer(text));
  });

  // "Mantener" es la única respuesta que se ejecuta por texto (y la que después habilita confirmar
  // con un "sí"): ningún mensaje que mencione no ir, cancelar o un error al reservar puede darla.
  it.each([
    "no voy a llegar a tiempo",
    "capaz no voy a poder ir",
    "No, me voy de viaje",
    "No, la voy a tener que cancelar",
    "Sí, la reservé por error",
    "Dejala, no puedo",
    "no la puedo mantener",
    "Mantenela, no. Cancelala",
    "sí voy a cancelar",
    "No voy, mantené el horario para otro",
  ])("'%s' nunca se toma como «mantener»", (text) => {
    expect(answer(text)).not.toBe("keep");
  });
});

describe("sí suelto a una pregunta de sí/no", () => {
  it.each(["Sí", "sii", "dale", "Ok.", "sí, avisale", "si por favor", "Sí, quiero", "si porfa", "Sí, avisale por favor", "sí 🙏", "Sí sí", "Sí, avisá", "avisale", "que me llame"])(
    "'%s' cuenta como sí",
    (text) => {
      expect(isBareYes(text)).toBe(true);
    },
  );
  it.each(["sí, pero mañana", "no", "sí cancelala", "¿qué?", "no, no le avises"])("'%s' no es un sí suelto", (text) => {
    expect(isBareYes(text)).toBe(false);
  });
  it.each(["no", "No, gracias", "mejor no", "no hace falta"])("'%s' es un no", (text) => {
    expect(isBareNo(text)).toBe(true);
  });
  it("«avisale» nombra la pregunta de avisar al profesional", () => {
    expect(mentionsNotify("Sí, avisale")).toBe(true);
    expect(mentionsNotify("sí")).toBe(false);
  });
});

describe("confirmación escrita a un recordatorio", () => {
  it.each(["Sí", "confirmo", "Confirmo, gracias", "sí, confirmo", "Ahí estaré", "voy", "dale", "Confirmado!"])("'%s' confirma", (text) => {
    expect(isBareConfirm(text)).toBe(true);
  });
  it.each(["no", "no voy", "sí, pero cambiala", "confirmo que no voy", "voy a llegar tarde", "¿a qué hora era?", "gracias", "", "Sí, avisale", "por favor avisale"])("'%s' no confirma", (text) => {
    expect(isBareConfirm(text)).toBe(false);
  });
});

describe("elección de horario por texto", () => {
  it.each(["15", "a las 15", "15:30", "las 15 hs", "a las 3 de la tarde", "16 por favor", "dale, a las 17"])("'%s' elige un horario", (text) => {
    expect(isBareTimeChoice(text)).toBe(true);
  });
  it.each(["a las 15 no puedo, tenés otro día?", "¿tenés algo después de las 17?", "las 14 no me sirve", "puedo después de las 18", "15?"])("'%s' no elige ningún horario", (text) => {
    expect(isBareTimeChoice(text)).toBe(false);
  });
});

describe("mensajes que contradicen el flujo en curso", () => {
  it("cambiar un turno existente durante una reserva", () => {
    expect(refersToExistingAppointment("quiero cambiar mi turno para el 12/11")).toBe(true);
    expect(refersToExistingAppointment("¿tenés otro día?")).toBe(false);
  });
  it("pedir otra sesión durante una reprogramación", () => {
    expect(asksForAnotherAppointment("quiero sacar otro turno para el viernes")).toBe(true);
    expect(asksForAnotherAppointment("mejor el viernes")).toBe(false);
  });
  it("pedir hablar con el profesional", () => {
    expect(asksForProfessional("No sé, necesito hablar con el psicólogo por favor")).toBe(true);
    expect(asksForProfessional("no sé")).toBe(false);
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
