"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { deletePlanAction, savePlanAction } from "@/server/actions/admin-plans";
import type { TherapyPlan } from "@/types/domain";

const selectClass = "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function PlanFormDialog({ plan }: { plan?: TherapyPlan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await savePlanAction(prev, formData);
    if (result.ok) {
      toast.success(plan ? "Plan actualizado." : "Plan creado.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${plan.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> Nuevo servicio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Editar ${plan.name}` : "Nuevo servicio o plan"}</DialogTitle>
          <DialogDescription>Los textos y precios se publican tal cual en la web. Dejá el precio vacío para mostrar “A consultar”.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          {state && !state.ok && !state.fieldErrors ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id={`${id}-name`} label="Nombre" required error={errors.name}>
            <Input id={`${id}-name`} name="name" defaultValue={plan?.name ?? ""} required />
          </FormField>
          <FormField id={`${id}-slug`} label="Identificador (URL)" required error={errors.slug} hint="minúsculas-y-guiones">
            <Input id={`${id}-slug`} name="slug" defaultValue={plan?.slug ?? ""} required pattern="[a-z0-9-]+" />
          </FormField>
          <FormField id={`${id}-short`} label="Descripción corta" optional className="sm:col-span-2">
            <Input id={`${id}-short`} name="short_description" defaultValue={plan?.short_description ?? ""} maxLength={200} />
          </FormField>
          <FormField id={`${id}-price`} label="Precio (Gs.)" optional error={errors.price_amount} hint="Vacío = a consultar">
            <Input id={`${id}-price`} name="price_amount" type="number" min={0} step={1000} defaultValue={plan?.price_amount ?? ""} />
          </FormField>
          <FormField id={`${id}-currency`} label="Moneda">
            <Input id={`${id}-currency`} name="currency" defaultValue={plan?.currency ?? "PYG"} maxLength={3} />
          </FormField>
          <FormField id={`${id}-duration`} label="Duración (min)" optional>
            <Input id={`${id}-duration`} name="duration_minutes" type="number" min={10} max={600} defaultValue={plan?.duration_minutes ?? ""} />
          </FormField>
          <FormField id={`${id}-sessions`} label="Sesiones incluidas" optional>
            <Input id={`${id}-sessions`} name="sessions_included" type="number" min={1} max={100} defaultValue={plan?.sessions_included ?? ""} />
          </FormField>
          <FormField id={`${id}-features`} label="Incluye (una línea por ítem)" className="sm:col-span-2">
            <Textarea id={`${id}-features`} name="features" defaultValue={plan?.features.join("\n") ?? ""} className="min-h-24" />
          </FormField>
          <FormField id={`${id}-cta`} label="Texto del botón">
            <Input id={`${id}-cta`} name="cta_label" defaultValue={plan?.cta_label ?? "Solicitar turno"} maxLength={40} />
          </FormField>
          <FormField id={`${id}-ctatype`} label="Acción del botón">
            <select id={`${id}-ctatype`} name="cta_type" defaultValue={plan?.cta_type ?? "book"} className={selectClass}>
              <option value="book">Solicitar turno (reserva)</option>
              <option value="consult">Consultar (contacto)</option>
            </select>
          </FormField>
          <FormField id={`${id}-order`} label="Orden">
            <Input id={`${id}-order`} name="sort_order" type="number" min={0} defaultValue={plan?.sort_order ?? 0} />
          </FormField>
          <div className="flex flex-col justify-end gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-active`} name="is_active" value="true" defaultChecked={plan?.is_active ?? true} />
              <Label htmlFor={`${id}-active`} className="font-normal">Visible en la web</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-featured`} name="is_featured" value="true" defaultChecked={plan?.is_featured ?? false} />
              <Label htmlFor={`${id}-featured`} className="font-normal">Destacado</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending}>{plan ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePlanButton({ plan }: { plan: TherapyPlan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive"
      aria-label={`Eliminar ${plan.name}`}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`¿Eliminar "${plan.name}"? Si tiene turnos asociados, desactivalo en lugar de borrarlo.`)) return;
        startTransition(async () => {
          const res = await deletePlanAction(plan.id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Plan eliminado.");
          router.refresh();
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}
