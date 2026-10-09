import { FileText, Headphones, Image as ImageIcon, Link2, PlayCircle, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { PatientMaterialView } from "@/server/services/materials";
import type { Material } from "@/types/domain";

const ICONS: Record<Material["type"], typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  audio: Headphones,
  video: PlayCircle,
  link: Link2,
  exercise: Sparkles,
};

export function MaterialCard({ material }: { material: PatientMaterialView }) {
  const Icon = ICONS[material.type];
  const status = material.assignment?.completed_at ? "Completado" : material.assignment?.viewed_at ? "Visto" : null;
  return (
    <Link
      href={`/app/materiales/${material.id}`}
      className="group flex gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-medium leading-snug">{material.title}</h3>
          {material.recommended ? <Badge variant="soft">Para vos</Badge> : null}
          {status ? <Badge variant={status === "Completado" ? "success" : "muted"}>{status}</Badge> : null}
        </div>
        {material.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{material.description}</p> : null}
        <p className="text-xs text-subtle-foreground">
          {material.material_categories?.name ?? "General"}
          {material.duration_minutes ? ` · ${material.duration_minutes} min` : ""}
        </p>
      </div>
    </Link>
  );
}
