"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";
import { assignExerciseAction, assignMaterialAction } from "@/server/actions/admin-patients";

type Option = { id: string; title: string };

const selectClass = "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function AssignMaterialForm({ patientId, materials }: { patientId: string; materials: Option[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(assignMaterialAction, null);
  const id = useId();
  useEffect(() => {
    if (state?.ok) {
      toast.success("Material asignado. El paciente recibió una notificación.");
      router.refresh();
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="patient_id" value={patientId} />
      <FormField id={`${id}-material`} label="Material">
        <select id={`${id}-material`} name="material_id" required className={selectClass} defaultValue="">
          <option value="" disabled>Elegí un material…</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </FormField>
      <FormField id={`${id}-note`} label="Nota para el paciente" optional>
        <Input id={`${id}-note`} name="note" maxLength={500} placeholder="Ej.: leelo antes de la próxima sesión" />
      </FormField>
      <Button type="submit" loading={pending} disabled={materials.length === 0}>Asignar</Button>
    </form>
  );
}

export function AssignExerciseForm({ patientId, templates }: { patientId: string; templates: Option[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(assignExerciseAction, null);
  const id = useId();
  useEffect(() => {
    if (state?.ok) {
      toast.success("Ejercicio sugerido. El paciente recibió una notificación.");
      router.refresh();
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <input type="hidden" name="patient_id" value={patientId} />
      <FormField id={`${id}-template`} label="Ejercicio">
        <select id={`${id}-template`} name="template_id" required className={selectClass} defaultValue="">
          <option value="" disabled>Elegí un ejercicio…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </FormField>
      <FormField id={`${id}-note`} label="Nota" optional>
        <Input id={`${id}-note`} name="note" maxLength={500} placeholder="Ej.: una vez por día" />
      </FormField>
      <FormField id={`${id}-due`} label="Hasta" optional>
        <Input id={`${id}-due`} name="due_at" type="date" />
      </FormField>
      <Button type="submit" loading={pending}>Sugerir</Button>
    </form>
  );
}
