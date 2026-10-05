import type { Metadata } from "next";

import { BookingWizard } from "@/components/appointments/booking-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Agendar una sesión" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  await requirePatient();
  const { plan } = await searchParams;
  const supabase = await createClient();
  const scheduling = await getSetting(supabase, "scheduling");
  let planName: string | null = null;
  if (plan) {
    const { data } = await supabase.from("therapy_plans").select("name").eq("slug", plan).eq("is_active", true).maybeSingle();
    planName = data?.name ?? null;
  }
  const modalities = scheduling.modalities_enabled.length > 0 ? scheduling.modalities_enabled : (["presencial", "virtual"] as const);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Agenda" title="Agendar una sesión" description="Solo te mostramos horarios realmente disponibles." />
      <BookingWizard mode="new" modalitiesEnabled={[...modalities]} planSlug={planName ? plan : null} planName={planName} timezone={scheduling.timezone} />
    </div>
  );
}
