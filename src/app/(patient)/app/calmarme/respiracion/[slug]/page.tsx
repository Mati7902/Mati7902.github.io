import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreathingSession } from "@/components/calm/breathing-session";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { parseBreathingConfig } from "@/lib/exercises/steps";
import { createClient } from "@/lib/supabase/server";
import { getExerciseTemplateBySlug } from "@/server/services/exercises";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  return { title: template?.title ?? "Respiración" };
}

export default async function BreathingPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePatient();
  const { slug } = await params;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  if (!template || template.kind !== "breathing") notFound();
  const config = parseBreathingConfig(template.steps);
  if (!config) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Calmarme" title={template.title} description={template.description ?? undefined} />
      <BreathingSession templateId={template.id} title={template.title} config={config} />
      <p className="text-center text-xs text-muted-foreground">Si sentís mareo, volvé a tu ritmo natural. Este ejercicio no sustituye el tratamiento profesional.</p>
    </div>
  );
}
