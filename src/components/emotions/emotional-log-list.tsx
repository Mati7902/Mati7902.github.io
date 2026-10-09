"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emotionLabel } from "@/lib/config/site";
import { formatCompactDate, formatTime, capitalize } from "@/lib/dates";
import { deleteEmotionalLogAction } from "@/server/actions/emotional-logs";
import type { EmotionalLog } from "@/types/domain";

export function EmotionalLogList({ logs }: { logs: EmotionalLog[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const remove = (id: string) => {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      const result = await deleteEmotionalLogAction(id);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
    });
  };
  return (
    <section className="space-y-3" aria-label="Registros anteriores">
      <h2 className="font-display text-xl font-medium">Registros</h2>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {capitalize(formatCompactDate(log.logged_at))} · {formatTime(log.logged_at)}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {log.emotions.map((e) => (
                    <Badge key={e} variant="soft">
                      {emotionLabel(e)}
                    </Badge>
                  ))}
                  <Badge variant="muted">Intensidad {log.intensity}</Badge>
                </div>
                {log.situation ? <p className="text-sm text-foreground">{log.situation}</p> : null}
                {log.thought ? <p className="text-sm text-muted-foreground">Pensamiento: {log.thought}</p> : null}
                {log.need ? <p className="text-sm text-muted-foreground">Necesitaba: {log.need}</p> : null}
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => remove(log.id)} disabled={pending} aria-label="Eliminar registro">
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
