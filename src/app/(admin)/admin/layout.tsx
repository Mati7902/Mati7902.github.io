import { headers } from "next/headers";

import { DomainNotice } from "@/components/admin/domain-notice";
import { AdminShell } from "@/components/shell/admin-shell";
import { domainMismatch } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth/session";
import { brandLogo } from "@/lib/brand";
import { publicEnv } from "@/lib/env";
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
  const h = await headers();
  const mismatch = process.env.NODE_ENV === "production" ? domainMismatch(h.get("x-forwarded-host") ?? h.get("host"), publicEnv.appUrl) : null;

  return (
    <AdminShell
      platformName={identity.platform_name}
      logoUrl={brandLogo(identity)}
      brandName={identity.professional_name}
      brandSubtitle={identity.brand_subtitle}
      userName={session.profile.full_name ?? identity.professional_name}
      avatarUrl={session.profile.avatar_url}
      unreadCount={unreadCount}
      pendingRequests={pending.count ?? 0}
    >
      {mismatch ? <DomainNotice {...mismatch} /> : null}
      {children}
    </AdminShell>
  );
}
