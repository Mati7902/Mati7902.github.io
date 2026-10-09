import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RecoverPage() {
  return (
    <AuthCard title="Recuperar contraseña" subtitle="Tranquilo/a, pasa seguido. Te ayudamos a volver a entrar.">
      <PasswordResetRequestForm />
    </AuthCard>
  );
}
