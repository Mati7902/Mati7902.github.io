import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackToGuide, Sections } from "@/components/admin/guia/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { getTema } from "@/lib/guia/guia";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTema((await params).id);
  return { title: t?.title ?? "Situación especial" };
}

export default async function TemaPage({ params }: Props) {
  await requireAdmin();
  const tema = getTema((await params).id);
  if (!tema) notFound();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Capítulo ${tema.chapter}`} title={tema.title} actions={<BackToGuide />} />
      <Sections sections={tema.sections} />
    </div>
  );
}
