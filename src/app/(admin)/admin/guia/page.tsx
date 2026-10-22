import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CLINICAL_NOTICE } from "@/components/admin/guia/blocks";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { FICHAS, PROTOCOLS, TEMAS, testDomains } from "@/lib/guia/guia";

export const metadata: Metadata = { title: "Guía clínica" };

function Card({ href, title, meta, badges }: { href: string; title: string; meta?: string; badges?: string[] }) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-surface-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="space-y-1.5">
        <span className="block font-medium leading-snug text-foreground">{title}</span>
        {meta ? <span className="block text-sm text-muted-foreground">{meta}</span> : null}
        {badges?.length ? (
          <span className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <Badge key={b} variant="muted">
                {b}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Group({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="font-display text-xl font-medium text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function GuiaPage() {
  await requireAdmin();
  const domains = testDomains();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Material clínico"
        title="Guía clínica"
        description="Cuadros clínicos, protocolos sesión por sesión, situaciones especiales y tests de uso libre para aplicar en la consulta. Solo lo ve el equipo profesional."
      />
      <p role="note" className="rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
        {CLINICAL_NOTICE}
      </p>

      <Group id="cuadros" title="Cuadros clínicos" description="Qué es, cómo se evalúa, diagnóstico diferencial, tratamiento y cuándo derivar.">
        <div className="grid gap-3 sm:grid-cols-2">
          {FICHAS.map((f) => (
            <Card key={f.id} href={`/admin/guia/cuadros/${f.id}`} title={f.title} badges={f.codes.slice(0, 4)} />
          ))}
        </div>
      </Group>

      <Group id="protocolos" title="Protocolos de sesión" description="Objetivo, contenido, ejemplos de lo que se dice, tarea y medición en cada sesión.">
        <div className="grid gap-3 sm:grid-cols-2">
          {PROTOCOLS.map((p) => (
            <Card key={p.id} href={`/admin/guia/protocolos/${p.id}`} title={`${p.id}. ${p.title}`} meta={`${p.sessions.length} sesiones`} />
          ))}
        </div>
      </Group>

      <Group id="temas" title="Situaciones especiales" description="Conducta suicida, sustancias, duelo, adolescentes, bullying, embarazo adolescente, pareja y familia.">
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMAS.map((t) => (
            <Card key={t.id} href={`/admin/guia/temas/${t.id}`} title={t.title} meta={`Capítulo ${t.chapter}`} />
          ))}
        </div>
      </Group>

      <Group id="tests" title="Tests de uso libre" description="Se aplican en pantalla, con puntaje, interpretación y alertas. Las respuestas no se guardan.">
        <div className="space-y-4">
          {domains.map((d) => (
            <div key={d.domain} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.domain}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.tests.map((t) => (
                  <Card key={t.id} href={`/admin/guia/tests/${t.id}`} title={t.name} meta={t.full} badges={[`${t.items.length} ítems`]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
