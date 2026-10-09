"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmotionSlider } from "@/components/emotions/emotion-slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { saveSessionPrepAction } from "@/server/actions/session-prep";
import type { SessionPreparation } from "@/types/domain";

const QUESTIONS = [
  { key: "week_rating", title: "¿Cómo estuvo tu semana del 0 al 10?", type: "scale" as const },
  { key: "hardest", title: "¿Qué fue lo más difícil?", type: "text" as const },
  { key: "better", title: "¿Hubo algo que te hizo sentir mejor?", type: "text" as const },
  { key: "topics", title: "¿Hay algún tema que quieras trabajar en la sesión?", type: "text" as const },
  { key: "practiced", title: "¿Pudiste practicar algún ejercicio?", type: "text" as const },
  { key: "important", title: "¿Hay algo importante que quieras contarme?", type: "text" as const },
];

export function SessionPrepForm({ appointmentId, existing }: { appointmentId: string; existing: SessionPreparation | null }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState<number>(existing?.week_rating ?? 5);
  const [texts, setTexts] = useState<Record<string, string>>({
    hardest: existing?.hardest ?? "",
    better: existing?.better ?? "",
    topics: existing?.topics ?? "",
    practiced: existing?.practiced ?? "",
    important: existing?.important ?? "",
  });
  const [pending, startTransition] = useTransition();
  const q = QUESTIONS[index]!;
  const isLast = index === QUESTIONS.length - 1;

  const save = (submit: boolean) =>
    startTransition(async () => {
      const result = await saveSessionPrepAction({
        appointmentId,
        weekRating: rating,
        hardest: texts.hardest || null,
        better: texts.better || null,
        topics: texts.topics || null,
        practiced: texts.practiced || null,
        important: texts.important || null,
        submit,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(submit ? "Listo. Tu psicólogo verá este resumen antes de la sesión." : "Borrador guardado.");
      if (submit) {
        router.push("/app");
        router.refresh();
      }
    });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <Progress value={((index + 1) / QUESTIONS.length) * 100} aria-label={`Pregunta ${index + 1} de ${QUESTIONS.length}`} />
        <p className="text-xs text-muted-foreground">
          Pregunta {index + 1} de {QUESTIONS.length}
        </p>
      </div>
      <div key={q.key} className="animate-fade-up space-y-6">
        <h2 className="font-display text-2xl font-medium sm:text-3xl">{q.title}</h2>
        {q.type === "scale" ? (
          <EmotionSlider value={rating} onChange={setRating} minLabel="Muy mala" maxLabel="Muy buena" label="Tu semana" />
        ) : (
          <Textarea autoFocus value={texts[q.key] ?? ""} onChange={(e) => setTexts((t) => ({ ...t, [q.key]: e.target.value }))} placeholder="Escribí lo que quieras compartir…" maxLength={2000} className="min-h-32 text-base" aria-label={q.title} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || pending}>
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => save(false)} disabled={pending}>
            Guardar borrador
          </Button>
          {isLast ? (
            <Button type="button" size="lg" onClick={() => save(true)} loading={pending}>
              <Check aria-hidden /> Enviar
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => setIndex((i) => i + 1)}>
              Continuar <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
