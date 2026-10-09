import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { AppointmentModality } from "@/types/domain";

/**
 * Motor de disponibilidad: funciones puras (sin acceso a base de datos) para poder testearlas
 * de forma aislada. Todo se calcula en la zona horaria operativa (America/Asuncion por defecto)
 * y se devuelve en instantes UTC.
 */

export type AvailabilityRuleInput = {
  weekday: number; // 0 = domingo
  start_time: string; // "HH:MM" o "HH:MM:SS"
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  modality: "presencial" | "virtual" | "mixta";
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
};

export type BusyRange = { start: Date; end: Date };

export type Slot = {
  start: Date;
  end: Date;
  /** Clave estable para el UI: ISO del inicio. */
  key: string;
  label: string; // "16:00"
};

export type SlotOptions = {
  /** Fecha del día a calcular en formato yyyy-MM-dd (en la zona dada). */
  dateKey: string;
  timezone: string;
  rules: AvailabilityRuleInput[];
  /** Turnos existentes no cancelados, bloqueos y períodos ocupados del calendario externo. */
  busy: BusyRange[];
  modality: AppointmentModality;
  /** Duración deseada; si no se indica, se usa la de la regla. */
  durationMinutes?: number;
  now?: Date;
  minHoursBeforeBooking?: number;
  maxDaysInAdvance?: number;
};

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function parseTime(time: string): { h: number; m: number } {
  const [h = "0", m = "0"] = time.split(":");
  return { h: Number(h), m: Number(m) };
}

function ruleAppliesToModality(rule: AvailabilityRuleInput, modality: AppointmentModality): boolean {
  return rule.modality === "mixta" || rule.modality === modality;
}

function ruleValidOn(rule: AvailabilityRuleInput, dateKey: string): boolean {
  if (rule.is_active === false) return false;
  if (rule.valid_from && dateKey < rule.valid_from) return false;
  if (rule.valid_until && dateKey > rule.valid_until) return false;
  return true;
}

/** Día de la semana (0=domingo) de una fecha yyyy-MM-dd interpretada en la zona dada. */
export function weekdayOf(dateKey: string, timezone: string): number {
  const noon = fromZonedTime(`${dateKey}T12:00:00`, timezone);
  return Number(formatInTimeZone(noon, timezone, "i")) % 7;
}

/**
 * Genera los horarios disponibles de un día.
 * - Respeta reglas por día de semana, modalidad y vigencia.
 * - Avanza en pasos de duración + intervalo (buffer).
 * - Descarta solapamientos con turnos existentes, bloqueos y calendario externo.
 * - Descarta horarios pasados o dentro de la anticipación mínima.
 */
export function generateDaySlots(options: SlotOptions): Slot[] {
  const {
    dateKey,
    timezone,
    rules,
    busy,
    modality,
    durationMinutes,
    now = new Date(),
    minHoursBeforeBooking = 0,
    maxDaysInAdvance,
  } = options;

  const weekday = weekdayOf(dateKey, timezone);
  const earliest = addMinutes(now, minHoursBeforeBooking * 60);
  if (maxDaysInAdvance !== undefined) {
    const limit = addMinutes(now, maxDaysInAdvance * 24 * 60);
    const dayStart = fromZonedTime(`${dateKey}T00:00:00`, timezone);
    if (dayStart > limit) return [];
  }

  const slots: Slot[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (rule.weekday !== weekday) continue;
    if (!ruleAppliesToModality(rule, modality)) continue;
    if (!ruleValidOn(rule, dateKey)) continue;

    const duration = durationMinutes ?? rule.slot_duration_minutes;
    const step = duration + rule.buffer_minutes;
    if (duration <= 0 || step <= 0) continue;

    const { h: sh, m: sm } = parseTime(rule.start_time);
    const { h: eh, m: em } = parseTime(rule.end_time);
    const windowStart = fromZonedTime(`${dateKey}T${pad(sh)}:${pad(sm)}:00`, timezone);
    const windowEnd = fromZonedTime(`${dateKey}T${pad(eh)}:${pad(em)}:00`, timezone);

    for (let start = windowStart; addMinutes(start, duration) <= windowEnd; start = addMinutes(start, step)) {
      const end = addMinutes(start, duration);
      if (start < earliest) continue;
      if (busy.some((b) => overlaps(start, end, b.start, b.end))) continue;
      const key = start.toISOString();
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ start, end, key, label: formatInTimeZone(start, timezone, "HH:mm") });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Devuelve las fechas (yyyy-MM-dd) de los próximos N días que tienen alguna regla activa. */
export function upcomingAvailableDates(rules: AvailabilityRuleInput[], timezone: string, days: number, from = new Date()): string[] {
  const out: string[] = [];
  const activeWeekdays = new Set(rules.filter((r) => r.is_active !== false).map((r) => r.weekday));
  for (let i = 0; i < days; i++) {
    const date = addMinutes(from, i * 24 * 60);
    const key = formatInTimeZone(date, timezone, "yyyy-MM-dd");
    if (activeWeekdays.has(weekdayOf(key, timezone))) out.push(key);
  }
  return out;
}

/** Comprueba si un rango cae dentro de alguna regla de disponibilidad (para validar reservas). */
export function isWithinAvailability(start: Date, end: Date, rules: AvailabilityRuleInput[], timezone: string, modality: AppointmentModality): boolean {
  const dateKey = formatInTimeZone(start, timezone, "yyyy-MM-dd");
  const weekday = weekdayOf(dateKey, timezone);
  return rules.some((rule) => {
    if (rule.weekday !== weekday || !ruleAppliesToModality(rule, modality) || !ruleValidOn(rule, dateKey)) return false;
    const { h: sh, m: sm } = parseTime(rule.start_time);
    const { h: eh, m: em } = parseTime(rule.end_time);
    const windowStart = fromZonedTime(`${dateKey}T${pad(sh)}:${pad(sm)}:00`, timezone);
    const windowEnd = fromZonedTime(`${dateKey}T${pad(eh)}:${pad(em)}:00`, timezone);
    return start >= windowStart && end <= windowEnd;
  });
}

/** Agrupa horarios en franjas humanas (mañana / tarde / noche) para el chatbot y la UI. */
export function groupSlotsByPeriod(slots: Slot[], timezone: string): { morning: Slot[]; afternoon: Slot[]; evening: Slot[] } {
  const groups = { morning: [] as Slot[], afternoon: [] as Slot[], evening: [] as Slot[] };
  for (const slot of slots) {
    const hour = Number(formatInTimeZone(slot.start, timezone, "H"));
    if (hour < 12) groups.morning.push(slot);
    else if (hour < 18) groups.afternoon.push(slot);
    else groups.evening.push(slot);
  }
  return groups;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
