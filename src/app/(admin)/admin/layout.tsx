import { AdminShell } from "@/components/shell/admin-shell";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/server/services/notifications";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const supabase = await createClient();
  const [{ "site.identity": identity }, unreadCount, pending] = await Promise.all([
    getPublicSettingsSafe(),
    getUnreadCount(supabase, session.userId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "requested"),
  ]);

  return (
    <AdminShell
      platformName={identity.platform_name}
      userName={session.profile.full_name ?? identity.professional_name}
      avatarUrl={session.profile.avatar_url}
      unreadCount={unreadCount}
      pendingRequests={pending.count ?? 0}
    >
      {children}
    </AdminShell>
  );
}
