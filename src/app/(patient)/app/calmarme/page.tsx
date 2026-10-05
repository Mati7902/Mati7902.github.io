import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Wind } from "lucide-react";

import { CrisisBanner } from "@/components/calm/crisis-banner";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveEmergencyResources } from "@/server/services/public-content";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const metadata: Metadata = { title: "Calmarme" };

export default async function CalmPage() {
  await requirePatient();
  const supabase = await createClient();
  const [{ data: templates }, resources, settings] = await Promise.all([
    supabase.from("exercise_templates").select("*").in("kind", ["breathing", "grounding", "mindful_pause"]).eq("is_active", true).order("sort_order"),
    getActiveEmergencyResources(),
    getPublicSettingsSafe(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Regulación emocional" title="Calmarme" description="Elegí un ejercicio corto. No hace falta hacerlo perfecto: alcanza con empezar." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((t) => {
          const href = t.kind === "breathing" ? `/app/calmarme/respiracion/${t.slug}` : `/app/calmarme/${t.slug}`;
          return (
            <li key={t.id}>
              <Link href={href} className="group flex h-full items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-700">
                  <Wind className="size-5" aria-hidden />
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
      <p className="text-sm text-muted-foreground">Estos ejercicios son un apoyo entre sesiones. No reemplazan el tratamiento ni la atención profesional.</p>
      <CrisisBanner settings={settings.emergency} resources={resources} professionalWhatsApp={settings["site.identity"].whatsapp} />
    </div>
  );
}
