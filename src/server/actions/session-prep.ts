"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPatient } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import { canPrepareSession } from "@/server/services/appointments";
import { upsertSessionPreparation } from "@/server/services/session-prep";
import { getSetting } from "@/server/services/settings";

const schema = z.object({
  appointmentId: z.string().uuid(),
  weekRating: z.number().int().min(0).max(10).nullable(),
  hardest: z.string().trim().max(2000).nullable().optional(),
  better: z.string().trim().max(2000).nullable().optional(),
  topics: z.string().trim().max(2000).nullable().optional(),
  practiced: z.string().trim().max(2000).nullable().optional(),
  important: z.string().trim().max(2000).nullable().optional(),
  submit: z.boolean().default(true),
});

export type SessionPrepPayload = z.infer<typeof schema>;

export async function saveSessionPrepAction(payload: SessionPrepPayload): Promise<ActionResult> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const { patient } = await assertPatient();
    const supabase = await createClient();
    const { data: appointment } = await supabase.from("appointments").select("*").eq("id", parsed.data.appointmentId).eq("patient_id", patient.id).maybeSingle();
    if (!appointment) throw new AppError("NOT_FOUND", "No encontramos esa sesión.");
    const scheduling = await getSetting(supabase, "scheduling");
    if (!canPrepareSession(appointment, scheduling)) {
      throw new AppError("VALIDATION", "La preparación se habilita poco antes de la sesión.");
    }
    await upsertSessionPreparation(
      supabase,
      patient.id,
      appointment.id,
      {
        weekRating: parsed.data.weekRating,
        hardest: parsed.data.hardest || null,
        better: parsed.data.better || null,
        topics: parsed.data.topics || null,
        practiced: parsed.data.practiced || null,
        important: parsed.data.important || null,
      },
      parsed.data.submit,
    );
    revalidatePath("/app");
    revalidatePath(`/app/preparar-sesion/${appointment.id}`);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
