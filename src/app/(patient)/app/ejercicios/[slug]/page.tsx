import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { APPROACH_LABEL, exerciseHref } from "@/components/exercises/exercise-card";
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
  return { title: template?.title ?? "Ejercicio" };
}

export default async function ExercisePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ asignacion?: string }> }) {
  const { patient } = await requirePatient();
  const { slug } = await params;
  const { asignacion } = await searchParams;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  if (!template || !template.is_active) notFound();
  if (["breathing", "grounding", "mindful_pause"].includes(template.kind)) redirect(exerciseHref(template));
  const steps = parseSteps(template.steps);
  if (steps.length === 0) notFound();

  let assignmentId: string | null = null;
  if (asignacion) {
    const { data } = await supabase.from("exercise_assignments").select("id").eq("id", asignacion).eq("patient_id", patient.id).maybeSingle();
    assignmentId = data?.id ?? null;
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={APPROACH_LABEL[template.approach]} title={template.title} description={template.description ?? undefined} />
      <ExerciseRunner templateId={template.id} title={template.title} steps={steps} assignmentId={assignmentId} />
    </div>
  );
}
