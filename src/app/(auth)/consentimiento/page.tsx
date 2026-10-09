import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ConsentForm } from "@/components/auth/consent-form";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { getRequiredConsentVersion, needsConsent, requirePatient } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Actualización de términos", robots: { index: false } };

export default async function ConsentPage() {
  const session = await requirePatient({ allowPendingConsent: true });
  if (!needsConsent(session.patient, await getRequiredConsentVersion())) redirect("/app");
  return (
    <AuthCard
      title={`Hola, ${session.patient.first_name}`}
      subtitle="Actualizamos los términos de uso o la política de privacidad. Antes de seguir, revisalos y confirmá que estás de acuerdo."
    >
      <div className="space-y-3">
        <ConsentForm />
        {/* Quien no quiere aceptar ahora (o usa un dispositivo compartido) tiene que poder salir. */}
        <SignOutButton className="w-full" variant="ghost" />
      </div>
    </AuthCard>
  );
}
