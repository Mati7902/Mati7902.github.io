"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import { type ActionResult, fail, ok } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";
import { pullGoogleChanges } from "@/server/services/google-calendar/sync";

export async function disconnectGoogleAction(): Promise<ActionResult> {
  try {
    const session = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("calendar_integrations").update({ is_active: false, access_token_encrypted: null, refresh_token_encrypted: null, sync_token: null }).eq("owner_profile_id", session.userId).eq("provider", "google");
    if (error) throw error;
    await audit(supabase, "integration.google_disconnected", { type: "calendar_integration", id: session.userId });
    revalidatePath("/admin/configuracion");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function syncGoogleNowAction(): Promise<ActionResult<{ imported: number; removed: number }>> {
  try {
    await assertAdmin();
    const result = await pullGoogleChanges();
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/configuracion");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
