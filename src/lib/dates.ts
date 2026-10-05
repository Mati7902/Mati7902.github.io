import {
  addDays,
  addMinutes,
  differenceInMinutes,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { publicEnv } from "@/lib/env";

export const DEFAULT_TIMEZONE = publicEnv.timezone || "America/Asuncion";

export { addDays, addMinutes, differenceInMinutes, isBefore, isSameDay, parseISO, startOfDay };

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** "martes 14 de octubre" */
export function formatLongDate(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "EEEE d 'de' MMMM", { locale: es });
}

/** "14/10/2026" */
export function formatShortDate(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "dd/MM/yyyy", { locale: es });
}

/** "18:00" */
export function formatTime(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "HH:mm", { locale: es });
}

/** "martes 14 de octubre, 18:00" */
export function formatDateTime(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "EEEE d 'de' MMMM, HH:mm", { locale: es });
}

/** "mar 14 oct" */
export function formatCompactDate(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "EEE d MMM", { locale: es });
}

/** Fecha ISO (yyyy-MM-dd) en la zona horaria dada. */
export function toDateKey(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "yyyy-MM-dd");
}

/** Convierte una fecha local (yyyy-MM-dd) + hora (HH:mm) en la zona dada a un instante UTC. */
export function zonedToUtc(dateKey: string, time: string, tz = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(`${dateKey}T${time}:00`, tz);
}

/**
 * Convierte el valor de un <input type="datetime-local"> ("2026-10-13T18:00") a ISO UTC
 * interpretándolo en la zona operativa (no en la del navegador, que puede ser otra).
 */
export function localInputToUtcIso(value: string, tz = DEFAULT_TIMEZONE): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  return zonedToUtc(match[1]!, match[2]!, tz).toISOString();
}

/** Devuelve el "ahora" expresado como fecha de pared en la zona dada. */
export function nowInZone(tz = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), tz);
}

/** Día de la semana (0 = domingo) de un instante, calculado en la zona dada. */
export function weekdayInZone(value: DateInput, tz = DEFAULT_TIMEZONE): number {
  return Number(formatInTimeZone(toDate(value), tz, "i")) % 7;
}

/** Capitaliza la primera letra (los nombres de días/meses en español van en minúscula). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Hoy", "Mañana" o la fecha larga. */
export function humanDay(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  const target = toDateKey(value, tz);
  const today = toDateKey(new Date(), tz);
  const tomorrow = toDateKey(addDays(new Date(), 1), tz);
  if (target === today) return "Hoy";
  if (target === tomorrow) return "Mañana";
  return capitalize(formatLongDate(value, tz));
}

/** Instante actual en milisegundos (helper para no invocar Date.now() dentro del render). */
export function nowMs(): number {
  return Date.now();
}

/** Fecha N días atrás respecto de ahora. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Formatea minutos como "1 h 30 min" / "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export function formatRelative(value: DateInput, tz = DEFAULT_TIMEZONE): string {
  const date = toDate(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return formatInTimeZone(date, tz, "d MMM", { locale: es });
}
