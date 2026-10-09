import type { Metadata } from "next";

import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function PatientNotificationsPage() {
  // requirePatient también exige el consentimiento vigente (la navegación del cliente no pasa por el layout).
  const session = await requirePatient();
  const supabase = await createClient();
  const notifications = await listNotifications(supabase, session.userId);
  return (
    <div className="space-y-6">
      <PageHeader title="Notificaciones" description="Confirmaciones, cambios de turno, materiales y recordatorios." />
      <NotificationCenter notifications={notifications} basePath="/app" />
    </div>
  );
}
