"use client";

import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { BreathingConfig } from "@/lib/exercises/steps";
import { cn } from "@/lib/utils";

type Phase = "inhale" | "hold" | "exhale" | "hold_after";
const PHASE_LABEL: Record<Phase, string> = { inhale: "INHALÁ", hold: "SOSTENÉ", exhale: "EXHALÁ", hold_after: "SOSTENÉ" };

type Props = {
  config: BreathingConfig;
  title: string;
  onComplete?: (info: { durationMinutes: number }) => void;
};

/**
 * Respiración guiada con animación sincronizada (círculo que crece y decrece), sonido opcional
 * (tonos suaves generados con WebAudio, sin archivos) y duración configurable.
 */
export function BreathingExercise({ config, title, onComplete }: Props) {
  const reducedMotion = useReducedMotion();
  const [pattern, setPattern] = useState(config.pattern);
  const [durationMin, setDurationMin] = useState(config.durations[1] ?? config.durations[0] ?? 3);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseLeft, setPhaseLeft] = useState(pattern.inhale);
  const [sound, setSound] = useState(false);
  const [done, setDone] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const completedRef = useRef(false);

  const phases = useMemo(() => {
    const list: { key: Phase; seconds: number }[] = [
      { key: "inhale", seconds: pattern.inhale },
      { key: "hold", seconds: pattern.hold },
      { key: "exhale", seconds: pattern.exhale },
      { key: "hold_after", seconds: pattern.hold_after },
    ];
    return list.filter((p) => p.seconds > 0);
  }, [pattern]);

  const totalSeconds = durationMin * 60;

  const tone = useCallback(
    (frequency: number) => {
      if (!sound) return;
      try {
        audioCtx.current ??= new AudioContext();
        const ctx = audioCtx.current;
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } catch {
        // Sin audio disponible: el ejercicio sigue funcionando en silencio.
      }
    },
    [sound],
  );

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reloj principal: 1 tick por segundo. Las transiciones de fase se calculan dentro del tick
  // (sin setState en efectos) para mantener el círculo y el contador perfectamente sincronizados.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed((e) => {
        const nextElapsed = e + 1;
        if (nextElapsed >= totalSeconds && !completedRef.current) {
          completedRef.current = true;
          window.setTimeout(() => {
            setRunning(false);
            setDone(true);
            onCompleteRef.current?.({ durationMinutes: durationMin });
          }, 0);
        }
        return nextElapsed;
      });
      setPhaseLeft((left) => {
        if (left > 1) return left - 1;
        // Fin de fase: avanzar a la siguiente.
        setPhase((current) => {
          const index = phases.findIndex((p) => p.key === current);
          const next = phases[(index + 1) % phases.length] ?? phases[0];
          if (!next) return current;
          window.setTimeout(() => tone(next.key === "inhale" ? 440 : next.key === "exhale" ? 330 : 392), 0);
          return next.key;
        });
        const index = phases.findIndex((p) => p.key === phase);
        const next = phases[(index + 1) % phases.length] ?? phases[0];
        return next?.seconds ?? 4;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, totalSeconds, durationMin, phases, phase, tone]);

  const start = () => {
    completedRef.current = false;
    setDone(false);
    if (elapsed >= totalSeconds) {
      setElapsed(0);
    }
    setPhase("inhale");
    setPhaseLeft(pattern.inhale);
    setRunning(true);
    tone(440);
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setPhase("inhale");
    setPhaseLeft(pattern.inhale);
    setDone(false);
    completedRef.current = false;
  };

  const currentPhase = phases.find((p) => p.key === phase) ?? phases[0];
  const scale = phase === "inhale" ? 1 : phase === "exhale" ? 0.62 : phase === "hold" ? 1 : 0.62;
  const transition = reducedMotion ? "none" : `transform ${currentPhase?.seconds ?? 4}s cubic-bezier(0.4, 0, 0.2, 1)`;
  const progress = Math.min(100, (elapsed / totalSeconds) * 100);
  const remaining = Math.max(0, totalSeconds - elapsed);

  return (
    <section aria-label={title} className="flex flex-col items-center gap-8">
      {/* Círculo */}
      <div className="relative flex size-64 items-center justify-center sm:size-72">
        <div className="absolute inset-0 rounded-full bg-mint-100/70" />
        <div
          aria-hidden
          className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_30%_30%,_var(--color-mint-200),_var(--color-petrol-400))] shadow-[var(--shadow-soft)]"
          style={{ transform: `scale(${running || done ? scale : 0.62})`, transition }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Solo se anuncia el cambio de fase: la cuenta regresiva segundo a segundo saturaría al lector de pantalla. */}
          <p className="font-display text-3xl font-medium tracking-wide text-primary-foreground drop-shadow-sm" aria-live="polite" aria-atomic>
            {running ? PHASE_LABEL[phase] : done ? "LISTO" : "PREPARATE"}
          </p>
          <p className="mt-1 text-base text-primary-foreground/90" aria-hidden={running}>
            {running ? `${Math.max(phaseLeft, 1)} ${phaseLeft === 1 ? "segundo" : "segundos"}` : done ? "Bien hecho" : "Cuando quieras"}
          </p>
        </div>
      </div>

      {/* Progreso total */}
      <div className="w-full max-w-sm space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-300">
          <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} restantes
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!running ? (
          <Button size="lg" onClick={start}>
            <Play aria-hidden /> {elapsed > 0 && !done ? "Continuar" : "Empezar"}
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={() => setRunning(false)}>
            <Pause aria-hidden /> Pausar
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={reset} aria-label="Reiniciar">
          <RotateCcw aria-hidden /> Reiniciar
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setSound((s) => !s)} aria-pressed={sound} aria-label={sound ? "Desactivar sonido" : "Activar sonido"}>
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>

      {/* Configuración */}
      <div className="grid w-full max-w-md gap-5 rounded-2xl border border-border/70 bg-card p-5">
        <fieldset className="space-y-2" disabled={running}>
          <legend className="text-sm font-medium">Duración</legend>
          <div className="flex gap-2">
            {config.durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDurationMin(d);
                  reset();
                }}
                aria-pressed={durationMin === d}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-sm font-medium transition-colors",
                  durationMin === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-surface-muted",
                )}
              >
                {d} {d === 1 ? "minuto" : "minutos"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-3" disabled={running}>
          <legend className="text-sm font-medium">Ritmo (segundos)</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["inhale", "Inhalar"],
                ["hold", "Sostener"],
                ["exhale", "Exhalar"],
                ["hold_after", "Sostener"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs text-muted-foreground">
                {label}
                <input
                  type="number"
                  min={key === "inhale" || key === "exhale" ? 1 : 0}
                  max={20}
                  value={pattern[key]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                    setPattern((p) => ({ ...p, [key]: v }));
                    reset();
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center text-base text-foreground"
                  aria-label={`${label}, segundos`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
