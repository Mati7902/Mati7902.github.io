import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

const ERROR_MESSAGES: Record<string, string> = {
  "enlace-invalido": "El enlace que usaste expiró o ya fue utilizado. Podés pedir uno nuevo desde “Olvidé mi contraseña”.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Bienvenido/a" subtitle="Un espacio seguro para acompañar tu proceso.">
      <LoginForm next={next} initialError={error ? ERROR_MESSAGES[error] ?? null : null} />
    </AuthCard>
  );
}
