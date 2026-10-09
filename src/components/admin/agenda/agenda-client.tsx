"use client";

import { useState } from "react";

import { AppointmentSheet } from "@/components/admin/agenda/appointment-sheet";
import { CalendarGrid, CalendarToolbar, type CalendarView } from "@/components/admin/agenda/calendar-views";
import { Badge } from "@/components/ui/badge";
import { capitalize, formatCompactDate, formatTime } from "@/lib/dates";
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
export function AppointmentListClient({
  appointments,
  preps,
  timezone,
  defaultDuration,
  emptyText,
  showDate = false,
  showPatient = true,
}: {
  appointments: AppointmentWithPatient[];
  preps: Prep[];
  timezone: string;
  defaultDuration: number;
  emptyText: string;
  /** Muestra el día además de la hora (listas que abarcan varios días). */
  showDate?: boolean;
  /** En la ficha de un paciente el nombre es redundante. */
  showPatient?: boolean;
}) {
  const [selected, setSelected] = useState<AppointmentWithPatient | null>(null);
  const prep = selected ? (preps.find((p) => p.appointment_id === selected.id) ?? null) : null;
  if (appointments.length === 0) return <p className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <>
      <ul className="divide-y divide-divider overflow-hidden rounded-2xl border border-border/70 bg-card">
        {appointments.map((a) => (
          <li key={a.id}>
            <AppointmentRow appointment={a} timezone={timezone} onSelect={() => setSelected(a)} hasPrep={preps.some((p) => p.appointment_id === a.id && p.submitted_at)} showDate={showDate} showPatient={showPatient} />
          </li>
        ))}
      </ul>
      <AppointmentSheet appointment={selected} onClose={() => setSelected(null)} timezone={timezone} defaultDuration={defaultDuration} prep={prep} />
    </>
  );
}

function AppointmentRow({
  appointment: a,
  timezone,
  onSelect,
  hasPrep,
  showDate,
  showPatient,
}: {
  appointment: AppointmentWithPatient;
  timezone: string;
  onSelect: () => void;
  hasPrep: boolean;
  showDate: boolean;
  showPatient: boolean;
}) {
  const name = a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Paciente";
  const details = `${MODALITY_LABEL[a.modality]}${hasPrep ? " · Preparación enviada" : ""}`;
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted outline-none">
      <span className={showDate ? "w-24 shrink-0" : "w-14 shrink-0"}>
        {showDate ? <span className="block text-xs font-medium text-muted-foreground">{capitalize(formatCompactDate(a.start_time, timezone))}</span> : null}
        <span className="block font-display text-lg font-medium">{formatTime(a.start_time, timezone)}</span>
      </span>
      <span className="min-w-0 flex-1">
        {showPatient ? <span className="block truncate font-medium">{name}</span> : null}
        <span className={showPatient ? "block text-xs text-muted-foreground" : "block text-sm"}>{details}</span>
      </span>
      <Badge variant={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
    </button>
  );
}
