"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTime, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, MODALITY_LABEL, type AppointmentStatus, type AppointmentWithPatient } from "@/types/domain";

export type CalendarView = "dia" | "semana" | "mes";

type Props = {
  view: CalendarView;
  /** Día de referencia en formato yyyy-MM-dd (zona operativa). */
  dateKey: string;
  appointments: AppointmentWithPatient[];
  blocked: { id: string; start_time: string; end_time: string; reason: string | null; type: string }[];
  timezone: string;
  onSelect: (appointment: AppointmentWithPatient) => void;
  dayStartHour?: number;
  dayEndHour?: number;
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  requested: "border-warning/60 bg-warning-soft text-[#7a5614]",
  pending: "border-info/50 bg-info-soft text-[#2b5f80]",
  confirmed: "border-mint-500/60 bg-mint-100 text-mint-700",
  rescheduled: "border-warning/60 bg-warning-soft text-[#7a5614]",
  cancelled: "border-border bg-surface-muted text-muted-foreground line-through",
  completed: "border-border bg-card text-muted-foreground",
  no_show: "border-destructive/40 bg-destructive/10 text-destructive",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDaysKey(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return keyOf(d);
}
function startOfWeekKey(key: string): string {
  const d = parseKey(key);
  const diff = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diff);
  return keyOf(d);
}

export function patientName(a: AppointmentWithPatient): string {
  return a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Paciente";
}

export function CalendarToolbar({ view, dateKey, todayKey }: { view: CalendarView; dateKey: string; todayKey: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const go = (next: Partial<{ vista: CalendarView; fecha: string }>) => {
    const sp = new URLSearchParams(params.toString());
    if (next.vista) sp.set("vista", next.vista);
    if (next.fecha) sp.set("fecha", next.fecha);
    router.push(`/admin/agenda?${sp.toString()}`);
  };
  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const shift = (dir: -1 | 1) => {
    if (view === "mes") {
      const d = parseKey(dateKey);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      go({ fecha: keyOf(d) });
    } else go({ fecha: addDaysKey(dateKey, step * dir) });
  };
  const d = parseKey(dateKey);
  const title =
    view === "mes"
      ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      : view === "semana"
        ? `Semana del ${parseKey(startOfWeekKey(dateKey)).getDate()} de ${MONTHS[parseKey(startOfWeekKey(dateKey)).getMonth()]}`
        : `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Anterior">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Siguiente">
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => go({ fecha: todayKey })}>
          Hoy
        </Button>
        <h2 className="ml-2 font-display text-xl font-medium first-letter:uppercase">{title}</h2>
      </div>
      <Tabs value={view} onValueChange={(v) => go({ vista: v as CalendarView })}>
        <TabsList>
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function Chip({
  a,
  onSelect,
  timezone,
  compact,
  hideNameOnMobile,
}: {
  a: AppointmentWithPatient;
  onSelect: (a: AppointmentWithPatient) => void;
  timezone: string;
  compact?: boolean;
  /** Solo en la vista mensual: en celdas de ~50 px entra la hora, no el nombre. */
  hideNameOnMobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(a)}
      className={cn(
        "block w-full overflow-hidden rounded-lg border text-left transition-colors hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
        hideNameOnMobile ? "px-0.5 py-0.5 text-center text-[10px] sm:px-2 sm:py-1.5 sm:text-left sm:text-xs" : "px-2 py-1.5 text-xs",
        STATUS_CLASS[a.status],
      )}
      title={`${formatTime(a.start_time, timezone)} · ${patientName(a)} · ${MODALITY_LABEL[a.modality]} · ${APPOINTMENT_STATUS_LABEL[a.status]}`}
      aria-label={`${formatTime(a.start_time, timezone)}, ${patientName(a)}, ${MODALITY_LABEL[a.modality]}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
    >
      <span className="block truncate">
        <span className="font-semibold">{formatTime(a.start_time, timezone)}</span>{" "}
        <span className={hideNameOnMobile ? "hidden sm:inline" : undefined}>{patientName(a)}</span>
      </span>
      {!compact ? <span className="block truncate opacity-80">{MODALITY_LABEL[a.modality]} · {APPOINTMENT_STATUS_LABEL[a.status]}</span> : null}
    </button>
  );
}

