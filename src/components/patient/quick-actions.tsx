import { BookOpen, Brain, CalendarPlus, ClipboardList, Heart, Sparkles, Wind, type LucideIcon } from "lucide-react";
import Link from "next/link";

type Action = { href: string; label: string; icon: LucideIcon; tone: string };

const ACTIONS: Action[] = [
  { href: "/app/calmarme", label: "Calmarme", icon: Wind, tone: "bg-mint-100 text-mint-700" },
  { href: "/app/registro/nuevo", label: "Registrar cómo me siento", icon: Heart, tone: "bg-primary-soft text-primary" },
  { href: "/app/ejercicios/registro-pensamientos", label: "Ordenar mis pensamientos", icon: Brain, tone: "bg-info-soft text-[#2b5f80]" },
  { href: "/app/ejercicios", label: "Ver mis ejercicios", icon: Sparkles, tone: "bg-warning-soft text-[#8a6418]" },
  { href: "/app/materiales", label: "Materiales", icon: BookOpen, tone: "bg-sand-100 text-foreground" },
  { href: "/app/agenda/nuevo", label: "Solicitar turno", icon: CalendarPlus, tone: "bg-primary text-primary-foreground" },
];

export function QuickActions({ prepareHref }: { prepareHref?: string | null }) {
  const actions = prepareHref
    ? [...ACTIONS.slice(0, 3), { href: prepareHref, label: "Prepararme para mi sesión", icon: ClipboardList, tone: "bg-success-soft text-mint-700" }, ...ACTIONS.slice(3)]
    : ACTIONS;
  return (
    <section aria-labelledby="quick-actions-title" className="space-y-4">
      <h2 id="quick-actions-title" className="font-display text-2xl font-medium">
        ¿Qué necesitás hoy?
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex min-h-28 flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className={`flex size-10 items-center justify-center rounded-xl ${a.tone}`}>
                <a.icon className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-medium leading-snug">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
