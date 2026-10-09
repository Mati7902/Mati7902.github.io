import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AuthCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("w-full max-w-md animate-fade-up rounded-3xl border border-border/70 bg-card p-7 shadow-[var(--shadow-soft)] sm:p-9", className)}>
      <header className="mb-7 space-y-2">
        <h1 className="font-display text-3xl font-medium text-foreground">{title}</h1>
        {subtitle ? <p className="text-base text-muted-foreground">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
