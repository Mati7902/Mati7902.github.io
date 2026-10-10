import Link from "next/link";
import { AlertTriangle, Pencil } from "lucide-react";

import { formatIntakeAnswer, INTAKE_SECTIONS, INTAKE_STEPS, INTAKE_TITLE, type IntakeAnswers, type IntakeQuestion, needsAttention, questionLabel } from "@/lib/intake/form";
import { cn } from "@/lib/utils";

type Props = {
  answers: IntakeAnswers;
  audience: "patient" | "professional";
  /** Fecha de referencia para calcular la edad (aaaa-mm-dd). */
  todayKey?: string;
  /** Vista del paciente: enlace para editar cada parte (recibe el índice de la parte). */
  editHref?: (stepIndex: number) => string;
  className?: string;
};

/**
 * La ficha de ingreso con el formato del cuestionario original: secciones con números romanos,
 * ítems numerados (o con guion en la historia clínica) y la respuesta al lado.
 */
export function IntakeAnswers({ answers, audience, todayKey, editHref, className }: Props) {
  return (
    <article className={cn("space-y-8", className)}>
      {audience === "professional" ? <p className="font-display text-xl font-medium text-foreground print:text-lg">{INTAKE_TITLE}</p> : null}
      {INTAKE_SECTIONS.map((section) => {
        const steps = INTAKE_STEPS.map((step, index) => ({ step, index })).filter(({ step }) => step.section === section.key);
        return (
          <section key={section.key} aria-labelledby={`ficha-${section.key}`} className="space-y-4 break-inside-avoid-page">
            <h2 id={`ficha-${section.key}`} className="border-b border-divider pb-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              {section.roman}. {section.title}
            </h2>
            {steps.map(({ step, index }) => (
              <div key={step.id} className="space-y-2">
                {step.heading || editHref ? (
                  <div className="flex items-center justify-between gap-3">
                    {step.heading ? <h3 className="font-medium text-foreground">{step.heading}:</h3> : <span />}
                    {editHref ? (
                      <Link href={editHref(index)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft print:hidden">
                        <Pencil className="size-3.5" aria-hidden /> Editar<span className="sr-only"> {step.title}</span>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                <ol className="divide-y divide-divider/70 rounded-2xl border border-border/70 bg-card print:rounded-none print:border-0 print:bg-transparent">
                  {step.questions.map((q, i) => (
                    <Item key={q.id} question={q} marker={step.itemStyle === "dash" ? "–" : `${i + 1}.`} answers={answers} audience={audience} todayKey={todayKey} />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </article>
  );
}

function Item({ question, marker, answers, audience, todayKey }: { question: IntakeQuestion; marker: string; answers: IntakeAnswers; audience: "patient" | "professional"; todayKey?: string }) {
  const answer = formatIntakeAnswer(question, answers, todayKey);
  const flag = audience === "professional" && needsAttention(question, answers);
  return (
    <li className={cn("grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4 print:px-0 print:py-1.5", flag && "bg-warning-soft/50")}>
      <p className="text-sm text-muted-foreground">
        <span aria-hidden className="mr-1.5 tabular-nums text-subtle-foreground">{marker}</span>
        {questionLabel(question, audience)}
        {flag ? (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#7a5614]">
            <AlertTriangle className="size-3.5" aria-hidden /> Tema sensible: revisalo antes de la sesión
          </span>
        ) : null}
      </p>
      <p className={cn("min-w-0 text-sm break-words whitespace-pre-line", answer === null ? "text-subtle-foreground italic" : "text-foreground")}>
        {answer ?? (question.type === "age" ? "Falta la fecha de nacimiento" : "Sin responder")}
      </p>
    </li>
  );
}
