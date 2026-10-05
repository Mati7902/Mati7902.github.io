import "server-only";

import type { AdminSupabaseClient } from "@/lib/supabase/admin";

export type TemplateRow = {
  key: string;
  channel: string;
  title: string | null;
  body: string;
  variables: string[];
  wa_template_name: string | null;
  wa_template_language: string | null;
  is_active: boolean;
};

/** Reemplaza {{variable}} en el cuerpo de la plantilla. Las variables faltantes quedan vacías. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const value = vars[key];
      return value === null || value === undefined ? "" : String(value);
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function getTemplate(admin: AdminSupabaseClient, key: string): Promise<TemplateRow | null> {
  const { data } = await admin.from("notification_templates").select("*").eq("key", key).eq("is_active", true).maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

/** Orden de parámetros para plantillas aprobadas de Meta (posicionales {{1}}, {{2}}…). */
export function templateParams(template: TemplateRow, vars: Record<string, string | number | null | undefined>): string[] {
  return template.variables.map((v) => {
    const value = vars[v];
    return value === null || value === undefined ? "-" : String(value);
  });
}
