import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Hand, Hourglass, Square, Wind, type LucideIcon } from "lucide-react";

import { CrisisBanner } from "@/components/calm/crisis-banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { formatCompactDate } from "@/lib/dates";
import { ageFrom, audiencesFor, isForAudience, PLAN_SLUG } from "@/lib/exercises/collections";
import { createClient } from "@/lib/supabase/server";
import { getActiveEmergencyResources } from "@/server/services/public-content";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const metadata: Metadata = { title: "Calmarme" };

/** Ícono por ejercicio: ayuda a reconocerlos de un vistazo en momentos de malestar. */
function iconFor(kind: string, slug: string): LucideIcon {
  if (kind === "grounding") return Hand;
  if (kind === "mindful_pause") return Hourglass;
  if (slug.includes("cuadrada")) return Square;
  return Wind;
}

/**
 * "Mi plan para momentos muy difíciles": si el paciente ya lo armó, arriba de todo para
 * encontrarlo rápido; si todavía no y el ejercicio es para su edad, una invitación a armarlo.
 */
function PlanCard({ savedAt, slug, canEdit = true }: { savedAt: string | null; slug: string; canEdit?: boolean }) {
  return (
    <section aria-label="Mi plan para momentos muy difíciles" className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary-soft/60 p-5 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
        <Compass className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-display text-lg font-medium">Mi plan para momentos muy difíciles</h2>
        <p className="text-sm text-muted-foreground">
          {savedAt
            ? `Lo armaste el ${formatCompactDate(savedAt)}. Abrilo cuando lo necesites: tus señales, qué hacer y a quién llamar.`
            : "Un plan para ganar tiempo y conectar con ayuda. Podés armarlo con tu psicólogo/a."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {savedAt ? (
          <>
            <Button asChild>
              <Link href={`/app/ejercicios/${slug}/respuestas`}>Ver mi plan</Link>
            </Button>
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/app/ejercicios/${slug}`}>Actualizarlo</Link>
              </Button>
            ) : null}
          </>
        ) : (
          <Button asChild variant="outline">
            <Link href={`/app/ejercicios/${slug}`}>Armar mi plan</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

export default async function CalmPage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [{ data: templates }, resources, settings, { data: plan }] = await Promise.all([
    supabase.from("exercise_templates").select("*").in("kind", ["breathing", "grounding", "mindful_pause"]).eq("is_active", true).order("sort_order"),
    getActiveEmergencyResources(),
    getPublicSettingsSafe(),
    supabase.from("exercise_templates").select("id, slug, audience, is_active").eq("slug", PLAN_SLUG).maybeSingle(),
  ]);
  const { data: lastPlan } = plan
    ? await supabase.from("exercise_responses").select("completed_at").eq("patient_id", patient.id).eq("template_id", plan.id).order("completed_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const savedAt = lastPlan?.completed_at ?? null;
  const { count: planAssigned } = plan
    ? await supabase.from("exercise_assignments").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("template_id", plan.id)
    : { count: 0 };
  // Se ofrece si es para su edad o si el profesional se lo sugirió (aunque la ficha no tenga fecha de nacimiento).
  const offerPlan = Boolean(plan?.is_active && (planAssigned || isForAudience(plan.audience, audiencesFor(ageFrom(patient.birth_date)))));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Regulación emocional" title="Calmarme" description="Elegí un ejercicio corto. No hace falta hacerlo perfecto: alcanza con empezar." />
      {plan && savedAt ? <PlanCard savedAt={savedAt} slug={plan.slug} canEdit={plan.is_active} /> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((t) => {
          const href = t.kind === "breathing" ? `/app/calmarme/respiracion/${t.slug}` : `/app/calmarme/${t.slug}`;
          const Icon = iconFor(t.kind, t.slug);
          return (
            <li key={t.id}>
              <Link href={href} className="group flex h-full items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-medium">{t.title}</span>
                  {t.description ? <span className="mt-1 block text-sm text-muted-foreground">{t.description}</span> : null}
                  {t.estimated_minutes ? <span className="mt-2 block text-xs text-subtle-foreground">~{t.estimated_minutes} min</span> : null}
                </span>
                <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {plan && !savedAt && offerPlan ? <PlanCard savedAt={null} slug={plan.slug} /> : null}
      <p className="text-sm text-muted-foreground">Estos ejercicios son un apoyo entre sesiones. No reemplazan el tratamiento ni la atención profesional.</p>
      <CrisisBanner settings={settings.emergency} resources={resources} professionalWhatsApp={settings["site.identity"].whatsapp} />
    </div>
  );
}
