"use client";

import { useActionState, useId, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/errors";
import { changePasswordAction, updateContactAction, updateSharingAction } from "@/server/actions/profile";
import type { Patient } from "@/types/domain";

export function ContactForm({ patient }: { patient: Patient }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateContactAction, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.ok ? (
        <Alert variant="success">
          <AlertDescription>Datos actualizados.</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id={`${id}-phone`} label="Teléfono de contacto" error={errors.phone} hint={patient.whatsapp_phone ? `Los recordatorios por WhatsApp llegan al ${patient.whatsapp_phone}. Para cambiar ese número, avisale al profesional.` : "Para recibir recordatorios por WhatsApp, pedile al profesional que registre tu número."}>
        <Input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={patient.phone ?? ""} placeholder="0981 123 456" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id={`${id}-ecn`} label="Contacto de emergencia" optional error={errors.emergency_contact_name}>
          <Input id={`${id}-ecn`} name="emergency_contact_name" defaultValue={patient.emergency_contact_name ?? ""} placeholder="Nombre" />
        </FormField>
        <FormField id={`${id}-ecp`} label="Teléfono de emergencia" optional error={errors.emergency_contact_phone}>
          <Input id={`${id}-ecp`} name="emergency_contact_phone" type="tel" inputMode="tel" defaultValue={patient.emergency_contact_phone ?? ""} />
        </FormField>
      </div>
      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}

export function SharingToggle({ initial }: { initial: boolean }) {
  const [pending, startTransition] = useTransition();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base">
          Compartir mis registros con mi psicólogo
        </Label>
        <p className="text-sm text-muted-foreground">
          Incluye registros emocionales y ejercicios. Si lo desactivás, solo vos podés verlos. Podés cambiarlo cuando quieras.
        </p>
      </div>
      <Switch
        id={id}
        defaultChecked={initial}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const result = await updateSharingAction(checked);
            if (!result.ok) toast.error(result.error);
            else toast.success(checked ? "Tus registros se comparten con tu psicólogo." : "Tus registros ahora son privados.");
          })
        }
      />
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.ok ? (
        <Alert variant="success">
          <AlertDescription>Contraseña actualizada.</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id={`${id}-current`} label="Contraseña actual" error={errors.current}>
        <Input id={`${id}-current`} name="current" type="password" autoComplete="current-password" required />
      </FormField>
      <FormField id={`${id}-new`} label="Nueva contraseña" error={errors.password} hint="Mínimo 8 caracteres, con letras y números.">
        <Input id={`${id}-new`} name="password" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField id={`${id}-confirm`} label="Repetir nueva contraseña" error={errors.confirm}>
        <Input id={`${id}-confirm`} name="confirm" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" variant="outline" loading={pending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
