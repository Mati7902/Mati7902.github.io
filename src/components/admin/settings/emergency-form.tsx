"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsSave } from "@/hooks/use-settings-save";
import { deleteEmergencyResourceAction, saveEmergencyResourceAction } from "@/server/actions/admin-settings";
import type { EmergencySettings } from "@/server/services/settings";
import type { EmergencyResource } from "@/types/domain";

export function EmergencyMessageForm({ initial }: { initial: EmergencySettings }) {
  const [value, setValue] = useState(initial);
  const { save, pending } = useSettingsSave("emergency");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <FormField id="em-message" label="Mensaje de emergencia" hint="Se muestra en la app y lo envía el chatbot ante señales de riesgo.">
        <Textarea id="em-message" value={value.message} onChange={(e) => setValue({ ...value, message: e.target.value })} />
      </FormField>
      <FormField id="em-note" label="Aclaración sobre el contacto con el profesional">
        <Input id="em-note" value={value.contact_note} onChange={(e) => setValue({ ...value, contact_note: e.target.value })} />
      </FormField>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
        <Label htmlFor="em-contact" className="font-normal">Mostrar botón “Contactar al profesional”</Label>
        <Switch id="em-contact" checked={value.show_contact_professional} onCheckedChange={(v) => setValue({ ...value, show_contact_professional: v })} />
      </div>
      <Button type="submit" loading={pending}>Guardar mensaje</Button>
    </form>
  );
}

type Draft = { id?: string; name: string; description: string; phone: string; url: string; sort_order: number; is_active: boolean };

export function EmergencyResourcesEditor({ resources }: { resources: EmergencyResource[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(resources.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", phone: r.phone ?? "", url: r.url ?? "", sort_order: r.sort_order, is_active: r.is_active })));
  const [pending, startTransition] = useTransition();
  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      const res = await saveEmergencyResourceAction({ ...row, description: row.description || null, phone: row.phone || null, url: row.url || null });
      if (!res.ok) return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] ?? res.error : res.error);
      toast.success("Recurso guardado.");
      router.refresh();
    });

  const removeRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      if (row.id) {
        const res = await deleteEmergencyResourceAction(row.id);
        if (!res.ok) return void toast.error(res.error);
      }
      setDrafts((d) => d.filter((_, idx) => idx !== i));
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>Verificá cada número antes de activarlo</AlertTitle>
        <AlertDescription>Los recursos precargados están inactivos a propósito. Confirmá vigencia y cobertura (Paraguay) y recién entonces activalos: aparecerán en la app y en el chatbot.</AlertDescription>
      </Alert>
      <ul className="space-y-3">
        {drafts.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div className="space-y-2 sm:col-span-4 sm:grid sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-3 sm:space-y-0">
              <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Nombre del recurso" aria-label="Nombre" />
              <Input value={r.phone} onChange={(e) => update(i, { phone: e.target.value })} placeholder="Teléfono" aria-label="Teléfono" />
              <Input value={r.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://" aria-label="Sitio web" />
            </div>
            <Input value={r.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Descripción breve" aria-label="Descripción" className="sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={r.is_active} onCheckedChange={(v) => update(i, { is_active: v })} aria-label="Activo" /> {r.is_active ? "Activo (verificado)" : "Inactivo"}
            </label>
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" onClick={() => saveRow(i)} disabled={pending}>Guardar</Button>
              <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} disabled={pending} aria-label="Eliminar"><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => setDrafts((d) => [...d, { name: "", description: "", phone: "", url: "", sort_order: d.length + 1, is_active: false }])} disabled={pending}>
        <Plus aria-hidden /> Agregar recurso
      </Button>
    </div>
  );
}
