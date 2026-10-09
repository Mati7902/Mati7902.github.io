"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, validationFail } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";
import { createBlockedSlot, deleteAvailabilityRule, deleteBlockedSlot, upsertAvailabilityRule } from "@/server/services/admin-schedule";
import { audit } from "@/server/services/audit";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM).");

const ruleSchema = z
  .object({
    id: z.string().uuid().optional(),
    weekday: z.number().int().min(0).max(6),
    start_time: time,
    end_time: time,
    slot_duration_minutes: z.number().int().min(15).max(240),
    buffer_minutes: z.number().int().min(0).max(120),
    modality: z.enum(["presencial", "virtual", "mixta"]),
    is_active: z.boolean(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .refine((r) => r.end_time > r.start_time, { message: "La hora de fin debe ser posterior a la de inicio.", path: ["end_time"] });

export async function saveAvailabilityRuleAction(input: z.infer<typeof ruleSchema>): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const rule = await upsertAvailabilityRule(supabase, parsed.data);
    await audit(supabase, "availability.rule_saved", { type: "availability_rule", id: rule.id });
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/agenda");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAvailabilityRuleAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await deleteAvailabilityRule(supabase, id);
    await audit(supabase, "availability.rule_deleted", { type: "availability_rule", id });
    revalidatePath("/admin/configuracion");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

const blockSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    type: z.enum(["block", "vacation", "holiday", "exception"]),
    reason: z.string().trim().max(200).optional().nullable(),
  })
  .refine((b) => new Date(b.end) > new Date(b.start), { message: "El fin debe ser posterior al inicio.", path: ["end"] });

export async function createBlockedSlotAction(input: z.infer<typeof blockSchema>): Promise<ActionResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return validationFail(zodFieldErrors(parsed.error));
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const block = await createBlockedSlot(supabase, { start: new Date(parsed.data.start), end: new Date(parsed.data.end), type: parsed.data.type, reason: parsed.data.reason, createdBy: session.userId });
    await audit(supabase, "availability.block_created", { type: "blocked_slot", id: block.id }, { type_: block.type });
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/configuracion");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBlockedSlotAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await deleteBlockedSlot(supabase, id);
    await audit(supabase, "availability.block_deleted", { type: "blocked_slot", id });
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/configuracion");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
