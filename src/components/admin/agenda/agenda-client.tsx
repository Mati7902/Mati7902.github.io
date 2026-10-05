"use client";

import { useState } from "react";

import { AppointmentSheet } from "@/components/admin/agenda/appointment-sheet";
import { CalendarGrid, CalendarToolbar, type CalendarView } from "@/components/admin/agenda/calendar-views";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, MODALITY_LABEL, type AppointmentWithPatient } from "@/types/domain";

type Prep = { appointment_id: string; week_rating: number | null; hardest: string | null; better: string | null; topics: string | null; practiced: string | null; important: string | null; submitted_at: string | null };

type Props = {
  view: CalendarView;
  dateKey: string;
  todayKey: string;
  appointments: AppointmentWithPatient[];
  blocked: { id: string; start_time: string; end_time: string; reason: string | null; type: string }[];
  preps: Prep[];
  timezone: string;
  defaultDuration: number;
  dayStartHour: number;
  dayEndHour: number;
};

export function AgendaClient({ view, dateKey, todayKey, appointments, blocked, preps, timezone, defaultDuration, dayStartHour, dayEndHour }: Props) {
  const [selected, setSelected] = useState<AppointmentWithPatient | null>(null);
  const prep = selected ? (preps.find((p) => p.appointment_id === selected.id) ?? null) : null;
  return (
    <div className="space-y-4">
      <CalendarToolbar view={view} dateKey={dateKey} todayKey={todayKey} />
      <CalendarGrid view={view} dateKey={dateKey} appointments={appointments} blocked={blocked} timezone={timezone} onSelect={setSelected} dayStartHour={dayStartHour} dayEndHour={dayEndHour} />
      <AppointmentSheet appointment={selected} onClose={() => setSelected(null)} timezone={timezone} defaultDuration={defaultDuration} prep={prep} />
    </div>
  );
}

/** Lista compacta (dashboard "Hoy") que reutiliza el panel de detalle. */
export function AppointmentListClient({ appointments, preps, timezone, defaultDuration, emptyText }: { appointments: AppointmentWithPatient[]; preps: Prep[]; timezone: string; defaultDuration: number; emptyText: string }) {
  const [selected, setSelected] = useState<AppointmentWithPatient | null>(null);
  const prep = selected ? (preps.find((p) => p.appointment_id === selected.id) ?? null) : null;
  if (appointments.length === 0) return <p className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <>
      <ul className="divide-y divide-divider overflow-hidden rounded-2xl border border-border/70 bg-card">
        {appointments.map((a) => (
          <li key={a.id}>
            <AppointmentRow appointment={a} timezone={timezone} onSelect={() => setSelected(a)} hasPrep={preps.some((p) => p.appointment_id === a.id && p.submitted_at)} />
          </li>
        ))}
      </ul>
      <AppointmentSheet appointment={selected} onClose={() => setSelected(null)} timezone={timezone} defaultDuration={defaultDuration} prep={prep} />
    </>
  );
}

function AppointmentRow({ appointment: a, timezone, onSelect, hasPrep }: { appointment: AppointmentWithPatient; timezone: string; onSelect: () => void; hasPrep: boolean }) {
  const name = a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Paciente";
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted outline-none">
      <span className="w-14 shrink-0 font-display text-lg font-medium">{formatTime(a.start_time, timezone)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">{MODALITY_LABEL[a.modality]}{hasPrep ? " · Preparación enviada" : ""}</span>
      </span>
      <Badge variant={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
    </button>
  );
}
