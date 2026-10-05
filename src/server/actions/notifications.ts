"use server";

import { revalidatePath } from "next/cache";

import { assertSession } from "@/lib/auth/session";
import { type ActionResult, fail, ok } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markRead } from "@/server/services/notifications";

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const session = await assertSession();
    const supabase = await createClient();
    await markAllRead(supabase, session.userId);
    revalidatePath("/app", "layout");
    revalidatePath("/admin", "layout");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  try {
    const session = await assertSession();
    const supabase = await createClient();
    await markRead(supabase, session.userId, id);
    revalidatePath("/app", "layout");
    revalidatePath("/admin", "layout");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
