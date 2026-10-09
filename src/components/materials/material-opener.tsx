"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getMaterialFileUrlAction, markMaterialCompletedAction, markMaterialViewedAction } from "@/server/actions/materials";
import type { PatientMaterialView } from "@/server/services/materials";

export function MaterialOpener({ material, exerciseHref }: { material: PatientMaterialView; exerciseHref: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const completed = Boolean(material.assignment?.completed_at);

  // Registrar "visto" al abrir el detalle (dato mínimo, no invasivo).
  useEffect(() => {
    if (!material.assignment?.viewed_at) void markMaterialViewedAction(material.id);
  }, [material.id, material.assignment?.viewed_at]);

  const openFile = () =>
    startTransition(async () => {
      if (material.external_url && !material.storage_path) {
        window.open(material.external_url, "_blank", "noopener,noreferrer");
        return;
      }
      const result = await getMaterialFileUrlAction(material.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });

  const complete = () =>
    startTransition(async () => {
      const result = await markMaterialCompletedAction(material.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Marcado como completado.");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-3">
      {material.type === "exercise" && exerciseHref ? (
        <Button asChild size="lg">
          <a href={exerciseHref}>Hacer el ejercicio</a>
        </Button>
      ) : (
        <Button size="lg" onClick={openFile} loading={pending}>
          <ExternalLink aria-hidden /> {material.type === "link" ? "Abrir enlace" : material.type === "audio" ? "Escuchar" : material.type === "video" ? "Ver video" : "Abrir"}
        </Button>
      )}
      {!completed ? (
        <Button size="lg" variant="outline" onClick={complete} disabled={pending}>
          <CheckCircle2 aria-hidden /> Marcar como completado
        </Button>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-mint-700">
          <CheckCircle2 className="size-4" aria-hidden /> Completado
        </span>
      )}
    </div>
  );
}
