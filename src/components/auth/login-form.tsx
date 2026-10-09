"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { signInAction } from "@/server/actions/auth";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(signInAction, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : initialError;

  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id={`${id}-email`} label="Email" error={errors.email}>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" required aria-invalid={Boolean(errors.email)} />
      </FormField>
      <FormField id={`${id}-password`} label="Contraseña" error={errors.password}>
        <Input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(errors.password)} />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <Checkbox id={`${id}-remember`} name="remember" value="true" defaultChecked />
          <Label htmlFor={`${id}-remember`} className="whitespace-nowrap font-normal text-muted-foreground">
            Mantener sesión iniciada
          </Label>
        </div>
        <Link href="/recuperar" className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium text-primary hover:underline">
          Olvidé mi contraseña
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Ingresar
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Todavía no tenés cuenta? El acceso se habilita por invitación del profesional.
      </p>
    </form>
  );
}
