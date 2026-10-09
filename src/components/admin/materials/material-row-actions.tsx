"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteMaterialAction } from "@/server/actions/admin-materials";

export function MaterialRowActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const remove = () => {
    if (!window.confirm(`¿Eliminar "${title}"? Se quitará también de los pacientes que lo tengan asignado.`)) return;
    startTransition(async () => {
      const res = await deleteMaterialAction(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Material eliminado.");
      router.refresh();
    });
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="icon-sm" aria-label="Editar">
        <Link href={`/admin/materiales/${id}`}>
          <Pencil />
        </Link>
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={remove} disabled={pending} aria-label="Eliminar">
        <Trash2 />
      </Button>
    </div>
  );
}
