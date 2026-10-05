import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SessionPrepForm } from "@/components/patient/session-prep-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime, capitalize } from "@/lib/dates";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canPrepareSession } from "@/server/services/appointments";
import { getSessionPreparation } from "@/server/services/session-prep";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Preparar mi sesión" };

export default async function PrepareSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { patient } = await requirePatient();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: appointment }, scheduling] = await Promise.all([
    supabase.from("appointments").select("*").eq("id", id).eq("patient_id", patient.id).maybeSingle(),
    getSetting(supabase, "scheduling"),
  ]);
  if (!appointment) notFound();
  const existing = await getSessionPreparation(supabase, appointment.id);
  const enabled = canPrepareSession(appointment, scheduling);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Antes de la sesión" title="Preparar mi sesión" description={`Sesión del ${capitalize(formatDateTime(appointment.start_time, scheduling.timezone))}. Unas pocas preguntas para aprovechar mejor el encuentro.`} />
      {enabled ? (
        <SessionPrepForm appointmentId={appointment.id} existing={existing} />
      ) : (
        <Alert variant="info">
          <AlertTitle>Todavía no está habilitado</AlertTitle>
          <AlertDescription>
            <p>La preparación se habilita {scheduling.session_prep_hours_before} horas antes de la sesión.</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/app">Volver al inicio</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
