import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Envoltorio accesible para campos de formulario: label asociado, texto de ayuda y error
 * anunciado con aria-describedby / role="alert".
 */
export function FormField({ id, label, hint, error, required, optional, children, className }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-2", className)} data-field={id} data-hint-id={hintId} data-error-id={errorId}>
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden className="text-destructive">*</span> : null}
        {optional ? <span className="font-normal text-subtle-foreground">(opcional)</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
