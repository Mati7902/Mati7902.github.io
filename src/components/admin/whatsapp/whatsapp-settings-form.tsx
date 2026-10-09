"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsSave } from "@/hooks/use-settings-save";
import type { WhatsAppSettings } from "@/server/services/settings";

export function WhatsAppSettingsForm({ initial, configured }: { initial: WhatsAppSettings; configured: boolean }) {
  const [value, setValue] = useState(initial);
  const { save, pending, fieldErrors } = useSettingsSave("whatsapp");
  const set = <K extends keyof WhatsAppSettings>(key: K, v: WhatsAppSettings[K]) => setValue((s) => ({ ...s, [key]: v }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5">
        <div>
          <Label htmlFor="wa-enabled" className="text-base">Secretaria virtual activa</Label>
          <p className="text-sm text-muted-foreground">
            {configured ? "Credenciales de Meta detectadas." : "Faltan credenciales en el servidor (META_WHATSAPP_TOKEN, PHONE_NUMBER_ID, APP_SECRET, VERIFY_TOKEN)."}
          </p>
        </div>
        <Switch id="wa-enabled" checked={value.enabled} onCheckedChange={(v) => set("enabled", v)} disabled={!configured && !value.enabled} />
      </div>
      <FormField id="wa-name" label="Nombre de la asistente" error={fieldErrors.assistant_name}>
        <Input id="wa-name" value={value.assistant_name} onChange={(e) => set("assistant_name", e.target.value)} />
      </FormField>
      <FormField id="wa-greeting" label="Saludo inicial" hint="Cordial, breve y sin emojis por defecto.">
        <Textarea id="wa-greeting" value={value.greeting} onChange={(e) => set("greeting", e.target.value)} />
      </FormField>
      <FormField id="wa-scope" label="Mensaje al salir del alcance administrativo" hint="Se usa cuando la persona plantea un tema clínico.">
        <Textarea id="wa-scope" value={value.out_of_scope_message} onChange={(e) => set("out_of_scope_message", e.target.value)} />
      </FormField>
      <FormField id="wa-handoff" label="Mensaje de derivación al profesional">
        <Textarea id="wa-handoff" value={value.handoff_message} onChange={(e) => set("handoff_message", e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:col-span-1">
          <Label htmlFor="wa-ai" className="font-normal">Interpretar con IA</Label>
          <Switch id="wa-ai" checked={value.ai_enabled} onCheckedChange={(v) => set("ai_enabled", v)} />
        </div>
        <FormField id="wa-threshold" label="Confianza mínima de IA" hint="0 a 1. Debajo de este valor se pide aclaración.">
          <Input id="wa-threshold" type="number" min={0} max={1} step={0.05} value={value.ai_confidence_threshold} onChange={(e) => set("ai_confidence_threshold", Number(e.target.value))} />
        </FormField>
        <FormField id="wa-slots" label="Horarios a ofrecer por mensaje">
          <Input id="wa-slots" type="number" min={1} max={10} value={value.max_slots_to_offer} onChange={(e) => set("max_slots_to_offer", Number(e.target.value))} />
        </FormField>
      </div>
      <Button type="submit" loading={pending}>Guardar</Button>
    </form>
  );
}
