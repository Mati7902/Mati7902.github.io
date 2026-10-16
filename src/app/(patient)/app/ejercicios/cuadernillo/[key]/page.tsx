import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExerciseCard } from "@/components/exercises/exercise-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { requirePatient } from "@/lib/auth/session";
import { ageFrom, audiencesFor, COLLECTIONS, groupByParts, visibleTemplates } from "@/lib/exercises/collections";
import { createClient } from "@/lib/supabase/server";
import { listExerciseTemplates, listPatientAssignments, listPatientResponses } from "@/server/services/exercises";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: COLLECTIONS[key]?.title ?? "Cuadernillo" };
}

export default async function CollectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { patient } = await requirePatient();
  const { key } = await params;
  const info = COLLECTIONS[key];
  if (!info) notFound();
  const supabase = await createClient();
  const [templates, assignments, responses] = await Promise.all([
    listExerciseTemplates(supabase),
    listPatientAssignments(supabase, patient.id),
    listPatientResponses(supabase, patient.id, 500),
  ]);
  const assignedIds = new Set(assignments.map((a) => a.template_id));
  const items = visibleTemplates(
    templates.filter((t) => t.collection === key),
    audiencesFor(ageFrom(patient.birth_date)),
    assignedIds,
  );
  if (items.length === 0) notFound();
  const doneIds = new Set(responses.map((r) => r.template_id));
  const done = items.filter((t) => doneIds.has(t.id)).length;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/app/ejercicios">
          <ArrowLeft aria-hidden /> Ejercicios
        </Link>
      </Button>
      <PageHeader eyebrow="Cuadernillo" title={info.title} description={info.description} />
      <div className="space-y-1.5">
        <Progress value={(done / items.length) * 100} aria-label={`${done} de ${items.length} hechos`} />
        <p className="text-xs text-muted-foreground">
          {done} de {items.length} hechos · Las respuestas de cada uno quedan guardadas en «Mis respuestas».
        </p>
      </div>
      {groupByParts(key, items).map((group) => (
        <section key={group.title ?? "otros"} className="space-y-3">
          {group.title ? <h2 className="font-display text-xl font-medium">{group.title}</h2> : null}
          <div className="grid gap-3">
            {group.items.map((t) => (
              <ExerciseCard key={t.id} template={t} done={doneIds.has(t.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
