"use client";

import { useActionState, useId } from "react";

import { ConsentCheckbox } from "@/components/auth/consent-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";
import { completeInvitationAction, updatePasswordAction } from "@/server/actions/auth";

type Props = { mode: "reset" | "invitation" };

export function PasswordForm({ mode }: Props) {
  const serverAction = mode === "invitation" ? completeInvitationAction : updatePasswordAction;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(serverAction, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id={`${id}-password`} label="Nueva contraseña" error={errors.password} hint="Mínimo 8 caracteres, combinando letras y números.">
        <Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(errors.password)} />
      </FormField>
      <FormField id={`${id}-confirm`} label="Repetir contraseña" error={errors.confirm}>
        <Input id={`${id}-confirm`} name="confirm" type="password" autoComplete="new-password" required aria-invalid={Boolean(errors.confirm)} />
      </FormField>
      {mode === "invitation" ? <ConsentCheckbox error={errors.consent} /> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {mode === "invitation" ? "Crear mi contraseña y entrar" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
