"use client";

import { useActionState, useId } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { acceptConsentAction } from "@/server/actions/auth";

/** Casilla de aceptación de términos y privacidad (invitación y re-aceptación). */
export function ConsentCheckbox({ error }: { error?: string }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4">
        <Checkbox id={`${id}-consent`} name="consent" value="true" className="mt-0.5" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-consent-error` : undefined} />
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
      {error ? (
        <p id={`${id}-consent-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ConsentForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(acceptConsentAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <ConsentCheckbox error={errors.consent} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Aceptar y continuar
      </Button>
    </form>
  );
}
