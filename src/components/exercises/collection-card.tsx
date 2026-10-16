import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { exerciseHref } from "@/components/exercises/exercise-card";
import type { CollectionInfo } from "@/lib/exercises/collections";
import type { ExerciseTemplate } from "@/types/domain";

/** Tarjeta de un cuadernillo en Ejercicios: avance y acceso directo al próximo paso. */
export function CollectionCard({
  collectionKey,
  info,
  total,
  done,
  next,
}: {
  collectionKey: string;
  info: CollectionInfo;
  total: number;
  done: number;
  next: Pick<ExerciseTemplate, "slug" | "kind" | "title"> | null;
}) {
  return (
    <article className="space-y-4 rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <BookOpen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-display text-xl font-medium leading-snug">{info.title}</h3>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Progress value={total ? (done / total) * 100 : 0} aria-label={`${done} de ${total} hechos`} />
        <p className="text-xs text-muted-foreground">
          {done} de {total} hechos
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {next ? (
          <Button asChild>
            <Link href={exerciseHref(next)}>
              {done === 0 ? "Empezar" : "Seguir"}: {next.title} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/app/ejercicios/cuadernillo/${collectionKey}`}>Ver todo el cuadernillo</Link>
        </Button>
      </div>
    </article>
  );
}
