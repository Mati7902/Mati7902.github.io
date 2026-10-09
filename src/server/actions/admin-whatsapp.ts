"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok, AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";

/**
 * Devuelve a la asistente virtual una conversación derivada al profesional.
 * Se limpia el flujo en curso: la próxima respuesta del contacto arranca desde el menú.
 * La marca de crisis (crisis_flagged_at) se conserva como registro.
 */
export async function resumeConversationAction(conversationId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(conversationId);
  if (!parsed.success) return fail(new AppError("VALIDATION", "Conversación inválida."));
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: "open", handed_off_at: null, current_intent: null, state: { flow: null, step: null, updatedAt: new Date().toISOString() } })
      .eq("id", parsed.data)
      .eq("status", "handed_off")
      .select("id");
    if (error) throw error;
    if (!data?.length) return fail(new AppError("CONFLICT", "La conversación ya no estaba derivada."));
    await audit(supabase, "whatsapp.conversation_resumed", { type: "whatsapp_conversation", id: parsed.data });
    revalidatePath("/admin/whatsapp");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
