"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  cleanQuote,
  CONTEXT_MAX,
  identifyingData,
  identifyingDataMessage,
  isTestimonialGender,
  LANDING_TESTIMONIALS,
  QUOTE_MAX,
  QUOTE_MIN,
  TESTIMONIAL_EMOJI,
  TESTIMONIAL_GENDERS,
  TESTIMONIAL_LABEL,
  type TestimonialGender,
  textLength,
} from "@/lib/testimonials";
import { cn } from "@/lib/utils";
import { deleteTestimonialAction, saveTestimonialAction } from "@/server/actions/admin-settings";
import type { Testimonial } from "@/types/domain";

type Fields = { gender: TestimonialGender | ""; quote: string; context: string; sort_order: number; consent_confirmed: boolean; is_published: boolean };
type Row = Fields & { key: string; id?: string; saved: Fields | null };

const fieldsOf = (t: Testimonial): Fields => ({
  gender: isTestimonialGender(t.gender) ? t.gender : "",
  quote: t.quote,
  context: t.context ?? "",
  sort_order: t.sort_order,
  consent_confirmed: t.consent_confirmed,
  is_published: t.is_published,
});

const pick = ({ gender, quote, context, sort_order, consent_confirmed, is_published }: Fields): Fields => ({ gender, quote, context, sort_order, consent_confirmed, is_published });
const sameFields = (a: Fields, b: Fields) => (Object.keys(a) as (keyof Fields)[]).every((k) => a[k] === b[k]);
// Lo que la persona autorizó: si cambia, hay que volver a confirmar la autorización.
const TEXT_FIELDS = ["gender", "quote", "context"] as const;
const textChanged = (a: Fields, b: Fields) => TEXT_FIELDS.some((k) => a[k] !== b[k]);

/**
 * Testimonios anónimos de la portada. Solo se cargan testimonios reales, con la autorización
 * escrita de la persona; sin autorización confirmada no se pueden publicar (lo controla también la base).
 */
