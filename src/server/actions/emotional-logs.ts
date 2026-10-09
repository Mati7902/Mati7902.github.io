"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPatient } from "@/lib/auth/session";
import { EMOTIONS } from "@/lib/config/site";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import { createEmotionalLog, deleteEmotionalLog } from "@/server/services/emotional-logs";

const emotionKeys = EMOTIONS.map((e) => e.key) as [string, ...string[]];

const emotionalLogSchema = z.object({
  emotions: z.array(z.enum(emotionKeys)).min(1, "Elegí al menos una emoción.").max(3, "Elegí hasta tres emociones."),
  intensity: z.number().int().min(0).max(10),
  situation: z.string().trim().max(1000).optional().nullable(),
  thought: z.string().trim().max(1000).optional().nullable(),
  behavior: z.string().trim().max(1000).optional().nullable(),
  need: z.string().trim().max(1000).optional().nullable(),
});

export type EmotionalLogPayload = z.infer<typeof emotionalLogSchema>;

export async function saveEmotionalLogAction(payload: EmotionalLogPayload): Promise<ActionResult<{ id: string }>> {
  const parsed = emotionalLogSchema.safeParse(payload);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const log = await createEmotionalLog(supabase, patient.id, {
      emotions: parsed.data.emotions,
      intensity: parsed.data.intensity,
      situation: parsed.data.situation || null,
      thought: parsed.data.thought || null,
      behavior: parsed.data.behavior || null,
      need: parsed.data.need || null,
    });
    revalidatePath("/app/registro");
    revalidatePath("/app");
    return ok({ id: log.id });
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEmotionalLogAction(id: string): Promise<ActionResult> {
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    await deleteEmotionalLog(supabase, patient.id, id);
    revalidatePath("/app/registro");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
