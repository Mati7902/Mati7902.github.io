import type { Metadata } from "next";

import { ExerciseToggle } from "@/components/admin/exercises/exercise-toggle";
import { APPROACH_LABEL } from "@/components/exercises/exercise-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { daysAgo } from "@/lib/dates";
import { AUDIENCE_LABEL, type Audience, COLLECTIONS } from "@/lib/exercises/collections";
import { createClient } from "@/lib/supabase/server";
import { listExerciseTemplates } from "@/server/services/exercises";

export const metadata: Metadata = { title: "Ejercicios" };

const KIND_LABEL: Record<string, string> = {
  thought_record: "Registro cognitivo",
  values: "Valores",
  committed_action: "Acción comprometida",
  defusion: "Defusión",
  dbt_skill: "Habilidad DBT",
  breathing: "Respiración",
  grounding: "Grounding",
  mindful_pause: "Pausa consciente",
  custom: "Personalizado",
};

export default async function AdminExercisesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [templates, { data: usage }] = await Promise.all([
    listExerciseTemplates(supabase, true),
    supabase.from("exercise_responses").select("template_id").gte("completed_at", daysAgo(30).toISOString()),
  ]);
  const usageMap = new Map<string, number>();
  for (const u of usage ?? []) usageMap.set(u.template_id, (usageMap.get(u.template_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Entre sesiones" title="Ejercicios" description="Ejercicios interactivos disponibles para los pacientes. Cada paciente ve los de su edad (Brújula hasta los 18 años, el cuadernillo de TCC desde los 18; sin fecha de nacimiento cargada, el de adultos) y siempre los que le sugieras desde su ficha. Podés ocultar los que no quieras ofrecer." />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Ejercicio</th>
              <th className="hidden px-4 py-3 md:table-cell">Enfoque</th>
              <th className="hidden px-4 py-3 sm:table-cell">Para</th>
              <th className="hidden px-4 py-3 lg:table-cell">Tipo</th>
              <th className="hidden px-4 py-3 md:table-cell">Usos (30 días)</th>
              <th className="px-4 py-3 text-right">Visible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{t.title}</p>
                  {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Badge variant="muted">{APPROACH_LABEL[t.approach]}</Badge>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p className="text-sm">{AUDIENCE_LABEL[t.audience as Audience] ?? t.audience}</p>
                  {t.collection && COLLECTIONS[t.collection] ? <p className="text-xs text-muted-foreground">{COLLECTIONS[t.collection]!.title}</p> : null}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{usageMap.get(t.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <ExerciseToggle id={t.id} active={t.is_active} title={t.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Los usos son conteos agregados sin contenido: no se muestran respuestas individuales en esta pantalla.</p>
    </div>
  );
}
