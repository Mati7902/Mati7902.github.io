import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm, ContactForm, SharingToggle } from "@/components/patient/profile-forms";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { requirePatient } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/dates";
import { getInitials } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { patient, profile, email } = await requirePatient();
  const fullName = `${patient.first_name} ${patient.last_name}`;
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader eyebrow="Cuenta" title="Mi perfil" />
      <section className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-lg">{getInitials(fullName)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display text-2xl font-medium">{fullName}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="text-xs text-subtle-foreground">En proceso desde {formatShortDate(patient.admission_date)}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">Datos de contacto</h2>
        <ContactForm patient={patient} />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">Privacidad</h2>
        <SharingToggle initial={patient.share_records_with_professional} />
        <p className="text-xs text-muted-foreground">
          Leé la <Link href="/privacidad" className="underline underline-offset-2">política de privacidad</Link> y los{" "}
          <Link href="/terminos" className="underline underline-offset-2">términos de uso</Link>.
          {patient.consent_accepted_at ? ` Aceptaste el consentimiento el ${formatShortDate(patient.consent_accepted_at)}.` : ""}
        </p>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">Contraseña</h2>
        <ChangePasswordForm />
      </section>

      <Separator />

      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Cerrar sesión</p>
          <p className="text-sm text-muted-foreground">Vas a necesitar tu contraseña para volver a entrar.</p>
        </div>
        <SignOutButton variant="outline" />
      </section>
    </div>
  );
}
