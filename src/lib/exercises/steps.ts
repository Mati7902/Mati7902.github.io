import { z } from "zod";

import { emotionLabel } from "@/lib/config/site";

/**
 * Esquema del contenido JSON de exercise_templates.steps.
 * Un ejercicio es una lista de pasos, uno por pantalla (wizard).
 * Los textos largos (content, help) admiten párrafos separados por una línea en blanco,
 * viñetas con "- " al principio de la línea y **negrita**.
 */
const baseStep = z.object({
  id: z.string().min(1),
  optional: z.boolean().optional(),
  help: z.string().optional(),
});

export const stepSchema = z.discriminatedUnion("type", [
  baseStep.extend({ type: z.literal("text"), prompt: z.string(), placeholder: z.string().optional() }),
  baseStep.extend({
    type: z.literal("scale"),
    prompt: z.string(),
    min: z.number().int().default(0),
    max: z.number().int().default(10),
    min_label: z.string().optional(),
    max_label: z.string().optional(),
    maps_to: z.enum(["emotion_before", "emotion_after"]).optional(),
  }),
  baseStep.extend({ type: z.literal("emotion"), prompt: z.string() }),
  baseStep.extend({
    type: z.literal("choice"),
    prompt: z.string(),
    options: z.array(z.string()).min(2),
    /** Devolución que aparece al elegir cada opción (quizzes de psicoeducación). */
    feedback: z.record(z.string(), z.string()).optional(),
  }),
  /** Selección múltiple: "marcá las que quieras". */
  baseStep.extend({
    type: z.literal("checklist"),
    prompt: z.string(),
    options: z.array(z.string()).min(2),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
  }),
  baseStep.extend({
    type: z.literal("list"),
    prompt: z.string(),
    count: z.number().int().min(1).max(10),
    /** Cuántos renglones hay que completar como mínimo (por defecto, todos). */
    min: z.number().int().min(0).max(10).optional(),
  }),
  baseStep.extend({ type: z.literal("info"), title: z.string().optional(), content: z.string() }),
  baseStep.extend({ type: z.literal("timed_info"), title: z.string().optional(), content: z.string(), seconds: z.number().int().min(5).max(600) }),
  baseStep.extend({ type: z.literal("reflect"), title: z.string().optional(), template: z.string(), content: z.string().optional() }),
]);

export type ExerciseStep = z.infer<typeof stepSchema>;
export const stepsSchema = z.array(stepSchema);

/** Configuración de los ejercicios de respiración (no son wizard). */
export const breathingConfigSchema = z.object({
  pattern: z.object({
    inhale: z.number().min(1).max(20),
    hold: z.number().min(0).max(20).default(0),
    exhale: z.number().min(1).max(20),
    hold_after: z.number().min(0).max(20).default(0),
  }),
  durations: z.array(z.number().int().min(1).max(30)).default([1, 3, 5]),
});
export type BreathingConfig = z.infer<typeof breathingConfigSchema>;

export function parseSteps(raw: unknown): ExerciseStep[] {
  const result = stepsSchema.safeParse(raw);
  return result.success ? result.data : [];
}

export function parseBreathingConfig(raw: unknown): BreathingConfig | null {
  const result = breathingConfigSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Interpola {{clave}} con respuestas previas. */
export function interpolate(template: string, answers: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = answers[key];
    if (Array.isArray(value)) {
      // Las listas pueden quedar a medias: sin renglones vacíos ("a, , ").
      const items = value.map((v) => String(v).trim()).filter(Boolean);
      return items.length > 0 ? items.join(", ") : "…";
    }
    return value === undefined || value === null || String(value).trim() === "" ? "…" : String(value);
  });
}

/** Pasos que requieren respuesta (para calcular progreso y validar). */
export function isInputStep(step: ExerciseStep): boolean {
  return ["text", "scale", "emotion", "choice", "checklist", "list"].includes(step.type);
}

/** ¿La respuesta alcanza para seguir? Una escala sin tocar vale su punto medio. */
export function isStepAnswered(step: ExerciseStep, value: ExerciseAnswers[string] | undefined): boolean {
  switch (step.type) {
    case "scale":
      return true;
    case "text":
    case "emotion":
    case "choice":
      return typeof value === "string" && value.trim().length > 0;
    case "checklist": {
      const selected = Array.isArray(value) ? value.length : 0;
      return selected >= Math.max(1, step.min ?? 1) && (step.max === undefined || selected <= step.max);
    }
    case "list": {
      const filled = Array.isArray(value) ? value.filter((v) => v.trim().length > 0).length : 0;
      return filled >= Math.max(1, step.min ?? step.count);
    }
    default:
      return true;
  }
}

export const answersSchema = z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]));
export type ExerciseAnswers = z.infer<typeof answersSchema>;

export type AnswerEntry = { id: string; label: string; value: string | string[] };

/**
 * Respuestas guardadas en el orden del ejercicio, como pares pregunta → respuesta para mostrar
 * (historial del paciente y ficha del profesional). Omite lo que quedó vacío.
 */
export function answerEntries(steps: ExerciseStep[], answers: Record<string, unknown>): AnswerEntry[] {
  const entries: AnswerEntry[] = [];
  for (const step of steps) {
    if (!isInputStep(step)) continue;
    const raw = answers[step.id];
    const label = "prompt" in step ? step.prompt : step.id;
    if (step.type === "scale" && typeof raw === "number") entries.push({ id: step.id, label, value: `${raw} de ${step.max}` });
    else if (step.type === "emotion" && typeof raw === "string" && raw) entries.push({ id: step.id, label, value: emotionLabel(raw) });
    else if (Array.isArray(raw)) {
      const items = raw.map((v) => String(v).trim()).filter(Boolean);
      if (items.length > 0) entries.push({ id: step.id, label, value: items });
    } else if (typeof raw === "string" && raw.trim()) entries.push({ id: step.id, label, value: raw.trim() });
  }
  if (typeof answers.duration_minutes === "number") entries.push({ id: "duration_minutes", label: "Duración", value: `${answers.duration_minutes} min` });
  return entries;
}