export function CalendarGrid({ view, dateKey, appointments, blocked, timezone, onSelect, dayStartHour = 8, dayEndHour = 21 }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentWithPatient[]>();
    for (const a of appointments) {
      const k = toDateKey(a.start_time, timezone);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [appointments, timezone]);
  const blockedByDay = useMemo(() => {
    const map = new Map<string, typeof blocked>();
    for (const b of blocked) {
      let k = toDateKey(b.start_time, timezone);
      const endKey = toDateKey(new Date(new Date(b.end_time).getTime() - 1), timezone);
      while (k <= endKey) {
        map.set(k, [...(map.get(k) ?? []), b]);
        k = addDaysKey(k, 1);
      }
    }
    return map;
  }, [blocked, timezone]);

  if (view === "mes") {
    const first = parseKey(dateKey);
    first.setDate(1);
    const gridStart = startOfWeekKey(keyOf(first));
    const cells = Array.from({ length: 42 }, (_, i) => addDaysKey(gridStart, i));
    const month = first.getMonth();
    return (
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="grid grid-cols-7 border-b border-border/70 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((k) => {
            const d = parseKey(k);
            const items = byDay.get(k) ?? [];
            const blocks = blockedByDay.get(k) ?? [];
            const inMonth = d.getMonth() === month;
            return (
              <div key={k} className={cn("min-h-24 border-r border-b border-border/50 p-1 last:border-r-0 sm:p-1.5", !inMonth && "bg-surface-muted/40")}>
                <Link href={`/admin/agenda?vista=dia&fecha=${k}`} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-surface-muted", !inMonth && "text-subtle-foreground")}>
                  {d.getDate()}
                </Link>
                {blocks.length > 0 ? <div className="mb-1 rounded bg-sand-200 px-1 text-[10px] text-muted-foreground">Bloqueado</div> : null}
                <div className="space-y-1">
                  {items.slice(0, 3).map((a) => (
                    <Chip key={a.id} a={a} onSelect={onSelect} timezone={timezone} compact hideNameOnMobile />
                  ))}
                  {items.length > 3 ? <Link href={`/admin/agenda?vista=dia&fecha=${k}`} className="block text-[11px] text-primary">+{items.length - 3} más</Link> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDaysKey(startOfWeekKey(dateKey), i)) : [dateKey];
  // Un turno cargado manualmente fuera del horario habitual también tiene que verse:
  // el rango de horas se amplía para incluir el primero y el último turno visibles.
  const visibleHours = days.flatMap((k) => (byDay.get(k) ?? []).map((a) => Number(formatTime(a.start_time, timezone).slice(0, 2))));
  const firstHour = Math.min(dayStartHour, ...visibleHours);
  const lastHour = Math.max(dayEndHour, ...visibleHours.map((h) => h + 1));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
      <div className="min-w-[640px]" style={{ display: "grid", gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-border/70" />
        {days.map((k) => {
          const d = parseKey(k);
          const blocks = blockedByDay.get(k) ?? [];
          return (
            <div key={k} className="border-b border-l border-border/70 px-2 py-2 text-center">
              <p className="text-xs text-muted-foreground">{WEEKDAYS[(d.getDay() + 6) % 7]}</p>
              <p className="font-display text-lg font-medium">{d.getDate()}</p>
              {blocks.length > 0 ? <p className="truncate text-[10px] text-muted-foreground">{blocks.map((b) => (b.reason?.startsWith("google:") ? "Calendario externo" : b.reason || "Bloqueado")).join(", ")}</p> : null}
            </div>
          );
        })}
        {hours.map((h) => (
          <div key={h} className="contents">
            <div className="border-b border-border/40 px-2 py-1 text-right text-[11px] text-subtle-foreground">{String(h).padStart(2, "0")}:00</div>
            {days.map((k) => {
              const items = (byDay.get(k) ?? []).filter((a) => Number(formatTime(a.start_time, timezone).slice(0, 2)) === h);
              return (
                <div key={`${k}-${h}`} className="min-h-14 space-y-1 border-b border-l border-border/40 p-1">
                  {items.map((a) => (
                    <Chip key={a.id} a={a} onSelect={onSelect} timezone={timezone} compact={view === "semana"} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
