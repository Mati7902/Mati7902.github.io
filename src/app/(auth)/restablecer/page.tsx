import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { PasswordForm } from "@/components/auth/password-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthCard title="El enlace no es válido" subtitle="Puede haber expirado o ya haber sido usado.">
        <Button asChild className="w-full">
          <Link href="/recuperar">Pedir un enlace nuevo</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Creá una contraseña nueva" subtitle="Elegí una que puedas recordar y que no uses en otros sitios.">
      <PasswordForm mode="reset" />
    </AuthCard>
  );
}
