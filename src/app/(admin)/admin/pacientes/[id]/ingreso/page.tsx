import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { IntakeAnswers } from "@/components/intake/intake-answers";
import { PrintButton } from "@/components/intake/print-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/server/services/audit";
import { getIntake, intakeAnswersOf } from "@/server/services/intake";
import { getPatientById } from "@/server/services/patients";

export const metadata: Metadata = { title: "Ficha de ingreso", robots: { index: false } };

export default async function AdminIntakePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const patient = await getPatientById(supabase, id);
  if (!patient) notFound();
  // RLS: el profesional solo recibe la ficha si el paciente ya la envió (el borrador es privado).
  const intake = await getIntake(supabase, patient.id);
  const name = `${patient.first_name} ${patient.last_name}`;

  const back = (
    <Button asChild variant="ghost" className="print:hidden">
      <Link href={`/admin/pacientes/${patient.id}`}>
        <ArrowLeft aria-hidden /> Volver a la ficha
      </Link>
    </Button>
  );

  if (!intake?.submitted_at) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Ficha de ingreso" title={name} actions={back} />
        <EmptyState
          icon={ClipboardList}
          title="Todavía no la envió"
          description={
            patient.profile_id
              ? "El paciente la completa desde su cuenta. Mientras no la envíe, lo que escribe es un borrador privado."
              : "La completa el paciente cuando crea su cuenta. Invitalo desde su ficha para que pueda hacerlo."
          }
        />
      </div>
    );
  }

  // Lectura de datos de salud: queda registrada (sin contenido).
  await audit(supabase, "patient.intake_viewed", { type: "patient", id: patient.id });
  const first = intake.first_submitted_at ?? intake.submitted_at;
  const details = [
    `Enviada el ${formatShortDate(first)}`,
    intake.submitted_at !== first ? `actualizada el ${formatShortDate(intake.submitted_at)}` : null,
    intake.updated_at > intake.submitted_at ? `último cambio el ${formatShortDate(intake.updated_at)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ficha de ingreso"
        title={name}
        description={`${details.join(" · ")}. Respuestas del paciente, con sus palabras.`}
        actions={
          <>
            {back}
            <PrintButton />
          </>
        }
      />
      <IntakeAnswers answers={intakeAnswersOf(intake)} audience="professional" className="max-w-4xl" />
      {/* Solo en papel: pie de cada hoja con el paciente, para que ninguna quede sin identificar. */}
      <style>{`@media print { @page { @bottom-center { content: ${cssString(`Ficha de ingreso · ${name} · enviada el ${formatShortDate(first)} · Confidencial`)}; font-size: 9px; color: #555; } } }`}</style>
      <p className="max-w-4xl text-xs text-muted-foreground print:hidden">
        Solo vos (y quien tenga rol de profesional o administrador) ve esta ficha. Recepción no tiene acceso y la secretaria virtual de WhatsApp no la usa.
      </p>
    </div>
  );
}

/** Texto como cadena CSS segura (sin cerrar la etiqueta <style> ni la cadena). */
function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, "\\$&").replace(/[<>\r\n]/g, " ")}"`;
}
