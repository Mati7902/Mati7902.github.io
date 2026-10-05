import type { Metadata } from "next";
import Link from "next/link";

import { PlanCard } from "@/components/plans/plan-card";
import { Button } from "@/components/ui/button";
import { getActivePlans } from "@/server/services/public-content";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Planes de atención",
  description: "Consulta individual, plan mensual y otros servicios de atención psicológica. Precios claros y sin sorpresas.",
};

export default async function PlansPage() {
  const [plans, { "site.identity": identity }] = await Promise.all([getActivePlans(), getPublicSettingsSafe()]);
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Planes de atención</p>
        <h1 className="mt-3 font-display text-4xl font-medium sm:text-5xl">Opciones claras para tu proceso</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Cada plan incluye el acompañamiento del {identity.professional_name}. Si tenés dudas sobre cuál elegir, lo conversamos en la primera sesión.
        </p>
      </div>
      {plans.length > 0 ? (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} bookHref="/login" consultHref="/#solicitar-turno" />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-muted-foreground">Los planes se publican próximamente.</p>
      )}
      <div className="mt-14 rounded-3xl border border-border/70 bg-card p-8 text-center">
        <h2 className="font-display text-2xl font-medium">¿Primera vez?</h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">Escribime para coordinar la primera sesión. Si ya sos paciente, podés elegir un horario directamente desde tu espacio.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/#solicitar-turno">Solicitar turno</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Acceso pacientes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
