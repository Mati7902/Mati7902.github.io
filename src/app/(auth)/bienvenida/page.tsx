import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { PasswordForm } from "@/components/auth/password-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPublicSettingsSafe } from "@/server/services/public-settings";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "Bienvenida", robots: { index: false } };

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { "site.identity": identity } = await getPublicSettingsSafe();

  if (!user) {
    return (
      <AuthCard title="La invitación no es válida" subtitle="Puede haber expirado. Pedile al profesional que te envíe una nueva.">
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Ir al inicio de sesión</Link>
        </Button>
      </AuthCard>
    );
  }

  const [{ data: profile }, treatment] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    getSetting(supabase, "treatment_consent"),
  ]);
  const name = profile?.first_name ? `, ${profile.first_name}` : "";

  return (
    <AuthCard
      title={`Bienvenido/a${name}`}
      subtitle={`Este es tu espacio privado en ${identity.platform_name}. Para empezar, creá tu contraseña; después vas a ${treatment.enabled ? "leer el consentimiento informado y completar" : "completar"} tu ficha de ingreso.`}
    >
      <PasswordForm mode="invitation" />
    </AuthCard>
  );
}
