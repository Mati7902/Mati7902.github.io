import "server-only";

import { cache } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import { siteDefaults } from "@/lib/config/site";

/* ------------------------------------------------------------------------ */
/* Schemas de cada clave de configuración (fuente de verdad para la UI)       */
/* ------------------------------------------------------------------------ */
export const siteIdentitySchema = z.object({
  platform_name: z.string().min(2).default(siteDefaults.platformName),
  professional_name: z.string().min(2).default(siteDefaults.professionalName),
  professional_title: z.string().default(siteDefaults.professionalTitle),
  license: z.string().default(siteDefaults.license),
  country: z.string().default(siteDefaults.country),
  tagline: z.string().default(siteDefaults.tagline),
  bio: z.string().default(""),
  photo_url: z.string().url().nullable().default(null),
  logo_url: z.string().url().nullable().default(null),
  /** Línea bajo el nombre en el logo (p. ej. "Psicología · Neurociencia aplicada"). */
  brand_subtitle: z.string().default(siteDefaults.brandSubtitle),
  email: z.string().email().nullable().default(null),
  phone: z.string().nullable().default(null),
  whatsapp: z.string().nullable().default(null),
  location_name: z.string().nullable().default(null),
  location_address: z.string().nullable().default(null),
  location_map_url: z.string().url().nullable().default(null),
  links: z
    .object({
      instagram: z.string().url().nullable().default(null),
      linkedin: z.string().url().nullable().default(null),
      website: z.string().url().nullable().default(null),
    })
    .default({ instagram: null, linkedin: null, website: null }),
});

export const schedulingSchema = z.object({
  timezone: z.string().default("America/Asuncion"),
  default_duration_minutes: z.number().int().min(15).max(240).default(60),
  default_buffer_minutes: z.number().int().min(0).max(120).default(0),
  booking_mode: z.enum(["auto", "approval"]).default("approval"),
  min_hours_before_booking: z.number().min(0).max(168).default(12),
  max_days_in_advance: z.number().int().min(1).max(365).default(45),
  allow_patient_reschedule: z.boolean().default(true),
  allow_patient_cancel: z.boolean().default(true),
  reschedule_min_hours: z.number().min(0).max(168).default(12),
  cancel_min_hours: z.number().min(0).max(168).default(12),
  session_prep_enabled: z.boolean().default(true),
  session_prep_hours_before: z.number().min(1).max(168).default(24),
  default_location: z.string().nullable().default(null),
  default_video_provider: z.enum(["google_meet", "zoom", "other"]).default("google_meet"),
  modalities_enabled: z.array(z.enum(["presencial", "virtual"])).default(["presencial", "virtual"]),
});

export const remindersSchema = z.object({
  enabled: z.boolean().default(true),
  reminder_24h_enabled: z.boolean().default(true),
  reminder_24h_hours_before: z.number().min(1).max(72).default(24),
  additional_reminder_enabled: z.boolean().default(false),
  additional_reminder_hours_before: z.number().min(0.5).max(24).default(2),
  send_window_minutes: z.number().int().min(15).max(240).default(90),
  channels: z.array(z.enum(["whatsapp", "in_app"])).default(["whatsapp", "in_app"]),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
});

export const whatsappSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  assistant_name: z.string().default("Asistente virtual"),
  greeting: z.string().default(""),
  handoff_message: z.string().default(""),
  out_of_scope_message: z.string().default(""),
  ai_enabled: z.boolean().default(true),
  ai_confidence_threshold: z.number().min(0).max(1).default(0.6),
  max_slots_to_offer: z.number().int().min(1).max(10).default(6),
});

export const emergencySettingsSchema = z.object({
  message: z.string().default(""),
  contact_note: z.string().default(""),
  show_contact_professional: z.boolean().default(true),
});

export const gamificationSchema = z.object({
  enabled: z.boolean().default(true),
  weekly_summary: z.boolean().default(true),
});

export const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2f6468"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#27b088"),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fbfdfc"),
});

export const legalSchema = z.object({
  privacy_version: z.string().default("draft"),
  terms_version: z.string().default("draft"),
  consent_version: z.string().default("draft"),
  reviewed_by_professional: z.boolean().default(false),
});

const specialtySchema = z.object({ title: z.string(), text: z.string() });

export const landingSchema = z.object({
  /** Las palabras entre asteriscos se muestran en cursiva y en el color de acento: "Terapia desde *donde estés*". */
  hero_title: z.string().default(siteDefaults.heroTitle),
  hero_subtitle: z.string().default(siteDefaults.heroSubtitle),
  how_it_works: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
  specialties_title: z.string().default(siteDefaults.specialtiesTitle),
  specialties: z.array(specialtySchema).default([...siteDefaults.specialties]),
  approach_label: z.string().default("Enfoque diferencial"),
  approach_text: z.string().default(siteDefaults.approachText),
});

export const settingsSchemas = {
  "site.identity": siteIdentitySchema,
  scheduling: schedulingSchema,
  reminders: remindersSchema,
  whatsapp: whatsappSettingsSchema,
  emergency: emergencySettingsSchema,
  gamification: gamificationSchema,
  theme: themeSchema,
  legal: legalSchema,
  landing: landingSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;
export type SiteIdentity = SettingsValue<"site.identity">;
export type SchedulingSettings = SettingsValue<"scheduling">;
export type RemindersSettings = SettingsValue<"reminders">;
export type WhatsAppSettings = SettingsValue<"whatsapp">;
export type EmergencySettings = SettingsValue<"emergency">;

type AnyClient = ServerSupabaseClient | AdminSupabaseClient;

function parseSetting<K extends SettingsKey>(key: K, raw: unknown): SettingsValue<K> {
  const schema = settingsSchemas[key];
  const result = schema.safeParse(raw ?? {});
  if (result.success) return result.data as SettingsValue<K>;
  // Si hay datos corruptos, degradamos a defaults sin romper la app.
  return schema.parse({}) as SettingsValue<K>;
}

/** Lee una clave de configuración con el cliente indicado (respeta RLS: públicas vs. privadas). */
export async function getSetting<K extends SettingsKey>(client: AnyClient, key: K): Promise<SettingsValue<K>> {
  const { data } = await client.from("settings").select("value").eq("key", key).maybeSingle();
  return parseSetting(key, data?.value);
}

/** Lee varias claves de una vez. */
export async function getSettings<K extends SettingsKey>(client: AnyClient, keys: readonly K[]): Promise<{ [P in K]: SettingsValue<P> }> {
  const { data } = await client.from("settings").select("key, value").in("key", [...keys] as string[]);
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  const out = {} as { [P in K]: SettingsValue<P> };
  for (const key of keys) {
    out[key] = parseSetting(key, map.get(key));
  }
  return out;
}

/** Configuración pública (landing, metadata) memoizada por request, usando el cliente del usuario/anónimo. */
export const getPublicSettings = cache(async () => {
  const supabase = await createClient();
  return getSettings(supabase, ["site.identity", "scheduling", "emergency", "theme", "legal", "landing"] as const);
});

export async function saveSetting<K extends SettingsKey>(client: AnyClient, key: K, value: SettingsValue<K>, updatedBy?: string) {
  const parsed = settingsSchemas[key].parse(value);
  const { error } = await client
    .from("settings")
    .update({ value: parsed as never, updated_by: updatedBy ?? null })
    .eq("key", key);
  if (error) throw error;
  return parsed as SettingsValue<K>;
}
