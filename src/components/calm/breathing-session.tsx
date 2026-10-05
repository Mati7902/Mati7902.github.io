"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { BreathingExercise } from "@/components/calm/breathing-exercise";
import type { BreathingConfig } from "@/lib/exercises/steps";
import { saveExerciseResponseAction } from "@/server/actions/exercises";

/** Envuelve el ejercicio de respiración para registrar la práctica completada. */
export function BreathingSession({ templateId, title, config }: { templateId: string; title: string; config: BreathingConfig }) {
  const onComplete = useCallback(
    async ({ durationMinutes }: { durationMinutes: number }) => {
      const result = await saveExerciseResponseAction({
        templateId,
        answers: { duration_minutes: durationMinutes },
        durationSeconds: durationMinutes * 60,
      });
      if (result.ok) toast.success("Listo. Registramos tu práctica.");
    },
    [templateId],
  );
  return <BreathingExercise config={config} title={title} onComplete={onComplete} />;
}
