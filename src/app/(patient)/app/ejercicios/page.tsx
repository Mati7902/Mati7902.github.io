import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { APPROACH_LABEL, ExerciseCard, exerciseHref } from "@/components/exercises/exercise-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listExerciseTemplates, listPatientAssignments, listPatientResponses } from "@/server/services/exercises";
import type { ExerciseTemplate } from "@/types/domain";

export const metadata: Metadata = { title: "Ejercicios" };

const SECTIONS: { approach: ExerciseTemplate["approach"]; title: string; description: string }[] = [
  { approach: "tcc", title: "Ordenar mis pensamientos", description: "Registro cognitivo guiado, una pregunta por vez." },
  { approach: "act", title: "Lo que me importa", description: "Valores, acciones comprometidas y tomar distancia de los pensamientos." },
  { approach: "dbt", title: "Habilidades para momentos difíciles", description: "Herramientas breves para frenar, regular y comunicar." },
];

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ completado?: string }> }) {
  const { patient } = await requirePatient();
  const { completado } = await searchParams;
  const supabase = await createClient();
  const [templates, assignments, responses] = await Promise.all([
    listExerciseTemplates(supabase),
    listPatientAssignments(supabase, patient.id),
    listPatientResponses(supabase, patient.id, 100),
  ]);
  const pendingAssignments = assignments.filter((a) => !a.completed_at && a.exercise_templates);
  const doneTemplateIds = new Set(responses.map((r) => r.template_id));
  const wizardTemplates = templates.filter((t) => !["breathing", "grounding", "mindful_pause"].includes(t.kind));

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Entre sesiones" title="Ejercicios" description="Prácticas breves basadas en TCC, ACT y DBT. Elegí la que necesites hoy." />
      {completado ? (
        <Alert variant="success">
          <AlertDescription>Ejercicio guardado. Tomarte este tiempo ya es parte del trabajo.</AlertDescription>
        </Alert>
      ) : null}

      {pendingAssignments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Sugeridos por tu psicólogo</h2>
          <div className="grid gap-3">
            {pendingAssignments.map((a) => (
              <ExerciseCard key={a.id} template={a.exercise_templates!} note={a.note} href={`${exerciseHref(a.exercise_templates!)}?asignacion=${a.id}`} />
            ))}
          </div>
        </section>
      ) : null}

      {SECTIONS.map((section) => {
        const items = wizardTemplates.filter((t) => t.approach === section.approach);
        if (items.length === 0) return null;
        return (
          <section key={section.approach} className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-medium">{section.title}</h2>
              <p className="text-sm text-muted-foreground">
                {section.description} <span className="text-subtle-foreground">· {APPROACH_LABEL[section.approach]}</span>
              </p>
            </div>
            <div className="grid gap-3">
              {items.map((t) => (
                <ExerciseCard key={t.id} template={t} done={doneTemplateIds.has(t.id)} />
              ))}
            </div>
          </section>
        );
      })}

      {wizardTemplates.length === 0 ? <EmptyState icon={Sparkles} title="Todavía no hay ejercicios" description="Pronto vas a encontrar acá prácticas breves para hacer entre sesiones." /> : null}
    </div>
  );
}
