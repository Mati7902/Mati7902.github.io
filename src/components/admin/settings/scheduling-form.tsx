"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsSave } from "@/hooks/use-settings-save";
import type { SchedulingSettings } from "@/server/services/settings";

const selectClass = "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function SchedulingForm({ initial }: { initial: SchedulingSettings }) {
  const [value, setValue] = useState(initial);
  const { save, pending, fieldErrors } = useSettingsSave("scheduling");
  const set = <K extends keyof SchedulingSettings>(key: K, v: SchedulingSettings[K]) => setValue((s) => ({ ...s, [key]: v }));
  const toggleModality = (m: "presencial" | "virtual", on: boolean) => {
    const next = on ? Array.from(new Set([...value.modalities_enabled, m])) : value.modalities_enabled.filter((x) => x !== m);
    if (next.length === 0) return;
    set("modalities_enabled", next);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="sc-tz" label="Zona horaria" error={fieldErrors.timezone}>
          <Input id="sc-tz" value={value.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </FormField>
        <FormField id="sc-duration" label="Duración estándar (min)" error={fieldErrors.default_duration_minutes}>
          <Input id="sc-duration" type="number" min={15} max={240} step={5} value={value.default_duration_minutes} onChange={(e) => set("default_duration_minutes", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-buffer" label="Intervalo entre pacientes (min)">
          <Input id="sc-buffer" type="number" min={0} max={120} step={5} value={value.default_buffer_minutes} onChange={(e) => set("default_buffer_minutes", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-mode" label="Modo de reserva" hint="Automático: el turno queda confirmado. Aprobación: queda pendiente hasta que lo apruebes.">
          <select id="sc-mode" value={value.booking_mode} onChange={(e) => set("booking_mode", e.target.value as "auto" | "approval")} className={selectClass}>
            <option value="approval">Pendiente de aprobación profesional</option>
            <option value="auto">Confirmación automática</option>
          </select>
        </FormField>
        <FormField id="sc-minh" label="Anticipación mínima (horas)">
          <Input id="sc-minh" type="number" min={0} max={168} value={value.min_hours_before_booking} onChange={(e) => set("min_hours_before_booking", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-maxd" label="Máximo de días hacia adelante">
          <Input id="sc-maxd" type="number" min={1} max={365} value={value.max_days_in_advance} onChange={(e) => set("max_days_in_advance", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-cancel" label="Cancelar hasta (horas antes)">
          <Input id="sc-cancel" type="number" min={0} max={168} value={value.cancel_min_hours} onChange={(e) => set("cancel_min_hours", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-resch" label="Reprogramar hasta (horas antes)">
          <Input id="sc-resch" type="number" min={0} max={168} value={value.reschedule_min_hours} onChange={(e) => set("reschedule_min_hours", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-prep" label="Habilitar “Preparar mi sesión” (horas antes)">
          <Input id="sc-prep" type="number" min={1} max={168} value={value.session_prep_hours_before} onChange={(e) => set("session_prep_hours_before", Number(e.target.value))} />
        </FormField>
        <FormField id="sc-location" label="Dirección por defecto (presencial)" className="sm:col-span-2">
          <Input id="sc-location" value={value.default_location ?? ""} onChange={(e) => set("default_location", e.target.value.trim() || null)} />
        </FormField>
        <FormField id="sc-video" label="Proveedor de videollamada">
          <select id="sc-video" value={value.default_video_provider} onChange={(e) => set("default_video_provider", e.target.value as SchedulingSettings["default_video_provider"])} className={selectClass}>
            <option value="google_meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="other">Otro</option>
          </select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow id="sc-allow-cancel" label="Permitir cancelar desde la app" checked={value.allow_patient_cancel} onChange={(v) => set("allow_patient_cancel", v)} />
        <ToggleRow id="sc-allow-resch" label="Permitir reprogramar desde la app" checked={value.allow_patient_reschedule} onChange={(v) => set("allow_patient_reschedule", v)} />
        <ToggleRow id="sc-prep-on" label="Preparación de sesión habilitada" checked={value.session_prep_enabled} onChange={(v) => set("session_prep_enabled", v)} />
        <div className="flex items-center gap-5 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <span className="text-sm">Modalidades</span>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.modalities_enabled.includes("presencial")} onCheckedChange={(v) => toggleModality("presencial", Boolean(v))} /> Presencial
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.modalities_enabled.includes("virtual")} onCheckedChange={(v) => toggleModality("virtual", Boolean(v))} /> Virtual
          </label>
        </div>
      </div>
      <Button type="submit" loading={pending}>Guardar reglas de agenda</Button>
    </form>
  );
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
      <Label htmlFor={id} className="font-normal">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
