import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { exerciseHref } from "@/components/exercises/exercise-card";
import { MaterialOpener } from "@/components/materials/material-opener";
import { Badge } from "@/components/ui/badge";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPatientMaterial, MATERIAL_TYPE_LABEL } from "@/server/services/materials";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const material = await getPatientMaterial(supabase, patient.id, id);
  return { title: material?.title ?? "Material" };
}

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { patient } = await requirePatient();
  const { id } = await params;
  const supabase = await createClient();
  const material = await getPatientMaterial(supabase, patient.id, id);
  if (!material) notFound();
  const exerciseLink = material.type === "exercise" && material.exercise_templates ? exerciseHref({ slug: material.exercise_templates.slug, kind: "custom" }) : null;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/app/materiales" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Materiales
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{MATERIAL_TYPE_LABEL[material.type]}</Badge>
          {material.material_categories ? <Badge variant="outline">{material.material_categories.name}</Badge> : null}
          {material.recommended ? <Badge variant="soft">Recomendado para vos</Badge> : null}
        </div>
        <h1 className="font-display text-3xl font-medium sm:text-4xl">{material.title}</h1>
        {material.description ? <p className="text-lg text-muted-foreground">{material.description}</p> : null}
        {material.duration_minutes ? <p className="text-sm text-subtle-foreground">Duración aproximada: {material.duration_minutes} min</p> : null}
      </header>
      {material.assignment?.note ? (
        <div className="rounded-2xl bg-mint-50 px-5 py-4 text-sm text-mint-700">
          <p className="font-medium">Nota de tu psicólogo</p>
          <p>{material.assignment.note}</p>
        </div>
      ) : null}
      {material.type === "video" && material.external_url && /youtube\.com|youtu\.be|vimeo\.com/.test(material.external_url) ? (
        <div className="aspect-video overflow-hidden rounded-2xl border border-border/70 bg-black">
          <iframe src={embedUrl(material.external_url)} title={material.title} className="size-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      ) : null}
      {material.type === "audio" && material.external_url ? <audio controls preload="none" src={material.external_url} className="w-full" /> : null}
      <MaterialOpener material={material} exerciseHref={exerciseLink} />
    </article>
  );
}

function embedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return `https://www.youtube-nocookie.com/embed/${id ?? ""}`;
    }
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop() ?? ""}`;
  } catch {
    // URL inválida: se usa tal cual.
  }
  return url;
}
