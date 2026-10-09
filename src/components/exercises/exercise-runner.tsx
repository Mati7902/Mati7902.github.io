"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmotionSelector } from "@/components/emotions/emotion-selector";
import { EmotionSlider } from "@/components/emotions/emotion-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { type ExerciseAnswers, type ExerciseStep, interpolate, isInputStep } from "@/lib/exercises/steps";
import { cn } from "@/lib/utils";
import { saveExerciseResponseAction } from "@/server/actions/exercises";

type Props = {
  templateId: string;
  title: string;
  steps: ExerciseStep[];
  assignmentId?: string | null;
  returnTo?: string;
};

/** Wizard: una pregunta por pantalla. Guarda al final mediante server action. */
export function ExerciseRunner({ templateId, title, steps, assignmentId, returnTo = "/app/ejercicios" }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ExerciseAnswers>({});
  const [pending, startTransition] = useTransition();
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const inputSteps = useMemo(() => steps.filter(isInputStep).length, [steps]);
  const answeredInputs = useMemo(() => steps.filter((s) => isInputStep(s) && answers[s.id] !== undefined && answers[s.id] !== "").length, [steps, answers]);

  if (!step) return null;

  const value = answers[step.id];
  const required = isInputStep(step) && !step.optional;
  const hasValue =
    value !== undefined &&
    (typeof value === "number" || (typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.filter(Boolean).length === (step.type === "list" ? step.count : 1) : false));
  // Una escala sin tocar vale su punto medio (el control ya lo muestra seleccionado).
  const canContinue = !required || hasValue || step.type === "scale";

  const setValue = (v: string | number | string[]) => setAnswers((a) => ({ ...a, [step.id]: v }));

  const withScaleDefault = (current: ExerciseAnswers): ExerciseAnswers =>
    step.type === "scale" && typeof current[step.id] !== "number" ? { ...current, [step.id]: Math.round((step.min + step.max) / 2) } : current;

  const submit = (answers: ExerciseAnswers) =>
    startTransition(async () => {
      const before = steps.find((s) => s.type === "scale" && s.maps_to === "emotion_before");
      const after = steps.find((s) => s.type === "scale" && s.maps_to === "emotion_after");
      const result = await saveExerciseResponseAction({
        templateId,
        assignmentId: assignmentId ?? null,
        answers,
        emotionBefore: before && typeof answers[before.id] === "number" ? (answers[before.id] as number) : null,
        emotionAfter: after && typeof answers[after.id] === "number" ? (answers[after.id] as number) : null,
        durationSeconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Ejercicio guardado.");
      router.push(`${returnTo}?completado=1`);
      router.refresh();
    });

  const next = () => {
    const completed = withScaleDefault(answers);
    if (completed !== answers) setAnswers(completed);
    if (isLast) submit(completed);
    else setIndex((i) => i + 1);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="space-y-2">
        <Progress value={((index + 1) / steps.length) * 100} aria-label={`Paso ${index + 1} de ${steps.length}`} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span>
            {index + 1} / {steps.length}
            {inputSteps > 0 ? ` · ${answeredInputs} respondidas` : ""}
          </span>
        </div>
      </div>

      <div key={step.id} className="animate-fade-up space-y-6">
        <StepView step={step} value={value} onChange={setValue} answers={answers} onAutoAdvance={next} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || pending}>
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        <div className="flex gap-2">
          {isInputStep(step) && step.optional && !isLast ? (
            <Button type="button" variant="outline" onClick={() => setIndex((i) => i + 1)} disabled={pending}>
              Saltar
            </Button>
          ) : null}
          <Button type="button" size="lg" onClick={next} disabled={!canContinue} loading={pending}>
            {isLast ? (
              <>
                <Check aria-hidden /> Terminar
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

function StepView({
  step,
  value,
  onChange,
  answers,
  onAutoAdvance,
}: {
  step: ExerciseStep;
  value: string | number | string[] | undefined;
  onChange: (v: string | number | string[]) => void;
  answers: ExerciseAnswers;
  onAutoAdvance: () => void;
}) {
  switch (step.type) {
    case "info":
      return (
        <div className="space-y-3">
          {step.title ? <h2 className="font-display text-2xl font-medium sm:text-3xl">{step.title}</h2> : null}
          <p className="text-lg leading-relaxed text-muted-foreground">{step.content}</p>
        </div>
      );
    case "timed_info":
      return <TimedInfo key={step.id} title={step.title} content={step.content} seconds={step.seconds} onDone={onAutoAdvance} />;
    case "reflect":
      return (
        <div className="space-y-4">
          {step.title ? <h2 className="font-display text-2xl font-medium sm:text-3xl">{step.title}</h2> : null}
          <blockquote className="rounded-2xl border-l-4 border-accent bg-mint-50 px-5 py-4 font-display text-xl text-foreground">{interpolate(step.template, answers)}</blockquote>
          {step.content ? <p className="text-muted-foreground">{step.content}</p> : null}
        </div>
      );
    case "text":
      return (
        <div className="space-y-4">
          <Prompt step={step} />
          <Textarea autoFocus value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder={step.placeholder ?? "Escribí acá…"} maxLength={2000} className="min-h-32 text-base" aria-label={step.prompt} />
        </div>
      );
    case "scale":
      return (
        <div className="space-y-4">
          <Prompt step={step} />
          <EmotionSlider value={typeof value === "number" ? value : Math.round((step.min + step.max) / 2)} onChange={onChange} min={step.min} max={step.max} minLabel={step.min_label ?? ""} maxLabel={step.max_label ?? ""} label="" />
        </div>
      );
    case "emotion":
      return (
        <div className="space-y-4">
          <Prompt step={step} />
          <EmotionSelector value={typeof value === "string" ? [value] : []} onChange={(v) => onChange(v[0] ?? "")} single />
        </div>
      );
    case "choice":
      return (
        <div className="space-y-4">
          <Prompt step={step} />
          <div className="grid gap-2.5">
            {step.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                aria-pressed={value === option}
                className={cn(
                  "min-h-13 rounded-2xl border px-4 py-3 text-left text-base font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
                  value === option ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-surface-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    case "list": {
      const list = Array.isArray(value) ? value : Array.from({ length: step.count }, () => "");
      return (
        <div className="space-y-4">
          <Prompt step={step} />
          <div className="grid gap-2.5">
            {Array.from({ length: step.count }, (_, i) => (
              <Input
                key={i}
                autoFocus={i === 0}
                value={list[i] ?? ""}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={`${i + 1}.`}
                aria-label={`${step.prompt}, ${i + 1} de ${step.count}`}
                maxLength={120}
              />
            ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function Prompt({ step }: { step: Extract<ExerciseStep, { prompt: string }> }) {
  return (
    <div className="space-y-1.5">
      <h2 className="font-display text-2xl font-medium sm:text-3xl">{step.prompt}</h2>
      {step.help ? <p className="text-muted-foreground">{step.help}</p> : null}
      {step.optional ? <p className="text-xs text-subtle-foreground">Opcional.</p> : null}
    </div>
  );
}

function TimedInfo({ title, content, seconds, onDone }: { title?: string; content: string; seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      onDone();
      return;
    }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, running, onDone]);
  return (
    <div className="space-y-5">
      {title ? <h2 className="font-display text-2xl font-medium sm:text-3xl">{title}</h2> : null}
      <p className="text-lg leading-relaxed text-muted-foreground">{content}</p>
      <div className="flex items-center gap-4">
        <div className="relative size-16" aria-hidden>
          <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-sand-300)" strokeWidth="3" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${((seconds - left) / seconds) * 100} 100`} strokeLinecap="round" className="transition-[stroke-dasharray] duration-1000 ease-linear" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">{left}s</span>
        </div>
        {!running ? (
          <Button type="button" variant="secondary" onClick={() => setRunning(true)}>
            Iniciar {seconds} segundos
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Quedate con esto… al terminar seguimos.
          </p>
        )}
      </div>
    </div>
  );
}
