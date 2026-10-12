import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSignature } from "lucide-react";

import { ConsentDocument } from "@/components/consent/consent-document";
import { PrintButton } from "@/components/intake/print-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/dates";
import { printFooterCss } from "@/lib/print";
import { createClient } from "@/lib/supabase/server";
import { listConsents, sessionsSince, signedConsentText } from "@/server/services/consent";
import { getPatientById } from "@/server/services/patients";

export const metadata: Metadata = { title: "Consentimiento informado", robots: { index: false } };

export default async function AdminConsentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const patient = await getPatientById(supabase, id);
  if (!patient) notFound();
  const consents = await listConsents(supabase, patient.id);
  const name = `${patient.first_name} ${patient.last_name}`;
  const back = (
    <Button asChild variant="ghost" className="print:hidden">
      <Link href={`/admin/pacientes/${patient.id}`}>
        <ArrowLeft aria-hidden /> Volver a la ficha
      </Link>
    </Button>
  );

  const [latest, ...previous] = consents;
  if (!latest) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Consentimiento informado" title={name} actions={back} />
        <EmptyState icon={FileSignature} title="Todavía no lo firmó" description="El paciente lo lee y lo firma desde su cuenta, antes de la ficha de ingreso." />
      </div>
    );
  }

  const done = await sessionsSince(supabase, patient.id, latest.accepted_at);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Consentimiento informado"
        title={name}
        description={`Firmado el ${formatShortDate(latest.accepted_at)} · Compromiso: ${Math.min(done, latest.sessions)} de ${latest.sessions} sesiones realizadas.`}
        actions={
          <>
            {back}
            <PrintButton />
          </>
        }
      />
      {latest.is_minor ? (
        <p className="max-w-3xl rounded-2xl bg-warning-soft/60 px-5 py-4 text-sm text-foreground print:hidden">
          Lo firmó siendo menor de edad, con el nombre de quien lo autoriza. Confirmá esa autorización con su madre, padre o tutor (por ejemplo, en la primera sesión).
        </p>
      ) : null}
      <ConsentDocument
        className="max-w-3xl"
        title={latest.title}
        text={signedConsentText(latest)}
        signature={{ name: latest.signed_name, guardian: latest.guardian_name, date: formatShortDate(latest.accepted_at), version: latest.version }}
      />
      {previous.length > 0 ? (
        <details className="max-w-3xl rounded-2xl border border-border/70 bg-card px-5 py-3 text-sm print:hidden">
          <summary className="cursor-pointer font-medium">Versiones firmadas antes ({previous.length})</summary>
          <ul className="mt-3 divide-y divide-divider">
            {previous.map((c) => (
              <li key={c.id} className="py-2 text-muted-foreground">
                Versión {c.version}, firmada el {formatShortDate(c.accepted_at)} por {c.signed_name}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <style>{printFooterCss(`Consentimiento informado · ${name} · firmado el ${formatShortDate(latest.accepted_at)}`)}</style>
    </div>
  );
}
