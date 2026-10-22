import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { BackToGuide, Blocks, Sections } from "@/components/admin/guia/blocks";
import { inline } from "@/components/exercises/rich-text";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { fichasForProtocol, getProtocol, testForName } from "@/lib/guia/guia";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProtocol((await params).id);
  return { title: p ? `Protocolo ${p.id}: ${p.title}` : "Protocolo" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</h4>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

export default async function ProtocolPage({ params }: Props) {
  await requireAdmin();
  const protocol = getProtocol((await params).id);
  if (!protocol) notFound();
  const fichas = fichasForProtocol(protocol.id);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Protocolo ${protocol.id} · ${protocol.sessions.length} sesiones`} title={protocol.title} description={protocol.intro.replace(/\*\*/g, "")} actions={<BackToGuide />} />

      {fichas.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Cuadros relacionados:</span>
          {fichas.map((f) => (
            <Link key={f.id} href={`/admin/guia/cuadros/${f.id}`} className="rounded-full border border-border bg-card px-3 py-1 text-primary hover:bg-surface-muted">
              {f.title}
            </Link>
          ))}
        </div>
      ) : null}

      <Sections sections={protocol.sections} />

      {protocol.tests.length ? (
        <section aria-labelledby="medicion" className="space-y-3">
          <h2 id="medicion" className="font-display text-xl font-medium text-foreground">
            Medición
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Instrumento</th>
                  <th scope="col" className="px-4 py-2 font-medium">Cuándo</th>
                  <th scope="col" className="px-4 py-2 font-medium">Para qué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {protocol.tests.map((t) => {
                  const def = testForName(t.name);
                  return (
                    <tr key={t.name} className="align-top">
                      <td className="px-4 py-2 font-medium">
                        {def ? (
                          <Link href={`/admin/guia/tests/${def.id}`} className="text-primary underline-offset-4 hover:underline">
                            {t.name}
                          </Link>
                        ) : (
                          t.name
                        )}
                        {def ? <Badge variant="success" className="ml-2">aplicable aquí</Badge> : null}
                      </td>
                      <td className="px-4 py-2">{t.when}</td>
                      <td className="px-4 py-2">{t.why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="sesiones" className="space-y-3">
        <h2 id="sesiones" className="font-display text-xl font-medium text-foreground">
          Sesión por sesión
        </h2>
        <div className="space-y-3">
          {protocol.sessions.map((s) => (
            <details key={s.n} className="group rounded-2xl border border-border/70 bg-card open:shadow-[var(--shadow-card)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-foreground">
                  <span className="mr-2 text-primary">Sesión {s.n}</span>
                  {s.name}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-4 border-t border-border/60 px-5 py-4">
                {s.objective ? <Field label="Objetivo">{inline(s.objective)}</Field> : null}
                {s.contents.length ? (
                  <Field label="Contenido">
                    <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
                      {s.contents.map((c) => (
                        <li key={c}>{inline(c)}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}
                {s.examples.length ? (
                  <Field label="Ejemplos de lo que se dice">
                    <div className="space-y-2">
                      {s.examples.map((e) => (
                        <p key={e} className="rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-sm">
                          {inline(e)}
                        </p>
                      ))}
                    </div>
                  </Field>
                ) : null}
                {s.homework ? <Field label="Tarea entre sesiones">{inline(s.homework)}</Field> : null}
                {s.measures ? <Field label="Medición">{inline(s.measures)}</Field> : null}
                {s.extra.length ? <Blocks blocks={s.extra} /> : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      {protocol.refs ? (
        <section aria-labelledby="refs" className="space-y-2">
          <h2 id="refs" className="font-display text-xl font-medium text-foreground">
            Referencias
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{protocol.refs}</p>
        </section>
      ) : null}
    </div>
  );
}
