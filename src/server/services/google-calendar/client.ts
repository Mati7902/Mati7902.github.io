import "server-only";

import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-calendar");

/**
 * Cliente mínimo de Google Calendar API v3 (REST con fetch, sin SDK pesado).
 * Scopes necesarios (mínimo privilegio):
 *   - https://www.googleapis.com/auth/calendar.events   → crear/actualizar/cancelar eventos propios
 *   - https://www.googleapis.com/auth/calendar.freebusy → consultar ocupación sin leer detalles
 *   - openid email                                      → identificar la cuenta conectada
 * Documentación: https://developers.google.com/calendar/api/v3/reference
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "openid",
  "email",
] as const;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

export function isGoogleConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI && env.APP_ENCRYPTION_KEY);
}

export function buildAuthUrl(state: string): string {
  const env = getServerEnv();
  if (!isGoogleConfigured()) throw new AppError("NOT_CONFIGURED", "Google Calendar no está configurado (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI / APP_ENCRYPTION_KEY).");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string };

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const env = getServerEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: env.GOOGLE_REDIRECT_URI!, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new AppError("EXTERNAL", `Google rechazó el código de autorización (${res.status}).`);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const env = getServerEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new AppError("EXTERNAL", `No se pudo renovar el acceso a Google (${res.status}). Reconectá la cuenta.`);
  return (await res.json()) as TokenResponse;
}

/** Decodifica el email del id_token (sin verificar firma: solo informativo, el token viene del endpoint oficial por TLS). */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1] ?? "";
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!res.ok) {
    log.warn("Google Calendar API error", { status: res.status, path, message: json.error?.message });
    const err = new AppError("EXTERNAL", json.error?.message ?? `Google Calendar respondió ${res.status}`, { status: res.status });
    throw err;
  }
  return json;
}

export type BusyPeriod = { start: string; end: string };

export async function queryFreeBusy(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date, timeZone: string): Promise<BusyPeriod[]> {
  const data = await api<{ calendars?: Record<string, { busy?: BusyPeriod[] }> }>(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), timeZone, items: [{ id: calendarId }] }),
  });
  return data.calendars?.[calendarId]?.busy ?? [];
}

export type GoogleEventInput = {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
  location?: string;
  appointmentId: string;
  status?: "confirmed" | "tentative" | "cancelled";
};

function toEventBody(input: GoogleEventInput) {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
    end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    status: input.status ?? "confirmed",
    reminders: { useDefault: true },
    // Marca de origen: evita bucles al importar eventos (los nuestros se reconocen y se ignoran).
    extendedProperties: { private: { psms_appointment_id: input.appointmentId, psms_origin: "app" } },
  };
}

export async function createEvent(accessToken: string, calendarId: string, input: GoogleEventInput): Promise<{ id: string; hangoutLink?: string }> {
  return api(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(toEventBody(input)) });
}

export async function updateEvent(accessToken: string, calendarId: string, eventId: string, input: GoogleEventInput): Promise<{ id: string }> {
  return api(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(toEventBody(input)) });
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await api<void>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (error) {
    // 404/410: el evento ya no existe en Google; lo consideramos eliminado.
    if (error instanceof AppError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  updated?: string;
};

/** Lista cambios con syncToken (incremental) o ventana temporal (inicial). */
export async function listEvents(accessToken: string, calendarId: string, options: { syncToken?: string | null; timeMin?: Date; timeMax?: Date }): Promise<{ items: GoogleEvent[]; nextSyncToken?: string }> {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "250" });
    if (options.syncToken) params.set("syncToken", options.syncToken);
    else {
      if (options.timeMin) params.set("timeMin", options.timeMin.toISOString());
      if (options.timeMax) params.set("timeMax", options.timeMax.toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);
    const page = await api<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);
  return { items, nextSyncToken };
}
