import { redirect } from "next/navigation";

import { PatientShell } from "@/components/shell/patient-shell";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/server/services/notifications";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatient();
  const supabase = await createClient();
  const [{ "site.identity": identity }, unreadCount, { data: legal }] = await Promise.all([
    getPublicSettingsSafe(),
    getUnreadCount(supabase, session.userId),
    supabase.from("settings").select("value").eq("key", "legal").maybeSingle(),
  ]);

  // Si cambió la versión de los textos legales, se pide aceptarlos de nuevo antes de seguir.
  // Solo con la configuración realmente leída: un fallo de lectura no bloquea el acceso.
  const requiredVersion = (legal?.value as { consent_version?: unknown } | null)?.consent_version;
  if (typeof requiredVersion === "string" && session.patient.consent_version !== requiredVersion) {
    redirect("/consentimiento");
  }

  return (
    <PatientShell
      platformName={identity.platform_name}
      userName={session.profile.full_name ?? `${session.patient.first_name} ${session.patient.last_name}`}
      avatarUrl={session.profile.avatar_url}
      unreadCount={unreadCount}
    >
      {children}
    </PatientShell>
  );
}
