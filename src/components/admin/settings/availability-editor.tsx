"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, capitalize } from "@/lib/dates";
import { deleteAvailabilityRuleAction, deleteBlockedSlotAction, saveAvailabilityRuleAction } from "@/server/actions/admin-schedule";
import type { AvailabilityRule, BlockedSlot } from "@/types/domain";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const selectClass = "h-10 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

type Draft = {
  id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  modality: "presencial" | "virtual" | "mixta";
  is_active: boolean;
};

function toDraft(r: AvailabilityRule): Draft {
  return { id: r.id, weekday: r.weekday, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5), slot_duration_minutes: r.slot_duration_minutes, buffer_minutes: r.buffer_minutes, modality: r.modality, is_active: r.is_active };
}

export function AvailabilityEditor({ rules, defaultDuration }: { rules: AvailabilityRule[]; defaultDuration: number }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(rules.map(toDraft));
  const [pending, startTransition] = useTransition();

  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setDrafts((d) => [...d, { weekday: 1, start_time: "14:00", end_time: "20:00", slot_duration_minutes: defaultDuration, buffer_minutes: 0, modality: "mixta", is_active: true }]);

  const saveRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      const res = await saveAvailabilityRuleAction({ ...row, valid_from: null, valid_until: null });
      if (!res.ok) return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] ?? res.error : res.error);
      toast.success("Horario guardado.");
      router.refresh();
    });

  const removeRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      if (row.id) {
        const res = await deleteAvailabilityRuleAction(row.id);
        if (!res.ok) return void toast.error(res.error);
      }
      setDrafts((d) => d.filter((_, idx) => idx !== i));
      toast.success("Horario eliminado.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Día</th>
              <th className="px-3 py-2.5">Desde</th>
              <th className="px-3 py-2.5">Hasta</th>
              <th className="px-3 py-2.5">Duración</th>
              <th className="px-3 py-2.5">Intervalo</th>
              <th className="px-3 py-2.5">Modalidad</th>
              <th className="px-3 py-2.5">Activo</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {drafts.map((r, i) => (
              <tr key={r.id ?? `new-${i}`}>
                <td className="px-3 py-2">
                  <select value={r.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })} className={selectClass} aria-label="Día">
                    {WEEKDAYS.map((w, idx) => (
                      <option key={w} value={idx}>{w}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2"><Input type="time" value={r.start_time} onChange={(e) => update(i, { start_time: e.target.value })} className="h-10 w-28" aria-label="Desde" /></td>
                <td className="px-3 py-2"><Input type="time" value={r.end_time} onChange={(e) => update(i, { end_time: e.target.value })} className="h-10 w-28" aria-label="Hasta" /></td>
                <td className="px-3 py-2"><Input type="number" min={15} max={240} step={5} value={r.slot_duration_minutes} onChange={(e) => update(i, { slot_duration_minutes: Number(e.target.value) })} className="h-10 w-20" aria-label="Duración en minutos" /></td>
                <td className="px-3 py-2"><Input type="number" min={0} max={120} step={5} value={r.buffer_minutes} onChange={(e) => update(i, { buffer_minutes: Number(e.target.value) })} className="h-10 w-20" aria-label="Intervalo en minutos" /></td>
                <td className="px-3 py-2">
                  <select value={r.modality} onChange={(e) => update(i, { modality: e.target.value as Draft["modality"] })} className={selectClass} aria-label="Modalidad">
                    <option value="mixta">Ambas</option>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </td>
                <td className="px-3 py-2"><Switch checked={r.is_active} onCheckedChange={(v) => update(i, { is_active: v })} aria-label="Activo" /></td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => saveRow(i)} disabled={pending}>Guardar</Button>
                    <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} disabled={pending} aria-label="Eliminar"><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" onClick={add} disabled={pending}><Plus aria-hidden /> Agregar franja</Button>
    </div>
  );
}

export function BlockedSlotsList({ blocked, timezone }: { blocked: BlockedSlot[]; timezone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const TYPE: Record<string, string> = { block: "Bloqueo", vacation: "Vacaciones", holiday: "Feriado", exception: "Excepción" };
  if (blocked.length === 0) return <p className="text-sm text-muted-foreground">No hay bloqueos futuros. Podés crearlos desde la Agenda.</p>;
  return (
    <ul className="divide-y divide-divider overflow-hidden rounded-2xl border border-border/70 bg-card text-sm">
      {blocked.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-medium">
              {TYPE[b.type] ?? b.type}
              {b.reason ? ` · ${b.reason.startsWith("google:") ? "Evento del calendario externo" : b.reason}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {capitalize(formatDateTime(b.start_time, timezone))} → {capitalize(formatDateTime(b.end_time, timezone))}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Eliminar bloqueo"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteBlockedSlotAction(b.id);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Bloqueo eliminado.");
                router.refresh();
              })
            }
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
