import { Check } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { TherapyPlan } from "@/types/domain";

type Props = {
  plan: TherapyPlan;
  /** Destino del CTA. Por defecto el flujo público de solicitud de turno. */
  bookHref?: string;
  consultHref?: string;
  className?: string;
};

export function PlanCard({ plan, bookHref = "/app/agenda/nuevo", consultHref = "/#contacto", className }: Props) {
  const isConsult = plan.cta_type === "consult" || plan.price_amount === null;
  const href = isConsult ? consultHref : `${bookHref}?plan=${plan.slug}`;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col gap-6 rounded-3xl border bg-card p-7 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-soft)]",
        plan.is_featured ? "border-primary/40 ring-1 ring-primary/20" : "border-border/70",
        className,
      )}
    >
      {plan.is_featured ? (
        <Badge variant="soft" className="absolute top-5 right-5">
          Recomendado
        </Badge>
      ) : null}
      <header className="space-y-2">
        <h3 className="font-display text-2xl font-medium">{plan.name}</h3>
        {plan.short_description ? <p className="text-sm text-muted-foreground">{plan.short_description}</p> : null}
      </header>
      <div>
        <p className="font-display text-3xl font-medium text-primary">{formatCurrency(plan.price_amount, plan.currency)}</p>
        <p className="text-sm text-muted-foreground">
          {plan.duration_minutes ? `${plan.duration_minutes} minutos` : null}
          {plan.duration_minutes && plan.sessions_included && plan.sessions_included > 1 ? " · " : null}
          {plan.sessions_included && plan.sessions_included > 1 ? `${plan.sessions_included} sesiones` : null}
        </p>
      </div>
      {plan.features.length > 0 ? (
        <ul className="flex-1 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-mint-700">
                <Check className="size-3" aria-hidden />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1" />
      )}
      <Button asChild size="lg" variant={plan.is_featured ? "default" : "outline"} className="w-full">
        <Link href={href}>{plan.cta_label || (isConsult ? "Consultar" : "Solicitar turno")}</Link>
      </Button>
    </article>
  );
}
