import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ConsentForm } from "@/components/auth/consent-form";
import { requirePatient } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Actualización de términos", robots: { index: false } };

export default async function ConsentPage() {
  const session = await requirePatient();
  return (
    <AuthCard
      title={`Hola, ${session.patient.first_name}`}
      subtitle="Actualizamos los términos de uso o la política de privacidad. Antes de seguir, revisalos y confirmá que estás de acuerdo."
    >
      <ConsentForm />
    </AuthCard>
  );
}
