"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveNotificationTemplateAction } from "@/server/actions/admin-settings";

export type TemplateRow = { key: string; body: string; variables: string[]; wa_template_name: string | null; is_active: boolean; channel: string };

const LABELS: Record<string, string> = {
  booking_registered: "Turno registrado",
  booking_requested: "Solicitud recibida",
  reminder_24h: "Recordatorio 24 h antes",
  reminder_2h: "Recordatorio adicional",
  confirmation_thanks: "Agradecimiento al confirmar",
  cancellation_done: "Cancelación realizada",
  appointment_changed: "Cambio de turno por el profesional",
  request_approved: "Solicitud aprobada",
  login_help: "Ayuda para ingresar",
};

export function TemplateEditor({ template }: { template: TemplateRow }) {
  const [body, setBody] = useState(template.body);
  const [waName, setWaName] = useState(template.wa_template_name ?? "");
  const [active, setActive] = useState(template.is_active);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const res = await saveNotificationTemplateAction({ key: template.key, body, wa_template_name: waName || null, is_active: active });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Plantilla guardada.");
    });
  return (
    <details className="group rounded-2xl border border-border/70 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span>
          <span className="block font-medium">{LABELS[template.key] ?? template.key}</span>
          <span className="block text-xs text-muted-foreground">
            Variables: {template.variables.length ? template.variables.map((v) => `{{${v}}}`).join(" ") : "ninguna"}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{active ? "Activa" : "Inactiva"}</span>
      </summary>
      <div className="space-y-4 border-t border-border/60 px-5 py-4">
        <FormField id={`tpl-${template.key}`} label="Texto del mensaje">
          <Textarea id={`tpl-${template.key}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} className="min-h-28" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormField id={`tpl-wa-${template.key}`} label="Nombre de plantilla aprobada en Meta" optional hint="Necesaria para mensajes fuera de la ventana de 24 h (recordatorios).">
            <Input id={`tpl-wa-${template.key}`} value={waName} onChange={(e) => setWaName(e.target.value)} placeholder="recordatorio_sesion_24h" />
          </FormField>
          <label className="flex h-12 items-center gap-3 text-sm">
            <Switch checked={active} onCheckedChange={setActive} aria-label="Plantilla activa" /> Activa
          </label>
        </div>
        <Button onClick={save} loading={pending} size="sm">Guardar plantilla</Button>
      </div>
    </details>
  );
}
