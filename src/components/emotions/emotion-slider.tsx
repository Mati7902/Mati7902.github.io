"use client";

import { Slider } from "@/components/ui/slider";

type Props = {
  value: number;
  onChange: (v: number) => void;
  minLabel?: string;
  maxLabel?: string;
  label?: string;
  min?: number;
  max?: number;
};

export function EmotionSlider({ value, onChange, minLabel = "Muy poco", maxLabel = "Muchísimo", label = "Intensidad", min = 0, max = 10 }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-display text-4xl font-medium text-primary" aria-live="polite">
          {value}
        </span>
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0] ?? value)} min={min} max={max} step={1} aria-label={label} />
      <div className="flex justify-between text-xs text-subtle-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
