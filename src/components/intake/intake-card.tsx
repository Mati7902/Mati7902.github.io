import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { INTAKE_INPUT_COUNT } from "@/lib/intake/form";

/** Recordatorio en el inicio mientras la ficha de ingreso no se envió. */
export function IntakeCard({ answered, started, professionalName }: { answered: number; started: boolean; professionalName: string }) {
  return (
    <section aria-labelledby="ficha-ingreso-card" className="rounded-3xl border border-primary/15 bg-primary-soft/50 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-[var(--shadow-card)]">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 id="ficha-ingreso-card" className="font-display text-xl font-medium">
              {started ? "Seguí con tu ficha de ingreso" : "Completá tu ficha de ingreso"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Preguntas sobre vos, tu salud y lo que te trae a consulta. La lee solo {professionalName} antes de la sesión. Podés hacerla en partes.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/app/ingreso">
            {started ? "Seguir" : "Completar"} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      {started ? (
        <div className="mt-5 space-y-1.5">
          <Progress value={(answered / INTAKE_INPUT_COUNT) * 100} aria-label={`${answered} de ${INTAKE_INPUT_COUNT} preguntas respondidas`} />
          <p className="text-xs text-muted-foreground">
            {answered} de {INTAKE_INPUT_COUNT} preguntas respondidas
          </p>
        </div>
      ) : null}
    </section>
  );
}
