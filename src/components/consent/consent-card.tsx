import Link from "next/link";
import { ArrowRight, FileSignature } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Aviso en el inicio mientras falta firmar el consentimiento (o firmar su versión nueva). */
export function ConsentCard({ updated, sessions }: { updated: boolean; sessions: number }) {
  return (
    <section aria-labelledby="consentimiento-card" className="rounded-3xl border border-primary/15 bg-primary-soft/50 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-[var(--shadow-card)]">
            <FileSignature className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 id="consentimiento-card" className="font-display text-xl font-medium">
              {updated ? "Firmá la versión nueva del consentimiento" : "Leé y firmá el consentimiento informado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Cómo es el tratamiento, la confidencialidad y el compromiso de asistir a las primeras {sessions} sesiones.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/app/consentimiento-informado">
            Leer y firmar <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
