"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { toggleExerciseActiveAction } from "@/server/actions/admin-materials";

export function ExerciseToggle({ id, active, title }: { id: string; active: boolean; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending}
      aria-label={`${active ? "Desactivar" : "Activar"} ${title}`}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const res = await toggleExerciseActiveAction(id, checked);
          if (!res.ok) return void toast.error(res.error);
          toast.success(checked ? "Ejercicio visible para pacientes." : "Ejercicio oculto.");
          router.refresh();
        })
      }
    />
  );
}
