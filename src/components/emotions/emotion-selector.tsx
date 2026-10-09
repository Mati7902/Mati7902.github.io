"use client";

import { EMOTIONS } from "@/lib/config/site";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  single?: boolean;
  id?: string;
};

const TONE_CLASSES: Record<string, string> = {
  calm: "data-[selected=true]:bg-mint-100 data-[selected=true]:border-mint-500 data-[selected=true]:text-mint-700",
  alert: "data-[selected=true]:bg-warning-soft data-[selected=true]:border-warning data-[selected=true]:text-[#8a6418]",
  low: "data-[selected=true]:bg-info-soft data-[selected=true]:border-info data-[selected=true]:text-[#2b5f80]",
  hot: "data-[selected=true]:bg-destructive/10 data-[selected=true]:border-destructive/60 data-[selected=true]:text-destructive",
};

export function EmotionSelector({ value, onChange, max = 3, single = false, id }: Props) {
  const toggle = (key: string) => {
    if (single) return onChange([key]);
    if (value.includes(key)) return onChange(value.filter((v) => v !== key));
    if (value.length >= max) return;
    onChange([...value, key]);
  };
  return (
    <div id={id} role="group" aria-label="Emociones" className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3">
      {EMOTIONS.map((emotion) => {
        const selected = value.includes(emotion.key);
        return (
          <button
            key={emotion.key}
            type="button"
            onClick={() => toggle(emotion.key)}
            aria-pressed={selected}
            data-selected={selected}
            className={cn(
              "min-h-14 rounded-2xl border border-border bg-card px-2.5 py-3 text-sm font-medium leading-snug [overflow-wrap:anywhere] text-foreground transition-all hover:bg-surface-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
              TONE_CLASSES[emotion.tone],
            )}
          >
            {emotion.label}
          </button>
        );
      })}
    </div>
  );
}
