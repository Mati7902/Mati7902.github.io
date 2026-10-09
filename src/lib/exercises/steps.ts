import { z } from "zod";

/**
 * Esquema del contenido JSON de exercise_templates.steps.
 * Un ejercicio es una lista de pasos, uno por pantalla (wizard).
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
  baseStep.extend({ type: z.literal("choice"), prompt: z.string(), options: z.array(z.string()).min(2) }),
  baseStep.extend({ type: z.literal("list"), prompt: z.string(), count: z.number().int().min(1).max(10) }),
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
    if (Array.isArray(value)) return value.join(", ");
    return value === undefined || value === null ? "…" : String(value);
  });
}

/** Pasos que requieren respuesta (para calcular progreso y validar). */
export function isInputStep(step: ExerciseStep): boolean {
  return ["text", "scale", "emotion", "choice", "list"].includes(step.type);
}

export const answersSchema = z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]));
export type ExerciseAnswers = z.infer<typeof answersSchema>;
