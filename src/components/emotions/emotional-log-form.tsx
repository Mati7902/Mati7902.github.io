"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmotionSelector } from "@/components/emotions/emotion-selector";
import { EmotionSlider } from "@/components/emotions/emotion-slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { saveEmotionalLogAction } from "@/server/actions/emotional-logs";

type Step = { key: "emotions" | "intensity" | "situation" | "thought" | "behavior" | "need"; title: string; help?: string; optional?: boolean };

const STEPS: Step[] = [
  { key: "emotions", title: "¿Cómo te sentís en este momento?", help: "Podés elegir hasta tres." },
  { key: "intensity", title: "¿Con qué intensidad?" },
  { key: "situation", title: "¿Qué estaba pasando?", help: "Un par de frases alcanzan.", optional: true },
  { key: "thought", title: "¿Qué pensamiento apareció?", optional: true },
  { key: "behavior", title: "¿Qué hiciste después?", optional: true },
  { key: "need", title: "¿Qué necesitabas en ese momento?", optional: true },
];

export function EmotionalLogForm() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;
  const canContinue = step.key !== "emotions" || emotions.length > 0;

  const submit = () =>
    startTransition(async () => {
      const result = await saveEmotionalLogAction({
        emotions,
        intensity,
        situation: texts.situation ?? null,
        thought: texts.thought ?? null,
        behavior: texts.behavior ?? null,
        need: texts.need ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro guardado. Gracias por tomarte este momento.");
      router.push("/app/registro");
      router.refresh();
    });

  const next = () => (isLast ? submit() : setIndex((i) => i + 1));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <Progress value={((index + 1) / STEPS.length) * 100} aria-label={`Paso ${index + 1} de ${STEPS.length}`} />
        <p className="text-xs text-muted-foreground">
          Paso {index + 1} de {STEPS.length}
        </p>
      </div>

      <div key={step.key} className="animate-fade-up space-y-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-medium sm:text-3xl">{step.title}</h2>
          {step.help ? <p className="text-muted-foreground">{step.help}</p> : null}
          {step.optional ? <p className="text-xs text-subtle-foreground">Opcional. Podés saltarlo.</p> : null}
        </div>

        {step.key === "emotions" ? <EmotionSelector value={emotions} onChange={setEmotions} /> : null}
        {step.key === "intensity" ? <EmotionSlider value={intensity} onChange={setIntensity} /> : null}
        {step.key !== "emotions" && step.key !== "intensity" ? (
          <Textarea
            autoFocus
            value={texts[step.key] ?? ""}
            onChange={(e) => setTexts((t) => ({ ...t, [step.key]: e.target.value }))}
            placeholder="Escribí acá…"
            maxLength={1000}
            className="min-h-32 text-base"
            aria-label={step.title}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || pending}>
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <div className="flex gap-2">
          {step.optional && !isLast ? (
            <Button type="button" variant="outline" onClick={() => setIndex((i) => i + 1)} disabled={pending}>
              Saltar
            </Button>
          ) : null}
          <Button type="button" size="lg" onClick={next} disabled={!canContinue} loading={pending}>
            {isLast ? (
              <>
                <Check aria-hidden /> Guardar
              </>
            ) : (
              <>
                Continuar <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
