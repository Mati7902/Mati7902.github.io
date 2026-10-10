import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { CrisisBanner } from "@/components/calm/crisis-banner";
import { IntakeAnswers } from "@/components/intake/intake-answers";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/dates";
import { INTAKE_STEPS, initialIntakeAnswers } from "@/lib/intake/form";
import { createClient } from "@/lib/supabase/server";
import { getIntake, intakeAnswersOf } from "@/server/services/intake";
import { getActiveEmergencyResources } from "@/server/services/public-content";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const metadata: Metadata = { title: "Ficha de ingreso" };

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ bienvenida?: string; editar?: string; parte?: string }> }) {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [intake, resources, settings, params] = await Promise.all([getIntake(supabase, patient.id), getActiveEmergencyResources(), getPublicSettingsSafe(), searchParams]);
  const identity = settings["site.identity"];
  const submitted = Boolean(intake?.submitted_at);
  const part = params.parte !== undefined && /^\d+$/.test(params.parte) && Number(params.parte) < INTAKE_STEPS.length ? Number(params.parte) : null;
  const editing = params.editar === "1" || part !== null;

  if (intake && submitted && !editing) {
    const sent = intake.first_submitted_at ?? intake.submitted_at!;
    const resent = intake.submitted_at && intake.submitted_at !== sent ? ` · Actualizada el ${formatShortDate(intake.submitted_at)}` : "";
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Mi cuenta"
          title="Mi ficha de ingreso"
          description={`Enviada a ${identity.professional_name} el ${formatShortDate(sent)}${resent}. La ves solo vos y ${identity.professional_name}.`}
          actions={
            <Button asChild variant="outline">
              <Link href="/app/ingreso?editar=1">
                <Pencil aria-hidden /> Actualizar mis respuestas
              </Link>
            </Button>
          }
        />
        <IntakeAnswers answers={intakeAnswersOf(intake)} audience="patient" editHref={(index) => `/app/ingreso?parte=${index}`} className="max-w-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={submitted ? "Mi cuenta" : "Antes de empezar"} title="Ficha de ingreso" />
      <IntakeWizard
        initialAnswers={intake ? intakeAnswersOf(intake) : initialIntakeAnswers(patient)}
        submitted={submitted}
        hasDraft={Boolean(intake)}
        professionalName={identity.professional_name}
        firstName={patient.first_name}
        welcome={params.bienvenida === "1" && !intake}
        startAt={part ?? (submitted ? "review" : null)}
        crisis={<CrisisBanner settings={settings.emergency} resources={resources} professionalWhatsApp={identity.whatsapp} />}
      />
    </div>
  );
}
