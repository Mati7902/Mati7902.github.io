import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToGuide, Blocks } from "@/components/admin/guia/blocks";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getFicha, getProtocol } from "@/lib/guia/guia";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = getFicha((await params).id);
  return { title: f?.title ?? "Cuadro clínico" };
}

export default async function FichaPage({ params }: Props) {
  await requireAdmin();
  const ficha = getFicha((await params).id);
  if (!ficha) notFound();
  const protocols = ficha.protocols.map((id) => getProtocol(id)).filter((p) => p !== undefined);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cuadro clínico" title={ficha.title} actions={<BackToGuide />} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {ficha.codes.length ? <span className="text-muted-foreground">CIE-10 (OMS):</span> : null}
        {ficha.codes.map((c) => (
          <Badge key={c} variant="soft">
            {c}
          </Badge>
        ))}
      </div>
      {protocols.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Protocolos:</span>
          {protocols.map((p) => (
            <Link key={p.id} href={`/admin/guia/protocolos/${p.id}`} className="rounded-full border border-border bg-card px-3 py-1 text-primary hover:bg-surface-muted">
              {p.id}. {p.title}
            </Link>
          ))}
        </div>
      ) : null}
      <article className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <Blocks blocks={ficha.blocks} />
      </article>
    </div>
  );
}
