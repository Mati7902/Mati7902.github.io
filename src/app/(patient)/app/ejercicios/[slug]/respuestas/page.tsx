import type { Metadata } from "next";
import { ArrowLeft, NotebookPen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { exerciseHref } from "@/components/exercises/exercise-card";
import { ExerciseResponseList } from "@/components/exercises/exercise-response-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { answerEntries, parseSteps } from "@/lib/exercises/steps";
import { createClient } from "@/lib/supabase/server";
import { getExerciseTemplateBySlug, listResponsesForTemplate } from "@/server/services/exercises";

export const metadata: Metadata = { title: "Mis respuestas" };

export default async function ExerciseResponsesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { patient } = await requirePatient();
  const { slug } = await params;
  const supabase = await createClient();
  const template = await getExerciseTemplateBySlug(supabase, slug);
  if (!template) notFound();
  const steps = parseSteps(template.steps);
  const responses = await listResponsesForTemplate(supabase, patient.id, template.id);
  const href = exerciseHref(template);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={href}>
          <ArrowLeft aria-hidden /> {template.title}
        </Link>
      </Button>
      <PageHeader
        eyebrow="Mis respuestas"
        title={template.title}
        description={
          patient.share_records_with_professional
            ? "Lo que escribiste cada vez que hiciste este ejercicio. Tu psicólogo también lo puede ver, porque compartís tus registros (lo cambiás en tu perfil)."
            : "Lo que escribiste cada vez que hiciste este ejercicio. Solo lo ves vos: no estás compartiendo tus registros con tu psicólogo."
        }
      />
      {responses.length > 0 ? (
        <ExerciseResponseList
          canDelete
          responses={responses.map((r) => ({
            id: r.id,
            completedAt: r.completed_at,
            entries: answerEntries(steps, (r.answers ?? {}) as Record<string, unknown>),
            emotionBefore: r.emotion_before,
            emotionAfter: r.emotion_after,
          }))}
        />
      ) : (
        <EmptyState icon={NotebookPen} title="Todavía no hay respuestas" description="Cuando termines el ejercicio, lo que escribas va a quedar guardado acá." />
      )}
      {template.is_active ? (
        <Button asChild>
          <Link href={href}>{responses.length > 0 ? "Hacerlo de nuevo" : "Hacer el ejercicio"}</Link>
        </Button>
      ) : null}
    </div>
  );
}
