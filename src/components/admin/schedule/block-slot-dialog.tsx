"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zonedToUtc } from "@/lib/dates";
import { createBlockedSlotAction } from "@/server/actions/admin-schedule";

type BlockType = "block" | "vacation" | "holiday" | "exception";

export function BlockSlotDialog({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BlockType>("block");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!startDate) return void toast.error("Indicá la fecha de inicio.");
      const endD = endDate || startDate;
      const start = zonedToUtc(startDate, allDay ? "00:00" : startTime, timezone);
      const end = allDay ? new Date(zonedToUtc(endD, "00:00", timezone).getTime() + 24 * 3600_000) : zonedToUtc(endD, endTime, timezone);
      const res = await createBlockedSlotAction({ start: start.toISOString(), end: end.toISOString(), type, reason: reason || null });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Bloqueo creado.");
      setOpen(false);
      setReason("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ban aria-hidden /> Bloquear horario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>Los horarios bloqueados no se ofrecen a los pacientes (vacaciones, feriados, excepciones).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="bl-type" label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as BlockType)}>
              <SelectTrigger id="bl-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Bloqueo puntual</SelectItem>
                <SelectItem value="vacation">Vacaciones</SelectItem>
                <SelectItem value="holiday">Feriado</SelectItem>
                <SelectItem value="exception">Excepción</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 rounded border-input accent-[var(--primary)]" />
            Día(s) completo(s)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="bl-start-date" label="Desde">
              <Input id="bl-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            {!allDay ? (
              <FormField id="bl-start-time" label="Hora">
                <Input id="bl-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </FormField>
            ) : null}
            <FormField id="bl-end-date" label="Hasta" hint={allDay ? "Inclusive" : undefined}>
              <Input id="bl-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            {!allDay ? (
              <FormField id="bl-end-time" label="Hora">
                <Input id="bl-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </FormField>
            ) : null}
          </div>
          <FormField id="bl-reason" label="Motivo" optional hint="Solo visible para vos.">
            <Input id="bl-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} loading={pending}>Bloquear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
