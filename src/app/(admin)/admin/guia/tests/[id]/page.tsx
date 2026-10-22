import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { BackToGuide } from "@/components/admin/guia/blocks";
import { TestRunner } from "@/components/admin/guia/test-runner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getTest } from "@/lib/guia/guia";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTest((await params).id);
  return { title: t ? t.name : "Test" };
}

export default async function TestPage({ params }: Props) {
  await requireAdmin();
  const def = getTest((await params).id);
  if (!def) notFound();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Test · ${def.domain}`} title={def.name} description={def.full} actions={<BackToGuide />} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="soft" className="whitespace-normal text-left">Para {def.who}</Badge>
        <Badge variant="muted" className="whitespace-normal text-left">Licencia: {def.license}</Badge>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        Las respuestas se quedan en esta pantalla: no se guardan ni se asocian a ningún paciente. Copiá el resultado a la nota clínica.
      </p>
      <TestRunner key={def.id} def={def} />
    </div>
  );
}
