import { describe, expect, it } from "vitest";

import { classifyByRules, resolveExplicitTime, resolveModality, resolveRelativeDate, resolveTimePreference } from "@/server/services/ai/rules";
import { parseIntentJson } from "@/server/services/ai/provider";

const TZ = "America/Asuncion";
const TODAY = "2026-10-12"; // lunes

const classify = (message: string) => classifyByRules({ message, todayDateKey: TODAY, timezone: TZ });

describe("clasificador por reglas", () => {
  it.each([
    ["Hola Mati, ¿tenés algo para el martes de tarde?", "CHECK_AVAILABILITY"],
    ["quiero sacar un turno", "BOOK_APPOINTMENT"],
    ["necesito cambiar mi turno del jueves", "RESCHEDULE_APPOINTMENT"],
    ["quiero cancelar la sesión", "CANCEL_APPOINTMENT"],
    ["confirmo", "CONFIRM_APPOINTMENT"],
    ["cuánto sale la consulta?", "PRICING"],
    ["tenés plan mensual?", "PLANS"],
    ["dónde queda el consultorio", "LOCATION"],
    ["atendés online?", "ONLINE_SESSION"],
    ["olvidé mi contraseña de la app", "LOGIN_HELP"],
    ["quiero hablar con Matías", "SPEAK_TO_HUMAN"],
    ["hola", "GREETING"],
    ["muchas gracias!", "THANKS"],
  ])("«%s» → %s", (text, intent) => {
    expect(classify(text).intent).toBe(intent);
  });

  it("marca contenido clínico sin inventar una intención administrativa", () => {
    const result = classify("últimamente tengo mucha ansiedad y no duermo");
    expect(result.intent).toBe("OTHER");
    expect(result.clinical_content).toBe(true);
    expect(result.crisis_signal).toBe(false);
  });

  it("marca señal de crisis", () => {
    expect(classify("no quiero vivir más").crisis_signal).toBe(true);
  });

  it("resuelve fechas relativas en español", () => {
    expect(resolveRelativeDate("mañana", TODAY, TZ)).toBe("2026-10-13");
    expect(resolveRelativeDate("pasado mañana", TODAY, TZ)).toBe("2026-10-14");
    expect(resolveRelativeDate("el martes", TODAY, TZ)).toBe("2026-10-13");
    expect(resolveRelativeDate("el lunes", TODAY, TZ)).toBe("2026-10-19");
    expect(resolveRelativeDate("el 20/10", TODAY, TZ)).toBe("2026-10-20");
    expect(resolveRelativeDate("la semana que viene el miércoles", TODAY, TZ)).toBe("2026-10-21");
    expect(resolveRelativeDate("sin fecha", TODAY, TZ)).toBeNull();
  });

  it("resuelve preferencia horaria, hora explícita y modalidad", () => {
    expect(resolveTimePreference("algo de tarde")).toBe("afternoon");
    expect(resolveTimePreference("a la noche")).toBe("evening");
    expect(resolveExplicitTime("a las 17")).toBe("17:00");
    expect(resolveExplicitTime("a las 5 de la tarde")).toBe("17:00");
    expect(resolveModality("preferiría online")).toBe("virtual");
    expect(resolveModality("presencial por favor")).toBe("presencial");
  });

  it("combina fecha y preferencia en una consulta de disponibilidad", () => {
    const result = classify("Hola Mati, ¿tenés algo para el martes de tarde?");
    expect(result.requested_date).toBe("2026-10-13");
    expect(result.time_preference).toBe("afternoon");
  });
});

describe("parseo de JSON del proveedor de IA", () => {
  it("acepta JSON válido envuelto en texto y valida con Zod", () => {
    const parsed = parseIntentJson('Claro: {"intent":"CHECK_AVAILABILITY","confidence":0.96,"requested_date":"2026-10-13","time_preference":"afternoon"}');
    expect(parsed?.intent).toBe("CHECK_AVAILABILITY");
    expect(parsed?.confidence).toBe(0.96);
  });

  it("rechaza intenciones desconocidas o confianza fuera de rango", () => {
    expect(parseIntentJson('{"intent":"DELETE_ALL","confidence":1}')).toBeNull();
    expect(parseIntentJson('{"intent":"PRICING","confidence":7}')).toBeNull();
    expect(parseIntentJson("sin json")).toBeNull();
  });
});
