"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Multiplica la cantidad de neuronas (1 = densidad normal). */
  density?: number;
  /** Las neuronas cercanas al puntero se acercan y se conectan con él (solo con mouse). */
  interactive?: boolean;
  /** "brand" sobre fondos claros; "light" (neuronas claras) sobre el color principal. */
  tone?: "brand" | "light";
};

type Node = { x: number; y: number; vx: number; vy: number; r: number; glow: number; hub: boolean };
type Pulse = { from: number; to: number; t: number; speed: number; depth: number };

/** "#1f4e5f" → [31, 78, 95]. Cualquier color CSS se normaliza con el propio canvas. */
function toRgb(ctx: CanvasRenderingContext2D, color: string, fallback: [number, number, number]): [number, number, number] {
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  const value = String(ctx.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : fallback;
}

/**
 * Red de neuronas animada (canvas): nodos que derivan despacio, conexiones entre vecinos y
 * impulsos que viajan por las conexiones y a veces se propagan, como sinapsis.
 * Toma los colores de la marca (--primary y --accent), se pausa fuera de pantalla o con la
 * pestaña oculta y respeta "reducir movimiento" (queda una imagen fija).
 */
export function NeuralField({ className, density = 1, interactive = true, tone = "brand" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const styles = getComputedStyle(canvas);
    const primary: [number, number, number] =
      tone === "light" ? [255, 255, 255] : toRgb(ctx, styles.getPropertyValue("--primary").trim() || "#1f4e5f", [31, 78, 95]);
    const accent = toRgb(ctx, styles.getPropertyValue("--accent").trim() || "#a8dccb", [168, 220, 203]);
    const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    let width = 0;
    let height = 0;
    let maxDist = 140;
    let nodes: Node[] = [];
    let neighbors: number[][] = [];
    const pulses: Pulse[] = [];
    const pointer = { x: -9999, y: -9999, active: false };
    let frame = 0;
    let raf = 0;
    let onScreen = true;
    let lastSpawn = 0;
    let last = performance.now();

    function seed() {
      const area = width * height;
      const count = Math.max(16, Math.min(110, Math.round((area / 11000) * density)));
      maxDist = Math.max(110, Math.min(170, Math.sqrt(area / count) * 1.9));
      nodes = Array.from({ length: count }, () => {
        const hub = Math.random() < 0.12;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: hub ? 2.6 + Math.random() * 1.4 : 1.2 + Math.random() * 1.2,
          glow: 0,
          hub,
        };
      });
      updateNeighbors();
    }

    function updateNeighbors() {
      neighbors = nodes.map(() => []);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          if (Math.hypot(a.x - b.x, a.y - b.y) < maxDist) {
            neighbors[i]!.push(j);
            neighbors[j]!.push(i);
          }
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const changed = Math.abs(rect.width - width) > 40 || Math.abs(rect.height - height) > 40 || nodes.length === 0;
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (changed) seed();
      draw();
    }

    function fire(from: number, depth: number) {
      const options = neighbors[from];
      if (!options || options.length === 0) return;
      const to = options[Math.floor(Math.random() * options.length)]!;
      pulses.push({ from, to, t: 0, speed: 0.0009 + Math.random() * 0.0008, depth });
    }

    function step(dt: number, now: number) {
      for (const n of nodes) {
        if (interactive && pointer.active) {
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 180 && d > 1) {
            n.vx += (dx / d) * 0.0025;
            n.vy += (dy / d) * 0.0025;
          }
        }
        n.vx = Math.max(-0.3, Math.min(0.3, n.vx * 0.995));
        n.vy = Math.max(-0.3, Math.min(0.3, n.vy * 0.995));
        n.x += n.vx * dt * 0.06;
        n.y += n.vy * dt * 0.06;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
        n.glow = Math.max(0, n.glow - dt * 0.0016);
      }
      if (frame % 20 === 0) updateNeighbors();

      // Un impulso nuevo cada 0,3–0,8 s, más seguido en los nodos "hub".
      if (now - lastSpawn > 300 + Math.random() * 500 && pulses.length < 24) {
        lastSpawn = now;
        const hubs = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
        const pool = hubs.length && Math.random() < 0.6 ? hubs : nodes.map((_, i) => i);
        const origin = pool[Math.floor(Math.random() * pool.length)]!;
        nodes[origin]!.glow = 1;
        fire(origin, 0);
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!;
        p.t += p.speed * dt;
        if (p.t >= 1) {
          pulses.splice(i, 1);
          const target = nodes[p.to];
          if (!target) continue;
          target.glow = 1;
          // La señal sigue a otra neurona con probabilidad decreciente (cadena de sinapsis).
          if (p.depth < 4 && Math.random() < 0.62 - p.depth * 0.1) fire(p.to, p.depth + 1);
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // Conexiones
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (const j of neighbors[i] ?? []) {
          if (j < i) continue;
          const b = nodes[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d >= maxDist) continue;
          const alpha = (1 - d / maxDist) * 0.28 + Math.max(a.glow, b.glow) * 0.25;
          ctx!.strokeStyle = rgba(primary, alpha);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
        if (interactive && pointer.active) {
          const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (d < 160) {
            ctx!.strokeStyle = rgba(accent, (1 - d / 160) * 0.55);
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(pointer.x, pointer.y);
            ctx!.stroke();
          }
        }
      }

      // Impulsos: un punto brillante con una estela corta sobre la conexión.
      for (const p of pulses) {
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const tail = Math.max(0, p.t - 0.18);
        const gradient = ctx!.createLinearGradient(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail, x, y);
        gradient.addColorStop(0, rgba(accent, 0));
        gradient.addColorStop(1, rgba(accent, 0.9));
        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
        ctx!.lineTo(x, y);
        ctx!.stroke();
        ctx!.lineWidth = 1;
        ctx!.fillStyle = rgba(accent, 0.95);
        ctx!.beginPath();
        ctx!.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Neuronas
      for (const n of nodes) {
        if (n.glow > 0.02) {
          const halo = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 7);
          halo.addColorStop(0, rgba(accent, 0.55 * n.glow));
          halo.addColorStop(1, rgba(accent, 0));
          ctx!.fillStyle = halo;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.r * 7, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = n.hub ? rgba(primary, 0.8) : rgba(primary, 0.55);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r + n.glow * 1.2, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function loop(now: number) {
      const dt = Math.min(48, now - last);
      last = now;
      frame++;
      step(dt, now);
      draw();
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (reduceMotion || raf || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      if (onScreen) start();
      else stop();
    });
    intersection.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const host = canvas.parentElement ?? canvas;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    if (interactive && finePointer && !reduceMotion) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }

    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [density, interactive, tone]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none block size-full", className)} />;
}
