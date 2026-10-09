import { describe, expect, it } from "vitest";

import { generateDaySlots, groupSlotsByPeriod, isWithinAvailability, overlaps, upcomingAvailableDates, weekdayOf, type AvailabilityRuleInput } from "@/lib/scheduling/slots";

const TZ = "America/Asuncion";
// 2026-10-13 es martes.
const TUESDAY = "2026-10-13";
const rules: AvailabilityRuleInput[] = [
  { weekday: 2, start_time: "14:00", end_time: "18:00", slot_duration_minutes: 60, buffer_minutes: 0, modality: "mixta" },
];
const early = new Date("2026-10-01T12:00:00Z");

describe("motor de disponibilidad", () => {
  it("calcula el día de la semana en la zona operativa", () => {
    expect(weekdayOf(TUESDAY, TZ)).toBe(2);
    expect(weekdayOf("2026-10-11", TZ)).toBe(0);
  });

  it("genera slots de duración + intervalo dentro de la franja", () => {
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules, busy: [], modality: "presencial", now: early });
    expect(slots.map((s) => s.label)).toEqual(["14:00", "15:00", "16:00", "17:00"]);
    // 14:00 en Asunción (UTC-3 en octubre) = 17:00Z
    expect(slots[0]?.start.toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("respeta el intervalo entre pacientes", () => {
    const withBuffer = [{ ...rules[0]!, buffer_minutes: 30 }];
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules: withBuffer, busy: [], modality: "presencial", now: early });
    expect(slots.map((s) => s.label)).toEqual(["14:00", "15:30", "17:00"]);
  });

  it("no devuelve nada en días sin regla", () => {
    expect(generateDaySlots({ dateKey: "2026-10-14", timezone: TZ, rules, busy: [], modality: "presencial", now: early })).toHaveLength(0);
  });

  it("descarta horarios ocupados y solapamientos parciales", () => {
    const busy = [{ start: new Date("2026-10-13T18:30:00Z"), end: new Date("2026-10-13T19:30:00Z") }]; // 15:30–16:30 local
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules, busy, modality: "presencial", now: early });
    expect(slots.map((s) => s.label)).toEqual(["14:00", "17:00"]);
  });

  it("descarta horarios pasados y dentro de la anticipación mínima", () => {
    const now = new Date("2026-10-13T17:30:00Z"); // 14:30 local
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules, busy: [], modality: "presencial", now, minHoursBeforeBooking: 1 });
    expect(slots.map((s) => s.label)).toEqual(["16:00", "17:00"]);
  });

  it("filtra por modalidad de la regla", () => {
    const virtualOnly = [{ ...rules[0]!, modality: "virtual" as const }];
    expect(generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules: virtualOnly, busy: [], modality: "presencial", now: early })).toHaveLength(0);
    expect(generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules: virtualOnly, busy: [], modality: "virtual", now: early })).toHaveLength(4);
  });

  it("respeta vigencia de la regla y el máximo de días hacia adelante", () => {
    const expired = [{ ...rules[0]!, valid_until: "2026-10-01" }];
    expect(generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules: expired, busy: [], modality: "presencial", now: early })).toHaveLength(0);
    expect(generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules, busy: [], modality: "presencial", now: early, maxDaysInAdvance: 5 })).toHaveLength(0);
  });

  it("no duplica horarios cuando dos reglas se superponen", () => {
    const twoRules = [...rules, { ...rules[0]!, start_time: "16:00", end_time: "19:00" }];
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules: twoRules, busy: [], modality: "presencial", now: early });
    expect(slots.map((s) => s.label)).toEqual(["14:00", "15:00", "16:00", "17:00", "18:00"]);
  });

  it("valida que un rango esté dentro de la disponibilidad", () => {
    expect(isWithinAvailability(new Date("2026-10-13T17:00:00Z"), new Date("2026-10-13T18:00:00Z"), rules, TZ, "presencial")).toBe(true);
    expect(isWithinAvailability(new Date("2026-10-13T20:30:00Z"), new Date("2026-10-13T21:30:00Z"), rules, TZ, "presencial")).toBe(false);
  });

  it("lista próximas fechas con reglas activas y agrupa por franja horaria", () => {
    const dates = upcomingAvailableDates(rules, TZ, 14, new Date("2026-10-12T12:00:00Z"));
    expect(dates).toEqual(["2026-10-13", "2026-10-20"]);
    const slots = generateDaySlots({ dateKey: TUESDAY, timezone: TZ, rules, busy: [], modality: "presencial", now: early });
    const groups = groupSlotsByPeriod(slots, TZ);
    expect(groups.afternoon.map((s) => s.label)).toEqual(["14:00", "15:00", "16:00", "17:00"]);
    expect(groups.evening).toHaveLength(0);
  });

  it("overlaps detecta intersecciones semiabiertas", () => {
    const a = new Date("2026-01-01T10:00:00Z");
    const b = new Date("2026-01-01T11:00:00Z");
    const c = new Date("2026-01-01T12:00:00Z");
    expect(overlaps(a, b, b, c)).toBe(false);
    expect(overlaps(a, c, b, c)).toBe(true);
  });
});
