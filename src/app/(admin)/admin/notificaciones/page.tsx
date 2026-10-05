import type { Metadata } from "next";

import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function AdminNotificationsPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const notifications = await listNotifications(supabase, session.userId, 50);
  return (
    <div className="space-y-6">
      <PageHeader title="Notificaciones" description="Solicitudes nuevas, confirmaciones y cancelaciones de pacientes." />
      <NotificationCenter notifications={notifications} basePath="/admin" />
    </div>
  );
}
