import "server-only";

import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type MonthlyStats = {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  requested: number;
  virtual: number;
  presencial: number;
};

/** Estadísticas administrativas (sin contenido clínico). */
export async function getMonthlyStats(client: ServerSupabaseClient, from: Date, to: Date): Promise<MonthlyStats> {
  const { data } = await client.rpc("admin_monthly_stats", { p_from: from.toISOString(), p_to: to.toISOString() });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: Number(row?.total ?? 0),
    confirmed: Number(row?.confirmed ?? 0),
    completed: Number(row?.completed ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    no_show: Number(row?.no_show ?? 0),
    requested: Number(row?.requested ?? 0),
    virtual: Number(row?.virtual ?? 0),
    presencial: Number(row?.presencial ?? 0),
  };
}

export async function getPopularHours(client: ServerSupabaseClient, from: Date, to: Date): Promise<{ hour: string; bookings: number }[]> {
  const { data } = await client.rpc("admin_popular_hours", { p_from: from.toISOString(), p_to: to.toISOString() });
  return (data ?? []).map((r) => ({ hour: r.hour_label, bookings: Number(r.bookings) }));
}

export async function countActivePatients(client: ServerSupabaseClient): Promise<number> {
  const { count } = await client.from("patients").select("id", { count: "exact", head: true }).eq("status", "active");
  return count ?? 0;
}