export function TestimonialsEditor({ testimonials }: { testimonials: Testimonial[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => testimonials.map((t) => ({ key: t.id, id: t.id, ...fieldsOf(t), saved: fieldsOf(t) })));
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trashRefs = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const publishedCount = rows.filter((r) => r.saved?.is_published).length;

  const update = (key: string, patch: Partial<Fields>) => {
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        // Si cambia lo que la persona autorizó, la autorización se vuelve a confirmar.
        if (r.saved?.consent_confirmed && TEXT_FIELDS.some((k) => k in patch) && textChanged(next, r.saved)) next.consent_confirmed = false;
        // Sin autorización no se publica.
        if (!next.consent_confirmed) next.is_published = false;
        return next;
      }),
    );
    // Los errores del servidor se van al corregir el campo.
    setErrors((all) => {
      const current = { ...(all[key] ?? {}) };
      for (const field of Object.keys(patch)) delete current[field];
      if ("is_published" in patch || "consent_confirmed" in patch) delete current.consent_confirmed;
      return { ...all, [key]: current };
    });
  };

  const save = (row: Row) =>
    startTransition(async () => {
      const res = await saveTestimonialAction({
        id: row.id,
        gender: row.gender as TestimonialGender,
        quote: row.quote,
        context: row.context,
        sort_order: row.sort_order,
        consent_confirmed: row.consent_confirmed,
        is_published: row.is_published,
      });
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.key]: res.fieldErrors ?? {} }));
        return void toast.error(res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error);
      }
      setErrors((e) => ({ ...e, [row.key]: {} }));
      // Lo que quedó guardado (sin las comillas ni los espacios que limpia el servidor).
      const saved = pick({ ...row, quote: cleanQuote(row.quote), context: row.context.trim() });
      // Si se siguió editando mientras se guardaba, se conserva lo nuevo (y queda como cambio sin guardar).
      setRows((list) => list.map((r) => (r.key !== row.key ? r : { ...r, ...(sameFields(pick(r), pick(row)) ? saved : {}), id: res.data.id, saved })));
      toast.success(row.is_published ? "Testimonio publicado." : "Testimonio guardado (no se ve en la web).");
      router.refresh();
    });

  const remove = (row: Row) =>
    startTransition(async () => {
      if (row.id) {
        const res = await deleteTestimonialAction(row.id);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Testimonio eliminado.");
      }
      setConfirmDelete(null);
      setRows((list) => list.filter((r) => r.key !== row.key));
      requestAnimationFrame(() => addRef.current?.focus());
      router.refresh();
    });

  const cancelDelete = (key: string) => {
    setConfirmDelete(null);
    requestAnimationFrame(() => trashRefs.current.get(key)?.focus());
  };

  const add = () =>
    setRows((list) => [
      ...list,
      { key: `nuevo-${Date.now()}`, gender: "", quote: "", context: "", sort_order: list.length + 1, consent_confirmed: false, is_published: false, saved: null },
    ]);

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <AlertTitle>Solo testimonios reales y autorizados</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            <li>Usá las palabras de la persona. Si acortás o corregís algo, que apruebe la versión final (al cambiar el texto, la app te pide confirmar de nuevo la autorización).</li>
            <li>
              Pedilo cuando el proceso terminó, sin presión y aclarando que decir que no no cambia nada. Muchos códigos de ética (por ejemplo, la norma 5.05 del código de la APA) piden no solicitar
              testimonios a pacientes en tratamiento ni a otras personas que, por su situación, puedan sentirse presionadas a aceptar. Revisá lo que dice el código que te rige.
            </li>
            <li>Con menores de edad, conviene no pedirlos; si igual se publica uno, hace falta también la autorización escrita de madre, padre o tutor.</li>
            <li>Guardá la autorización escrita (un formulario firmado o un mensaje). Si la persona la retira, desmarcá la autorización (se despublica sola) o eliminá el testimonio.</li>
            <li>Nada que permita reconocerla: ni nombre, iniciales, edad exacta, barrio, trabajo, fechas o situaciones muy particulares. En la web solo se ve 👩 o 👨.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">
        La sección aparece en la portada, después de «Cómo funciona», cuando hay al menos un testimonio publicado. Se ven hasta {LANDING_TESTIMONIALS}, por orden, con un aviso de que cada
        proceso es distinto.
        {publishedCount > LANDING_TESTIMONIALS ? ` Tenés ${publishedCount} publicados: los que quedan después del ${LANDING_TESTIMONIALS}.º no se muestran.` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Todavía no cargaste testimonios.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const rowErrors = errors[row.key] ?? {};
            const quoteFound = identifyingData(row.quote);
            const contextFound = identifyingData(row.context);
            const quoteError = quoteFound.length ? identifyingDataMessage(quoteFound) : rowErrors.quote;
            const contextError = contextFound.length ? identifyingDataMessage(contextFound) : rowErrors.context;
            const dirty = !row.saved || !sameFields(pick(row), row.saved);
            const quoteLength = textLength(cleanQuote(row.quote));
            const reconfirm = Boolean(row.saved?.consent_confirmed && !row.consent_confirmed && textChanged(row, row.saved));
            const id = (field: string) => `testimonio-${row.key}-${field}`;
            return (
              <li key={row.key} className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Testimonio {index + 1}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {row.saved?.is_published ? <Badge variant="success">Publicado</Badge> : row.saved?.consent_confirmed ? <Badge variant="muted">No publicado</Badge> : <Badge variant="warning">Sin autorización confirmada</Badge>}
                    {dirty ? <Badge variant="info">{row.saved ? "Cambios sin guardar" : "Sin guardar"}</Badge> : null}
                  </div>
                </div>

                <fieldset className="space-y-2" aria-describedby={rowErrors.gender ? id("gender-error") : undefined}>
                  <legend className="text-sm font-medium">En la web se muestra como</legend>
                  <div className="flex flex-wrap gap-2">
                    {TESTIMONIAL_GENDERS.map((g) => (
                      <label
                        key={g}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-input px-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40"
                      >
                        <input type="radio" name={id("gender")} value={g} checked={row.gender === g} onChange={() => update(row.key, { gender: g })} className="sr-only" />
                        <span aria-hidden className="text-xl">
                          {TESTIMONIAL_EMOJI[g]}
                        </span>
                        {TESTIMONIAL_LABEL[g]}
                      </label>
                    ))}
                  </div>
                  {rowErrors.gender ? (
                    <p id={id("gender-error")} role="alert" className="text-xs font-medium text-destructive">
                      {rowErrors.gender}
                    </p>
                  ) : null}
                </fieldset>

                <FormField id={id("quote")} label="Testimonio" hint={`Qué cambió a partir de la terapia, con sus palabras (entre ${QUOTE_MIN} y ${QUOTE_MAX} caracteres). Sin comillas: la web ya lo muestra como cita.`} error={quoteError}>
                  <Textarea
                    id={id("quote")}
                    value={row.quote}
                    maxLength={QUOTE_MAX * 2}
                    onChange={(e) => update(row.key, { quote: e.target.value })}
                    aria-invalid={quoteError ? true : undefined}
                    aria-describedby={`${quoteError ? id("quote-error") : id("quote-hint")} ${id("quote-count")}`}
                    className="min-h-28"
                  />
                </FormField>
                <p id={id("quote-count")} className={cn("-mt-2 text-right text-xs tabular-nums", (quoteLength > 0 && quoteLength < QUOTE_MIN) || quoteLength > QUOTE_MAX ? "text-destructive" : "text-subtle-foreground")}>
                  {quoteLength}/{QUOTE_MAX}
                </p>

                <FormField id={id("context")} label="Contexto" optional hint="Por ejemplo: «Después de cinco meses de terapia» o «Consultó por ansiedad». Se ve debajo del testimonio." error={contextError}>
                  <Input
                    id={id("context")}
                    value={row.context}
                    maxLength={CONTEXT_MAX}
                    onChange={(e) => update(row.key, { context: e.target.value })}
                    aria-invalid={contextError ? true : undefined}
                    aria-describedby={contextError ? id("context-error") : id("context-hint")}
                  />
                </FormField>

                <div className="space-y-3 rounded-xl bg-surface-muted p-3">
                  <label htmlFor={id("consent")} className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      id={id("consent")}
                      checked={row.consent_confirmed}
                      onCheckedChange={(v) => update(row.key, { consent_confirmed: v === true })}
                      className="mt-0.5"
                      aria-describedby={rowErrors.consent_confirmed ? id("consent-error") : reconfirm ? id("consent-reconfirm") : undefined}
                    />
                    <span>Tengo la autorización escrita de esta persona (y de quien la representa, si es menor) para publicar este texto de forma anónima.</span>
                  </label>
                  {reconfirm && !rowErrors.consent_confirmed ? (
                    <p id={id("consent-reconfirm")} className="text-xs font-medium text-[#7a5614]">
                      Cambiaste el texto: volvé a confirmar que la persona aprobó esta versión.{row.saved?.is_published ? " Hasta que guardes, en la web sigue el texto anterior." : ""}
                    </p>
                  ) : null}
                  {rowErrors.consent_confirmed ? (
                    <p id={id("consent-error")} role="alert" className="text-xs font-medium text-destructive">
                      {rowErrors.consent_confirmed}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3 text-sm">
                    <Switch id={id("published")} checked={row.is_published} disabled={!row.consent_confirmed} onCheckedChange={(v) => update(row.key, { is_published: v })} />
                    <label htmlFor={id("published")} className={cn(!row.consent_confirmed && "text-muted-foreground")}>
                      Publicar en la portada{row.consent_confirmed ? "" : " (primero confirmá la autorización)"}
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    Orden
                    <Input type="number" min={0} max={999} value={row.sort_order} onChange={(e) => update(row.key, { sort_order: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} className="h-9 w-20" />
                  </label>
                  {confirmDelete === row.key ? (
                    <div key="confirmar" className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={`Confirmar eliminación del testimonio ${index + 1}`}>
                      <span>¿Eliminar este testimonio?</span>
                      {/* El foco va a «Cancelar»: borrar exige elegir «Eliminar» a propósito. */}
                      <Button size="sm" variant="ghost" onClick={() => cancelDelete(row.key)} disabled={pending} autoFocus>
                        Cancelar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(row)} disabled={pending}>
                        Eliminar
                      </Button>
                    </div>
                  ) : (
                    <div key="acciones" className="flex gap-1">
                      <Button size="sm" onClick={() => save(row)} disabled={pending || !dirty || quoteFound.length > 0 || contextFound.length > 0}>
                        {row.is_published && !row.saved?.is_published ? "Guardar y publicar" : "Guardar"}
                      </Button>
                      <Button
                        ref={(el) => {
                          if (el) trashRefs.current.set(row.key, el);
                          else trashRefs.current.delete(row.key);
                        }}
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(row.key)}
                        disabled={pending}
                        aria-label={`Eliminar testimonio ${index + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sin deshabilitar mientras se guarda: agregar una fila no toca el servidor y recibe el foco al eliminar. */}
      <Button ref={addRef} variant="outline" onClick={add}>
        <Plus aria-hidden /> Agregar testimonio
      </Button>
    </div>
  );
}
