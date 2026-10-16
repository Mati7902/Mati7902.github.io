import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";

import { ConsentDocument } from "@/components/consent/consent-document";
import { ConsentSignForm } from "@/components/consent/consent-sign-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { consentParams, renderConsent, signsAsMinor } from "@/lib/consent/treatment";
import { formatShortDate } from "@/lib/dates";
import { ageFrom } from "@/lib/exercises/collections";
import { createClient } from "@/lib/supabase/server";
import { commitmentProgress, getLatestConsent, signedConsentText } from "@/server/services/consent";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Consentimiento informado" };

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [settings, latest, params] = await Promise.all([
    getSettings(supabase, ["treatment_consent", "site.identity", "scheduling"] as const),
    getLatestConsent(supabase, patient.id),
    searchParams,
  ]);
  const consent = settings.treatment_consent;
  const identity = settings["site.identity"];
  if (!consent.enabled && !latest) redirect("/app");

  const upToDate = latest !== null && latest.version === consent.version;
  // Ya firmado (o el profesional lo desactivó): se muestra lo que firmó, tal como quedó.
  if (latest && (upToDate || !consent.enabled)) {
    const { done, target } = await commitmentProgress(supabase, patient, latest, settings.scheduling.timezone);
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader eyebrow="Mi cuenta" title="Consentimiento informado" description={`Lo firmaste el ${formatShortDate(latest.accepted_at)}.`} />
        <p className="rounded-2xl bg-mint-50 px-5 py-4 text-sm text-mint-700">
          {done >= target
            ? `Completaste las ${target} sesiones del compromiso inicial. Con ${identity.professional_name} revisan cómo seguir.`
            : `Llevás ${done} de las ${target} sesiones del compromiso inicial.`}
        </p>
        <ConsentDocument
          title={latest.title}
          text={signedConsentText(latest)}
          signature={{ name: latest.signed_name, guardian: latest.guardian_name, date: formatShortDate(latest.accepted_at), version: latest.version }}
        />
        <Button asChild variant="outline">
          <Link href="/app/perfil">Volver a mi perfil</Link>
        </Button>
      </div>
    );
  }

  const age = ageFrom(patient.birth_date);
  const text = renderConsent(consent.body, consentParams(identity, settings.scheduling, consent.sessions));
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={params.bienvenida === "1" ? "Antes de empezar" : "Mi cuenta"}
        title="Consentimiento informado"
        description={`Antes de empezar, leé cómo es el tratamiento y el compromiso de asistir a las primeras ${consent.sessions} sesiones.`}
      />
      {latest ? (
        <Alert variant="info">
          <Info aria-hidden />
          <AlertTitle>Actualizamos el consentimiento</AlertTitle>
          <AlertDescription>
            <p>
              Firmaste la versión {latest.version} el {formatShortDate(latest.accepted_at)}. Leé la versión vigente y firmala de nuevo.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      <ConsentDocument title={consent.title} text={text} />
      <ConsentSignForm
        version={consent.version}
        sessions={consent.sessions}
        professionalName={identity.professional_name}
        defaultName={`${patient.first_name} ${patient.last_name}`}
        minor={signsAsMinor(age, patient.guardian_name)}
        askBirthDate={!patient.birth_date}
        defaultGuardian={patient.guardian_name}
        welcome={params.bienvenida === "1"}
      />
    </div>
  );
}
