import { RichText } from "@/components/exercises/rich-text";
import { cn } from "@/lib/utils";

/**
 * El consentimiento informado como documento: título, texto (párrafos, viñetas y subtítulos en
 * negrita) y, si ya se firmó, el bloque de firma.
 */
export function ConsentDocument({
  title,
  text,
  signature,
  className,
}: {
  title: string;
  text: string;
  signature?: { name: string; guardian?: string | null; minor?: boolean; date: string; version: string } | null;
  className?: string;
}) {
  return (
    <article className={cn("space-y-6 rounded-3xl border border-border/70 bg-card p-6 sm:p-8 print:rounded-none print:border-0 print:p-0", className)}>
      <h2 className="font-display text-2xl font-medium text-foreground text-balance">{title}</h2>
      <RichText text={text} headingLevel={3} className="space-y-4 text-[0.95rem] leading-relaxed text-foreground/90" />
      {signature ? (
        <dl className="grid gap-4 border-t border-divider pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Firmado por</dt>
            <dd className="mt-1 font-display text-lg italic text-foreground">{signature.name}</dd>
          </div>
          {signature.guardian ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quien autoriza (nombre indicado por la o el paciente)</dt>
              <dd className="mt-1 font-display text-lg italic text-foreground">{signature.guardian}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</dt>
            <dd className="mt-1 text-foreground">{signature.date}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Versión del texto</dt>
            <dd className="mt-1 text-foreground">{signature.version}</dd>
          </div>
        </dl>
      ) : null}
      {signature?.minor ? (
        <div className="space-y-3 border-t border-divider pt-5 text-sm text-muted-foreground">
          <p>Autorización de la persona adulta (para completar en persona):</p>
          <p className="leading-loose">
            Autorización confirmada con: ______________________________ · Firma: ____________________ · Fecha: ____/____/________
          </p>
        </div>
      ) : null}
    </article>
  );
}
