"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsSave } from "@/hooks/use-settings-save";
import type { RemindersSettings } from "@/server/services/settings";

export function RemindersForm({ initial }: { initial: RemindersSettings }) {
  const [value, setValue] = useState(initial);
  const { save, pending, fieldErrors } = useSettingsSave("reminders");
  const set = <K extends keyof RemindersSettings>(key: K, v: RemindersSettings[K]) => setValue((s) => ({ ...s, [key]: v }));
  const toggleChannel = (c: "whatsapp" | "in_app", on: boolean) => set("channels", on ? Array.from(new Set([...value.channels, c])) : value.channels.filter((x) => x !== c));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <Row id="rem-enabled" label="Recordatorios automáticos" description="Se envían por el cron cada 15 minutos. Nunca se repiten para un mismo turno." checked={value.enabled} onChange={(v) => set("enabled", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Row id="rem-24" label="Recordatorio principal" checked={value.reminder_24h_enabled} onChange={(v) => set("reminder_24h_enabled", v)} />
        <FormField id="rem-24h" label="Horas antes" error={fieldErrors.reminder_24h_hours_before}>
          <Input id="rem-24h" type="number" min={1} max={72} value={value.reminder_24h_hours_before} onChange={(e) => set("reminder_24h_hours_before", Number(e.target.value))} />
        </FormField>
        <Row id="rem-2" label="Recordatorio adicional" checked={value.additional_reminder_enabled} onChange={(v) => set("additional_reminder_enabled", v)} />
        <FormField id="rem-2h" label="Horas antes" error={fieldErrors.additional_reminder_hours_before}>
          <Input id="rem-2h" type="number" min={0.5} max={24} step={0.5} value={value.additional_reminder_hours_before} onChange={(e) => set("additional_reminder_hours_before", Number(e.target.value))} />
        </FormField>
        <FormField id="rem-window" label="Ventana de envío (min)" hint="Tolerancia alrededor del momento exacto, para que ningún turno quede sin aviso.">
          <Input id="rem-window" type="number" min={15} max={240} value={value.send_window_minutes} onChange={(e) => set("send_window_minutes", Number(e.target.value))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="rem-qs" label="Silencio desde">
            <Input id="rem-qs" type="time" value={value.quiet_hours_start} onChange={(e) => set("quiet_hours_start", e.target.value)} />
          </FormField>
          <FormField id="rem-qe" label="hasta">
            <Input id="rem-qe" type="time" value={value.quiet_hours_end} onChange={(e) => set("quiet_hours_end", e.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="flex items-center gap-6 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm">
        <span>Canales</span>
        <label className="flex items-center gap-2"><Checkbox checked={value.channels.includes("whatsapp")} onCheckedChange={(v) => toggleChannel("whatsapp", Boolean(v))} /> WhatsApp</label>
        <label className="flex items-center gap-2"><Checkbox checked={value.channels.includes("in_app")} onCheckedChange={(v) => toggleChannel("in_app", Boolean(v))} /> Notificación en la app</label>
      </div>
      <Button type="submit" loading={pending}>Guardar recordatorios</Button>
    </form>
  );
}

function Row({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
      <div>
        <Label htmlFor={id} className="font-normal">{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
