import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarX, Users } from "lucide-react";

import { AppointmentListClient } from "@/components/admin/agenda/agenda-client";
import { NewAppointmentDialog } from "@/components/admin/agenda/new-appointment-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireAdmin } from "@/lib/auth/session";
import { toDateKey, zonedToUtc, addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listAppointmentsBetween } from "@/server/services/appointments";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Hoy" };

export default async function AdminTodayPage() {
  await requireAdmin();
  const supabase = await createClient();
  const scheduling = await getSetting(supabase, "scheduling");
  const tz = scheduling.timezone;
  const todayKey = toDateKey(new Date(), tz);
  const dayStart = zonedToUtc(todayKey, "00:00", tz);
  const dayEnd = addDays(dayStart, 1);
  const weekEnd = addDays(dayStart, 8);

  const [today, upcoming, requests, { data: patients }, { count: cancelledToday }] = await Promise.all([
    listAppointmentsBetween(supabase, dayStart, dayEnd),
    listAppointmentsBetween(supabase, dayEnd, weekEnd, ["pending", "confirmed", "rescheduled", "requested"]),
    supabase
      .from("appointments")
      .select("*, patients(id, first_name, last_name, phone, whatsapp_phone, email, profile_id)")
      .eq("status", "requested")
      .gte("start_time", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("patients").select("id, first_name, last_name, phone, modality").eq("status", "active").order("last_name"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("cancelled_at", dayStart.toISOString()).lt("cancelled_at", dayEnd.toISOString()),
  ]);

  const active = today.filter((a) => a.status !== "cancelled");
  const confirmed = active.filter((a) => a.status === "confirmed").length;
  const pendingToday = active.filter((a) => ["pending", "rescheduled", "requested"].includes(a.status)).length;
  const appointmentIds = [...active, ...upcoming].map((a) => a.id);
  const { data: preps } = appointmentIds.length
    ? await supabase.from("session_preparations").select("appointment_id, week_rating, hardest, better, topics, practiced, important, submitted_at").in("appointment_id", appointmentIds)
    : { data: [] };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel profesional"
        title="Hoy"
        description={new Intl.DateTimeFormat("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date())}
        actions={<NewAppointmentDialog patients={patients ?? []} timezone={tz} defaultDuration={scheduling.default_duration_minutes} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pacientes del día" value={active.length} icon={Users} />
        <StatCard label="Confirmados" value={confirmed} icon={CalendarCheck} tone="success" />
        <StatCard label="Pendientes" value={pendingToday} icon={CalendarClock} tone="warning" />
        <StatCard label="Cancelaciones hoy" value={cancelledToday ?? 0} icon={CalendarX} tone="destructive" hint="Canceladas durante el día" />
      </div>

      {(requests.data ?? []).length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium">Solicitudes por aprobar</h2>
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-[#8a6418]">{requests.data?.length}</span>
          </div>
          <AppointmentListClient appointments={requests.data ?? []} preps={preps ?? []} timezone={tz} defaultDuration={scheduling.default_duration_minutes} emptyText="" />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Agenda de hoy</h2>
        <AppointmentListClient appointments={active} preps={preps ?? []} timezone={tz} defaultDuration={scheduling.default_duration_minutes} emptyText="No hay sesiones programadas para hoy." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Próximos 7 días</h2>
          <Button asChild variant="link" className="px-0">
            <Link href="/admin/agenda?vista=semana">Ver agenda completa</Link>
          </Button>
        </div>
        <AppointmentListClient appointments={upcoming.slice(0, 12)} preps={preps ?? []} timezone={tz} defaultDuration={scheduling.default_duration_minutes} emptyText="No hay turnos en los próximos días." />
      </section>
    </div>
  );
}
