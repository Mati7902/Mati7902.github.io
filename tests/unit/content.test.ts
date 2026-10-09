// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

// @ts-expect-error: módulo JavaScript de scripts/ sin tipos
import { buildContentSql, CONTENT_SQL_PATH, loadContent } from "../../scripts/build-content-sql.mjs";
import { COLLECTIONS } from "@/lib/exercises/collections";
import { type ExerciseStep, stepsSchema } from "@/lib/exercises/steps";

const CATEGORIES = ["ansiedad", "depresion", "autoestima", "tdah", "regulacion-emocional", "relaciones", "comunicacion", "sueno", "estres", "habitos", "duelo", "adicciones", "padres", "adolescentes", "psicoeducacion"];
const EXISTING_SLUGS = readFileSync("supabase/migrations/20261005000006_reference_data.sql", "utf8").match(/^\s*\('([a-z0-9-]+)', '[^']+', '[^']*', '(?:breathing|grounding|mindful_pause|thought_record|values|committed_action|defusion|dbt_skill|custom)'/gm)?.map((l) => /\('([a-z0-9-]+)'/.exec(l)![1]) ?? [];

const contentSchema = z.object({
  file: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  title: z.string().min(3).max(70),
  description: z.string().min(10).max(160),
  kind: z.enum(["thought_record", "values", "committed_action", "defusion", "dbt_skill", "custom"]),
  approach: z.enum(["tcc", "act", "dbt", "regulacion", "general"]),
  audience: z.enum(["todos", "adolescentes", "adultos"]),
  collection: z.string().refine((c) => c in COLLECTIONS, "colección desconocida"),
  estimated_minutes: z.number().int().min(1).max(45),
  sort_order: z.number().int().min(100).max(999),
  source: z.string().min(3),
  steps: z.array(z.unknown()).min(2).max(40),
  material: z.object({ title: z.string().min(3).max(80), description: z.string().min(10).max(200), category: z.enum(CATEGORIES as [string, ...string[]]) }).optional(),
});

type Item = z.infer<typeof contentSchema>;
const items = loadContent() as Item[];

/** Textos visibles de un paso (para revisar teléfonos y largo). */
function texts(step: ExerciseStep): string[] {
  const out = [step.help ?? ""];
  if ("prompt" in step) out.push(step.prompt);
  if ("content" in step && step.content) out.push(step.content);
  if ("title" in step && step.title) out.push(step.title);
  if (step.type === "reflect") out.push(step.template);
  if (step.type === "choice" || step.type === "checklist") out.push(...step.options);
  if (step.type === "choice" && step.feedback) out.push(...Object.values(step.feedback));
  return out;
}

describe("contenido de los cuadernillos (supabase/content/ejercicios)", () => {
  it("hay ejercicios de los dos cuadernillos", () => {
    expect(items.some((i) => i.collection === "brujula")).toBe(true);
    expect(items.some((i) => i.collection === "tcc")).toBe(true);
  });

  it.each(items.map((i) => [i.file, i] as const))("%s es válido", (_file, item) => {
    const meta = contentSchema.safeParse(item);
    expect(meta.success ? [] : meta.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)).toEqual([]);
    expect(item.file).toBe(`${item.slug}.json`);
    expect(item.audience).toBe(COLLECTIONS[item.collection]!.audience);

    const parsed = stepsSchema.safeParse(item.steps);
    expect(parsed.success ? [] : parsed.error.issues.map((e) => `steps.${e.path.join(".")}: ${e.message}`)).toEqual([]);
    if (!parsed.success) return;
    const steps = parsed.data;

    const ids = steps.map((s) => s.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), "ids repetidos").toEqual([]);
    for (const id of ids) expect(id, "id en snake_case").toMatch(/^[a-z][a-z0-9_]*$/);

    const answerable = new Set<string>();
    for (const step of steps) {
      if (step.type === "reflect") {
        for (const [, ref] of step.template.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) expect(answerable.has(ref!), `{{${ref}}} en ${step.id} no es una respuesta anterior`).toBe(true);
      }
      if (step.type === "choice" && step.feedback) {
        for (const key of Object.keys(step.feedback)) expect(step.options, `feedback "${key}" en ${step.id}`).toContain(key);
      }
      if (step.type === "checklist") {
        expect(new Set(step.options).size, `opciones repetidas en ${step.id}`).toBe(step.options.length);
        if (step.max !== undefined) expect(step.max).toBeLessThanOrEqual(step.options.length);
        if (step.min !== undefined && step.max !== undefined) expect(step.min).toBeLessThanOrEqual(step.max);
      }
      if (step.type === "choice") expect(new Set(step.options).size, `opciones repetidas en ${step.id}`).toBe(step.options.length);
      if (step.type === "list" && step.min !== undefined) expect(step.min).toBeLessThanOrEqual(step.count);
      if (step.type === "scale") expect(step.max).toBeGreaterThan(step.min);
      if (["text", "choice", "list", "checklist"].includes(step.type)) answerable.add(step.id);

      for (const t of texts(step)) {
        // Los teléfonos se configuran en Administración › Emergencia, nunca en el contenido.
        expect(t, `teléfono en ${step.id}`).not.toMatch(/\b(911|155|141|147|112|0800)\b/);
        expect((t.match(/\+?\d[\d\s-]{5,}\d/g) ?? []).filter((m) => m.replace(/\D/g, "").length >= 7), `teléfono en ${step.id}`).toEqual([]);
        expect(t, `HTML en ${step.id}`).not.toMatch(/<[a-z/][^>]*>/i);
      }
      if (step.type === "info" || step.type === "timed_info") expect(step.content.split(/\s+/).length, `pantalla ${step.id} demasiado larga`).toBeLessThanOrEqual(170);
      if ("prompt" in step) expect(step.prompt.length, `pregunta ${step.id} demasiado larga`).toBeLessThanOrEqual(140);
    }
    expect(steps.filter((s) => s.type === "scale" && s.maps_to === "emotion_before").length).toBeLessThanOrEqual(1);
    expect(steps.filter((s) => s.type === "scale" && s.maps_to === "emotion_after").length).toBeLessThanOrEqual(1);
  });

  it("los slugs y el orden no se repiten ni pisan ejercicios existentes", () => {
    const slugs = items.map((i) => i.slug);
    expect(slugs.filter((s, i) => slugs.indexOf(s) !== i)).toEqual([]);
    expect(slugs.filter((s) => EXISTING_SLUGS.includes(s))).toEqual([]);
    const orders = items.map((i) => i.sort_order);
    expect(orders.filter((o, i) => orders.indexOf(o) !== i)).toEqual([]);
  });

  it("la migración está al día con los JSON (si falla: pnpm db:contenido)", () => {
    expect(readFileSync(CONTENT_SQL_PATH, "utf8")).toBe(buildContentSql());
  });
});
