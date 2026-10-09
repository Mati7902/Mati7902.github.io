import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ExerciseTemplate } from "@/types/domain";

export const APPROACH_LABEL: Record<ExerciseTemplate["approach"], string> = {
  tcc: "TCC",
  act: "ACT",
  dbt: "DBT",
  regulacion: "Regulación",
  general: "General",
};

export function exerciseHref(template: Pick<ExerciseTemplate, "slug" | "kind">): string {
  switch (template.kind) {
    case "breathing":
      return `/app/calmarme/respiracion/${template.slug}`;
    case "grounding":
    case "mindful_pause":
      return `/app/calmarme/${template.slug}`;
    default:
      return `/app/ejercicios/${template.slug}`;
  }
}

export function ExerciseCard({ template, note, done, href }: { template: ExerciseTemplate; note?: string | null; done?: boolean; href?: string }) {
  return (
    <Link
      href={href ?? exerciseHref(template)}
      className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-medium leading-snug">{template.title}</h3>
          <Badge variant="muted">{APPROACH_LABEL[template.approach]}</Badge>
          {done ? <Badge variant="success">Hecho</Badge> : null}
        </div>
        {template.description ? <p className="text-sm text-muted-foreground">{template.description}</p> : null}
        {note ? <p className="rounded-xl bg-mint-50 px-3 py-2 text-sm text-mint-700">Nota: {note}</p> : null}
        {template.estimated_minutes ? (
          <p className="flex items-center gap-1 text-xs text-subtle-foreground">
            <Clock className="size-3.5" aria-hidden /> ~{template.estimated_minutes} min
          </p>
        ) : null}
      </div>
      <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
