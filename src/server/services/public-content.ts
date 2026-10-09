import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";
import { createAnonClient } from "@/server/services/public-settings";
import type { AvailabilityRule, EmergencyResource, Faq, TherapyPlan } from "@/types/domain";

const log = createLogger("public-content");

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch (error) {
    log.warn(`No se pudo leer ${label}`, errorMeta(error));
    return fallback;
  }
}

/** Planes activos ordenados (lectura anónima, apta para ISR). */
export const getActivePlans = cache(async (): Promise<TherapyPlan[]> =>
  safe(
    "planes",
    async () => {
      const { data, error } = await createAnonClient()
        .from("therapy_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    [],
  ),
);

export const getPublishedFaqs = cache(async (): Promise<Faq[]> =>
  safe(
    "faqs",
    async () => {
      const { data, error } = await createAnonClient().from("faqs").select("*").eq("is_published", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    [],
  ),
);

export const getActiveEmergencyResources = cache(async (): Promise<EmergencyResource[]> =>
  safe(
    "recursos de emergencia",
    async () => {
      const { data, error } = await createAnonClient().from("emergency_resources").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    [],
  ),
);

export const getPublicAvailability = cache(async (): Promise<AvailabilityRule[]> =>
  safe(
    "horarios",
    async () => {
      const { data, error } = await createAnonClient().from("availability_rules").select("*").eq("is_active", true).order("weekday").order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    [],
  ),
);
