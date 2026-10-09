import type { Metadata } from "next";
import { Suspense } from "react";

import { AgendaClient } from "@/components/admin/agenda/agenda-client";
import { NewAppointmentDialog } from "@/components/admin/agenda/new-appointment-dialog";
import { BlockSlotDialog } from "@/components/admin/schedule/block-slot-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { requireAdmin } from "@/lib/auth/session";
import { addDays, toDateKey, zonedToUtc } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listAvailabilityRules, listBlockedSlots } from "@/server/services/admin-schedule";
import { listAppointmentsBetween } from "@/server/services/appointments";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";

function rangeFor(view: View, dateKey: string, tz: string): { from: Date; to: Date } {
  const base = zonedToUtc(dateKey, "00:00", tz);
  if (view === "dia") return { from: base, to: addDays(base, 1) };
  if (view === "semana") {
    const d = new Date(`${dateKey}T12:00:00`);
    const diff = (d.getDay() + 6) % 7;
    const monday = addDays(base, -diff);
    return { from: addDays(monday, -1), to: addDays(monday, 8) };
  }
  const [y, m] = dateKey.split("-").map(Number);
  const first = zonedToUtc(`${y}-${String(m).padStart(2, "0")}-01`, "00:00", tz);
  return { from: addDays(first, -7), to: addDays(first, 45) };
}

export default async function AdminAgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string }> }) {
  await requireAdmin();
  const { vista, fecha } = await searchParams;
  const supabase = await createClient();
  const scheduling = await getSetting(supabase, "scheduling");
  const tz = scheduling.timezone;
  const todayKey = toDateKey(new Date(), tz);
  const view: View = vista === "dia" || vista === "mes" ? vista : "semana";
  const dateKey = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayKey;
  const { from, to } = rangeFor(view, dateKey, tz);

  const [appointments, blocked, rules, { data: patients }] = await Promise.all([
    listAppointmentsBetween(supabase, from, to),
    listBlockedSlots(supabase, from),
    listAvailabilityRules(supabase),
    supabase.from("patients").select("id, first_name, last_name, phone, modality").eq("status", "active").order("last_name"),
  ]);
  const ids = appointments.map((a) => a.id);
  const { data: preps } = ids.length
    ? await supabase.from("session_preparations").select("appointment_id, week_rating, hardest, better, topics, practiced, important, submitted_at").in("appointment_id", ids)
    : { data: [] };

  const activeRules = rules.filter((r) => r.is_active);
  const dayStartHour = activeRules.length ? Math.max(0, Math.min(...activeRules.map((r) => Number(r.start_time.slice(0, 2)))) - 1) : 8;
  const dayEndHour = activeRules.length ? Math.min(24, Math.max(...activeRules.map((r) => Number(r.end_time.slice(0, 2)) + (Number(r.end_time.slice(3, 5)) > 0 ? 1 : 0))) + 1) : 21;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agenda"
        title="Turnos"
        description="Hora, paciente, modalidad y estado. Tocá un turno para gestionarlo."
        actions={
          <>
            <BlockSlotDialog timezone={tz} />
            <NewAppointmentDialog patients={patients ?? []} timezone={tz} defaultDuration={scheduling.default_duration_minutes} />
          </>
        }
      />
      <Suspense fallback={<PageLoader />}>
        <AgendaClient
          view={view}
          dateKey={dateKey}
          todayKey={todayKey}
          appointments={appointments}
          blocked={blocked.filter((b) => new Date(b.start_time) < to)}
          preps={preps ?? []}
          timezone={tz}
          defaultDuration={scheduling.default_duration_minutes}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
        />
      </Suspense>
    </div>
  );
}
