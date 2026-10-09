import { cn } from "@/lib/utils";

/** Líneas onduladas de fondo (motivo de la identidad). Se dibujan una vez en el servidor. */
export function WaveLines({ className, lines = 22 }: { className?: string; lines?: number }) {
  const width = 1200;
  const height = 600;
  const paths = Array.from({ length: lines }, (_, i) => {
    const t = i / (lines - 1);
    const base = height * (0.08 + t * 0.9);
    const amp = 28 + 40 * Math.sin(t * Math.PI);
    const phase = t * 2.4;
    const points: string[] = [];
    for (let x = 0; x <= width; x += 24) {
      const k = x / width;
      const y = base + amp * Math.sin(k * Math.PI * 2.2 + phase) + amp * 0.45 * Math.sin(k * Math.PI * 5.1 - phase * 1.7);
      points.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`);
    }
    return points.join(" ");
  });
  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("pointer-events-none", className)}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
