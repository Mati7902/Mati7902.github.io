import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingWizard } from "@/components/appointments/booking-wizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime, capitalize } from "@/lib/dates";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canPatientModify } from "@/server/services/appointments";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Reprogramar sesión" };

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { patient } = await requirePatient();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: appointment }, scheduling] = await Promise.all([
    supabase.from("appointments").select("*").eq("id", id).eq("patient_id", patient.id).maybeSingle(),
    getSetting(supabase, "scheduling"),
  ]);
  if (!appointment) notFound();
  const allowed = canPatientModify(appointment, scheduling, "reschedule");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Agenda" title="Reprogramar sesión" description={`Sesión actual: ${capitalize(formatDateTime(appointment.start_time, scheduling.timezone))}.`} />
      {allowed ? (
        <BookingWizard mode="reschedule" appointmentId={appointment.id} fixedModality={appointment.modality} modalitiesEnabled={[appointment.modality]} timezone={scheduling.timezone} />
      ) : (
        <Alert variant="warning">
          <AlertTitle>Este turno ya no puede reprogramarse desde la aplicación</AlertTitle>
          <AlertDescription>
            <p>Escribinos y lo coordinamos juntos.</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/app/agenda">Volver a la agenda</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
