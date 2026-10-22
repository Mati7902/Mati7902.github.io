"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCopy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Answers, scoreTest, summaryText } from "@/lib/guia/scoring";
import type { Level, TestDef } from "@/lib/guia/types";
import { cn } from "@/lib/utils";

const LEVEL_BADGE: Record<Level, "success" | "warning" | "destructive" | "muted"> = { ok: "success", warn: "warning", crit: "destructive", neu: "muted" };
const LEVEL_BOX: Record<Level, string> = {
  ok: "border-success/40 bg-success-soft",
  warn: "border-warning/40 bg-warning-soft",
  crit: "border-destructive/40 bg-destructive/10",
  neu: "border-border bg-surface-muted",
};

/**
 * Aplicador de un test. Las respuestas viven solo en esta pantalla: no se guardan ni se envían a
 * ningún servidor, no quedan asociadas a un paciente. El resultado se copia a mano a la nota.
 */
export function TestRunner({ def }: { def: TestDef }) {
  const [answers, setAnswers] = useState<Answers>({});
  const result = useMemo(() => scoreTest(def, answers), [def, answers]);
  const asq = result.asq;
  // ASQ: el ítem 5 solo se pregunta si hay un «sí» (o falta respuesta) en los ítems 1 a 4.
  const showQ5 = def.kind !== "asq" || [0, 1, 2, 3].some((i) => answers[i] === "si" || answers[i] === "nr");

  const set = (i: number, v: string) => setAnswers((a) => ({ ...a, [i]: v }));
  const text = summaryText(def, answers, result);
  const hasAny = result.answered > 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resultado copiado. Pegalo en la nota o en el HIS.");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{def.intro}</p>

      <ol className="space-y-3">
        {def.items.map((item, i) => {
          if (i === 4 && def.kind === "asq" && !showQ5) return null;
          const name = `${def.id}-${i}`;
          return (
            <li key={i} className="rounded-2xl border border-border/70 bg-card p-4">
              <fieldset>
                <legend className="mb-2 text-[15px] leading-snug text-foreground">
                  <span className="mr-1.5 font-semibold text-primary">{i + 1}.</span>
                  {item.text}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {def.options.map((o) => {
                    const checked = answers[i] === o.value;
                    return (
                      <label
                        key={o.value}
                        className={cn(
                          "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                          checked ? "border-primary bg-primary-soft font-medium text-primary" : "border-border bg-card hover:bg-surface-muted",
                        )}
                      >
                        <input type="radio" name={name} value={o.value} checked={checked} onChange={() => set(i, o.value)} className="sr-only" />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <section aria-live="polite" className={cn("space-y-3 rounded-2xl border p-5", LEVEL_BOX[asq?.level ?? result.band?.level ?? "neu"])}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-medium text-foreground">Resultado</h2>
          <Badge variant="muted">
            {result.answered}/{result.total} respondidos
          </Badge>
        </div>

        {asq ? (
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              {asq.label} <Badge variant={LEVEL_BADGE[asq.level]}>{asq.level === "crit" ? "urgente" : asq.level === "warn" ? "atención" : asq.level === "ok" ? "negativo" : "pendiente"}</Badge>
            </p>
            <p className="text-sm">{asq.detail}</p>
          </div>
        ) : result.tipi ? (
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {result.tipi.map((d) => (
              <li key={d.name} className="flex justify-between gap-3 rounded-lg bg-card/70 px-3 py-1.5">
                <span>{d.name}</span>
                <span className="font-semibold tabular-nums">{d.value === null ? "—" : d.value.toFixed(1).replace(".", ",")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1">
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {result.score}
              <span className="text-base font-normal text-muted-foreground"> / {def.max}</span>
            </p>
            {result.band ? (
              <div className="space-y-1.5">
                <Badge variant={LEVEL_BADGE[result.band.level]}>{result.band.level === "ok" ? "dentro de lo esperado" : result.band.level === "warn" ? "atención" : "clínicamente relevante"}</Badge>
                <p className="text-sm font-medium">{result.band.label}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Completá todos los ítems para ver la interpretación.</p>
            )}
            {result.extras.map((e) => (
              <p key={e} className="text-sm">
                {e}.
              </p>
            ))}
          </div>
        )}

        {result.flags.map((f) => (
          <p key={f.text} role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-card px-3 py-2 text-sm font-medium text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {f.text}
          </p>
        ))}

        {def.note ? <p className="text-sm text-muted-foreground">{def.note}</p> : null}

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" onClick={copy} disabled={!hasAny}>
            <ClipboardCopy aria-hidden /> Copiar resultado
          </Button>
          <Button type="button" variant="outline" onClick={() => setAnswers({})} disabled={!hasAny}>
            <RotateCcw aria-hidden /> Borrar respuestas
          </Button>
        </div>
        {hasAny ? <p className="rounded-lg bg-card/70 px-3 py-2 text-xs text-muted-foreground">{text}</p> : null}
      </section>
    </div>
  );
}
