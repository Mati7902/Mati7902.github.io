"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompactDate, formatTime } from "@/lib/dates";
import { emotionLabel } from "@/lib/config/site";

type Point = { date: string; intensity: number; emotions: string[] };

/** Evolución simple de la intensidad registrada. Sin interpretación ni diagnóstico. */
export function MoodChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Cuando tengas al menos dos registros vas a ver acá cómo cambia la intensidad con el tiempo.</p>;
  }
  const series = data.map((p) => ({ ...p, label: formatCompactDate(p.date) }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Gráfico de intensidad emocional a lo largo del tiempo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--divider)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (Point & { label: string }) | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-float)]">
                  <p className="font-medium text-foreground">
                    {point.label} · {formatTime(point.date)}
                  </p>
                  <p className="text-muted-foreground">Intensidad {point.intensity} · {point.emotions.map(emotionLabel).join(", ")}</p>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="intensity" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
