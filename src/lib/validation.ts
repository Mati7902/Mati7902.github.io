import type { ZodError, ZodType } from "zod";

/** Convierte un ZodError en un mapa campo → primer mensaje de error. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parsea un FormData contra un schema, devolviendo datos tipados o errores por campo. */
export function parseForm<T>(schema: ZodType<T>, formData: FormData): { data: T; errors: null } | { data: null; errors: Record<string, string> } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue; // metadatos de Next/React
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const current = (raw[k] as unknown[] | undefined) ?? [];
      current.push(value);
      raw[k] = current;
    } else {
      raw[key] = value;
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) return { data: null, errors: zodFieldErrors(result.error) };
  return { data: result.data, errors: null };
}
