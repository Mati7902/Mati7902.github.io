"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { capitalize, formatCompactDate, formatTime } from "@/lib/dates";
import type { AnswerEntry } from "@/lib/exercises/steps";
import { deleteExerciseResponseAction } from "@/server/actions/exercises";

export type ResponseView = {
  id: string;
  completedAt: string;
  title?: string;
  entries: AnswerEntry[];
  emotionBefore: number | null;
  emotionAfter: number | null;
};

/** Pares pregunta → respuesta de una respuesta guardada. */
export function AnswerList({ entries }: { entries: AnswerEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sin respuestas escritas.</p>;
  return (
    <dl className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">{entry.label}</dt>
          <dd className="text-sm text-foreground">
            {Array.isArray(entry.value) ? (
              <ul className="list-disc space-y-0.5 pl-5 marker:text-accent">
                {entry.value.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            ) : (
              <span className="whitespace-pre-line">{entry.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Historial de respuestas de ejercicios. La más reciente se muestra abierta. Con `canDelete`
 * (el propio paciente) cada respuesta se puede eliminar.
 */
export function ExerciseResponseList({ responses, canDelete = false }: { responses: ResponseView[]; canDelete?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const remove = (id: string) => {
    if (!window.confirm("¿Eliminar esta respuesta? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      const result = await deleteExerciseResponseAction(id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Respuesta eliminada.");
      router.refresh();
    });
  };
  return (
    <ul className="space-y-3">
      {responses.map((r, i) => (
        <li key={r.id}>
          <details open={i === 0} className="group rounded-2xl border border-border/70 bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
              <span className="min-w-0">
                {r.title ? <span className="block truncate font-medium text-foreground">{r.title}</span> : null}
                <span className="text-xs text-muted-foreground">
                  {capitalize(formatCompactDate(r.completedAt))} · {formatTime(r.completedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {r.emotionBefore !== null && r.emotionAfter !== null ? (
                  <Badge variant="muted">
                    Emoción {r.emotionBefore} → {r.emotionAfter}
                  </Badge>
                ) : null}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-border/60 px-4 py-4">
              <AnswerList entries={r.entries} />
              {canDelete ? (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(r.id)} disabled={pending}>
                    <Trash2 aria-hidden /> Eliminar
                  </Button>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
