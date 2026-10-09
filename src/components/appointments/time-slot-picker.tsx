"use client";

import { formatLongDate, capitalize } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SerializedAvailabilityDay } from "@/server/actions/appointments";

type Props = {
  days: SerializedAvailabilityDay[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  selectedSlot: string | null;
  onSelectSlot: (start: string, end: string) => void;
  timezone?: string;
};

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function TimeSlotPicker({ days, selectedDate, onSelectDate, selectedSlot, onSelectSlot, timezone }: Props) {
  const day = days.find((d) => d.dateKey === selectedDate) ?? null;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Elegí un día</p>
        <div role="listbox" aria-label="Días disponibles" className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {days.map((d) => {
            const date = new Date(`${d.dateKey}T12:00:00`);
            const selected = d.dateKey === selectedDate;
            return (
              <button
                key={d.dateKey}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelectDate(d.dateKey)}
                className={cn(
                  "flex min-w-18 shrink-0 flex-col items-center rounded-2xl border px-3 py-3 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
                )}
              >
                <span className="text-xs uppercase">{WEEKDAY_SHORT[date.getDay()]}</span>
                <span className="font-display text-2xl font-medium leading-tight">{date.getDate()}</span>
                <span className={cn("text-[11px]", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{d.slots.length} libres</span>
              </button>
            );
          })}
        </div>
      </div>
      {day ? (
        <div>
          <p className="mb-2 text-sm font-medium">{capitalize(formatLongDate(`${day.dateKey}T12:00:00`, timezone))}</p>
          <div role="listbox" aria-label="Horarios disponibles" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((slot) => {
              const selected = slot.start === selectedSlot;
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelectSlot(slot.start, slot.end)}
                  className={cn(
                    "h-12 rounded-xl border text-base font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
