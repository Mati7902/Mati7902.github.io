import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExerciseRunner } from "@/components/exercises/exercise-runner";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { parseSteps } from "@/lib/exercises/steps";
import { createClient } from "@/lib/supabase/server";
import { getExerciseTemplateBySlug } from "@/server/services/exercises";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  return { title: template?.title ?? "Calmarme" };
}

export default async function CalmExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePatient();
  const { slug } = await params;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  if (!template || !["grounding", "mindful_pause"].includes(template.kind)) notFound();
  const steps = parseSteps(template.steps);
  if (steps.length === 0) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Calmarme" title={template.title} description={template.description ?? undefined} />
      <ExerciseRunner templateId={template.id} title={template.title} steps={steps} returnTo="/app/calmarme" />
    </div>
  );
}
