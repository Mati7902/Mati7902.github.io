"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestPasswordResetAction, null);
  const id = useId();

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <AlertTitle>Revisá tu email</AlertTitle>
          <AlertDescription>
            Si existe una cuenta con ese email, te enviamos un enlace para crear una contraseña nueva. Puede tardar unos minutos.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Volver al inicio de sesión</Link>
        </Button>
      </div>
    );
  }

  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FormField id={`${id}-email`} label="Email" error={errors.email} hint="Te enviaremos un enlace seguro para crear una contraseña nueva.">
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" required />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Enviar enlace
      </Button>
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Volver
      </Link>
    </form>
  );
}
