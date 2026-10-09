import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LegalPage({ title, version, reviewed, children }: { title: string; version: string; reviewed: boolean; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-medium">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Versión {version}</p>
      {!reviewed ? (
        <Alert variant="warning" className="mt-8">
          <AlertTitle>Borrador pendiente de revisión</AlertTitle>
          <AlertDescription>
            Este texto es una base de trabajo y debe ser revisado por un profesional competente en derecho paraguayo (protección de datos personales, datos sensibles,
            información sanitaria y ejercicio profesional de la psicología) antes de su publicación definitiva.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="prose-custom mt-10 space-y-6 text-base leading-relaxed text-foreground [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:pt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        {children}
      </div>
    </article>
  );
}
