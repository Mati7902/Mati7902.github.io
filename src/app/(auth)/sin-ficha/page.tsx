import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/shell/sign-out-button";

export const metadata: Metadata = { title: "Cuenta sin ficha", robots: { index: false } };

export default function NoPatientRecordPage() {
  return (
    <AuthCard
      title="Tu cuenta todavía no está vinculada"
      subtitle="Iniciaste sesión correctamente, pero no encontramos una ficha de paciente asociada a tu email. Escribile al profesional para que la vincule."
    >
      <SignOutButton className="w-full" variant="outline" />
    </AuthCard>
  );
}
