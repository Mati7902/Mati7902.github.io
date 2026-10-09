import { PatientShell } from "@/components/shell/patient-shell";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/server/services/notifications";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatient();
  const supabase = await createClient();
  // requirePatient también exige el consentimiento vigente (redirige a /consentimiento).
  const [{ "site.identity": identity }, unreadCount] = await Promise.all([
    getPublicSettingsSafe(),
    getUnreadCount(supabase, session.userId),
  ]);

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
