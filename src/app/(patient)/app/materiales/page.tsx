import type { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";

import { MaterialCard } from "@/components/materials/material-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { ageFrom, audiencesFor } from "@/lib/exercises/collections";
import { createClient } from "@/lib/supabase/server";
import { getPatientMaterials } from "@/server/services/materials";

export const metadata: Metadata = { title: "Materiales" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { patient } = await requirePatient();
  const { categoria } = await searchParams;
  const supabase = await createClient();
  const materials = await getPatientMaterials(supabase, patient.id, audiencesFor(ageFrom(patient.birth_date)));
  const recommended = materials.filter((m) => m.recommended);
  const categories = Array.from(new Map(materials.filter((m) => m.material_categories).map((m) => [m.material_categories!.slug, m.material_categories!])).values());
  const rest = materials.filter((m) => !m.recommended && (!categoria || m.material_categories?.slug === categoria));

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Biblioteca" title="Materiales" description="Lecturas, audios y ejercicios para acompañar tu proceso." />

      {materials.length === 0 ? (
        <EmptyState icon={Library} title="Todavía no hay materiales" description="Tu psicólogo puede compartirte lecturas, audios y ejercicios. Aparecerán acá." />
      ) : (
        <>
          {recommended.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-medium">Material recomendado para vos</h2>
              <div className="grid gap-3">
                {recommended.map((m) => (
                  <MaterialCard key={m.id} material={m} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-medium">Biblioteca</h2>
            </div>
            {categories.length > 1 ? (
              <nav aria-label="Filtrar por categoría" className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <CategoryChip href="/app/materiales" label="Todo" active={!categoria} />
                {categories.map((c) => (
                  <CategoryChip key={c.slug} href={`/app/materiales?categoria=${c.slug}`} label={c.name} active={categoria === c.slug} />
                ))}
              </nav>
            ) : null}
            {rest.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay materiales en esta categoría.</p>
            ) : (
              <div className="grid gap-3">
                {rest.map((m) => (
                  <MaterialCard key={m.id} material={m} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-surface-muted"}`}
    >
      {label}
    </Link>
  );
}
