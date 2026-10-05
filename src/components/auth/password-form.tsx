"use client";

import { useActionState, useId } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      {mode === "invitation" ? (
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4">
            <Checkbox id={`${id}-consent`} name="consent" value="true" className="mt-0.5" aria-invalid={Boolean(errors.consent)} />
            <Label htmlFor={`${id}-consent`} className="items-start text-sm font-normal leading-relaxed text-muted-foreground">
              <span>
                Leí y acepto los{" "}
                <a href="/terminos" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                  términos de uso
                </a>
                , la{" "}
                <a href="/privacidad" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                  política de privacidad
                </a>{" "}
                y el uso de esta plataforma como apoyo al proceso terapéutico.
              </span>
            </Label>
          </div>
          {errors.consent ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {errors.consent}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {mode === "invitation" ? "Crear mi contraseña y entrar" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
