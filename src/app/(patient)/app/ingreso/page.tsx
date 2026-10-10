import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Pencil } from "lucide-react";

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

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ bienvenida?: string; editar?: string; parte?: string; enviada?: string }> }) {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [intake, resources, settings, params] = await Promise.all([getIntake(supabase, patient.id), getActiveEmergencyResources(), getPublicSettingsSafe(), searchParams]);
  const identity = settings["site.identity"];
  const submitted = Boolean(intake?.submitted_at);
  const part = params.parte === "revision" ? "review" : params.parte !== undefined && /^\d+$/.test(params.parte) && Number(params.parte) < INTAKE_STEPS.length ? Number(params.parte) : null;
  const editing = params.editar === "1" || part !== null;
  // Con una ficha ya guardada, los datos personales se muestran como están hoy en la ficha
  // administrativa (pueden haberse corregido después desde el perfil o el panel).
  const current = initialIntakeAnswers(patient);
  const initialAnswers = intake
    ? {
        ...intakeAnswersOf(intake),
        ...(current.fecha_nacimiento ? { fecha_nacimiento: current.fecha_nacimiento } : {}),
        ...(current.telefono ? { telefono: current.telefono } : {}),
        ...(current.contacto_emergencia ? { contacto_emergencia: current.contacto_emergencia } : {}),
      }
    : current;

  // Confirmación después de enviar (el formulario navega acá cuando la base confirmó el envío).
  if (intake && submitted && params.enviada === "1") {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint-50 text-mint-700">
          <CircleCheck className="size-8" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-medium sm:text-3xl">Gracias, {patient.first_name}.</h1>
        <p className="text-lg text-muted-foreground">
          Tu ficha de ingreso le llegó a {identity.professional_name}. La va a leer antes de la sesión. Si querés cambiar algo, la encontrás en Mi perfil.
        </p>
        <p className="text-sm text-muted-foreground">
          Tené en cuenta que no la lee en el momento. Si antes de la sesión te sentís en peligro o pensás en hacerte daño, no esperes: en{" "}
          <Link href="/app/calmarme" className="font-medium text-primary underline underline-offset-2">Calmarme</Link> tenés a quién llamar.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Button asChild size="lg">
            <Link href="/app">Ir al inicio</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app/ingreso">Ver mi ficha</Link>
          </Button>
        </div>
      </div>
    );
  }

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
        initialAnswers={initialAnswers}
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
