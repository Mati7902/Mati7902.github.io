"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Lock, Send } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toDateKey } from "@/lib/dates";
import {
  answeredCount,
  type ContactValue,
  firstPendingStep,
  INTAKE_INPUT_COUNT,
  INTAKE_SECTIONS,
  INTAKE_STEPS,
  intakeAge,
  type IntakeAnswers,
  type IntakeQuestion,
  isInputQuestion,
  maxLength,
  questionLabel,
  withPrefill,
} from "@/lib/intake/form";
import { cn } from "@/lib/utils";
import { saveIntakeAction } from "@/server/actions/intake";

type Screen = { kind: "intro" } | { kind: "step"; index: number } | { kind: "review" } | { kind: "done" };

type Props = {
  initialAnswers: IntakeAnswers;
  /** Ya fue enviada alguna vez: los cambios se guardan sobre la ficha que ve el profesional. */
  submitted: boolean;
  /** Ya guardó un borrador antes (se ofrece seguir donde lo dejó). */
  hasDraft?: boolean;
  professionalName: string;
  firstName: string;
  /** Recién creó la cuenta (viene de la invitación). */
  welcome?: boolean;
  /** Parte en la que abrir (por ejemplo, desde «Editar» en la vista de la ficha). */
  startAt?: number | "review" | null;
  /** Recuadro «Si necesitás ayuda urgente» (se arma en el servidor con la configuración). */
  crisis?: ReactNode;
};

const TOTAL_STEPS = INTAKE_STEPS.length;

export function IntakeWizard({ initialAnswers, submitted, hasDraft = false, professionalName, firstName, welcome = false, startAt = null, crisis }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<IntakeAnswers>(initialAnswers);
  const [screen, setScreen] = useState<Screen>(() =>
    startAt === "review" ? { kind: "review" } : typeof startAt === "number" && INTAKE_STEPS[startAt] ? { kind: "step", index: startAt } : { kind: "intro" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [wasSubmitted, setWasSubmitted] = useState(submitted);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Al cambiar de pantalla: arriba de todo y el foco en el título (lectores de pantalla y teclado).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const update = (id: string, value: IntakeAnswers[string] | undefined) => {
    setAnswers((current) => {
      const next = { ...current };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    setDirty(true);
    if (errors[id]) setErrors(({ [id]: _removed, ...rest }) => rest);
  };

  const open = (target: Screen) => {
    if (target.kind === "step") {
      const step = INTAKE_STEPS[target.index]!;
      const prefilled = withPrefill(step, answers);
      if (prefilled !== answers) {
        setAnswers(prefilled);
        setDirty(true);
      }
    }
    setScreen(target);
  };

  /** Guarda (si hay cambios o hay que enviar) y recién después navega. */
  const saveThen = (target: Screen | "exit", submit = false) =>
    startTransition(async () => {
      if (dirty || submit) {
        const result = await saveIntakeAction({ answers, submit });
        if (!result.ok) {
          const fieldErrors = result.fieldErrors ?? {};
          setErrors(fieldErrors);
          const index = INTAKE_STEPS.findIndex((s) => s.questions.some((q) => fieldErrors[q.id]));
          if (index !== -1) setScreen({ kind: "step", index });
          toast.error(index !== -1 ? "Revisá lo marcado antes de seguir." : result.error);
          return;
        }
        setDirty(false);
        if (submit) setWasSubmitted(true);
      }
      if (target === "exit") {
        toast.success(wasSubmitted || submit ? "Cambios guardados." : "Guardado. Podés seguir cuando quieras.");
        router.push("/app");
        router.refresh();
        return;
      }
      open(target);
    });

  const answered = answeredCount(answers);
  const pendingStep = firstPendingStep(answers);

  if (screen.kind === "intro") {
    const started = hasDraft || wasSubmitted;
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-medium outline-none sm:text-3xl">
            {welcome ? `Tu cuenta está lista, ${firstName}.` : started ? "Seguí con tu ficha de ingreso" : "Tu ficha de ingreso"}
          </h2>
          <p className="text-lg text-muted-foreground">
            Antes de la primera sesión, {professionalName} te pide completar esta ficha: datos personales, tu historia de salud y cómo estás en distintas áreas de tu vida.
          </p>
        </div>
        <ul className="space-y-3 text-base">
          <Point>Son {TOTAL_STEPS} partes cortas, de a una por pantalla. Lleva unos 20 a 30 minutos y se guarda cada vez que avanzás: podés hacerla en varios momentos.</Point>
          <Point>Si alguna pregunta te incomoda o no sabés qué poner, dejala en blanco y la hablan en sesión.</Point>
          <Point icon={<Lock className="size-4" aria-hidden />}>
            La lee solo {professionalName}. No la ve la secretaria virtual de WhatsApp ni nadie más. Mientras no la envíes, es un borrador que ves solo vos.
          </Point>
        </ul>
        <p className="rounded-2xl border border-warning/40 bg-warning-soft/60 px-4 py-3 text-sm text-foreground">
          Esta ficha no se lee en el momento. Si estás en peligro o pensás en hacerte daño, no esperes a la sesión: en{" "}
          <Link href="/app/calmarme" className="font-medium text-primary underline underline-offset-2">Calmarme</Link> está el recuadro «Si necesitás ayuda urgente».
        </p>
        {started ? <ProgressLine answered={answered} /> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost">
            <Link href="/app">Completar más tarde</Link>
          </Button>
          {started ? (
            <Button size="lg" onClick={() => open(pendingStep === null ? { kind: "review" } : { kind: "step", index: pendingStep })}>
              Seguir donde lo dejé <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button size="lg" onClick={() => open({ kind: "step", index: 0 })}>
              Empezar <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (screen.kind === "done") {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint-50 text-mint-700">
          <CircleCheck className="size-8" aria-hidden />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-medium outline-none sm:text-3xl">
          Gracias, {firstName}.
        </h2>
        <p className="text-lg text-muted-foreground">
          Tu ficha de ingreso le llegó a {professionalName}. La va a leer antes de la sesión. Si querés cambiar algo, la encontrás en Mi perfil.
        </p>
        <Button asChild size="lg">
          <Link href="/app">Ir al inicio</Link>
        </Button>
      </div>
    );
  }

  if (screen.kind === "review") {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-medium outline-none sm:text-3xl">
            {wasSubmitted ? "Tu ficha" : "Revisá y enviá"}
          </h2>
          <p className="text-muted-foreground">
            {wasSubmitted ? "Elegí la parte que quieras cambiar. Lo que guardes lo ve " + professionalName + "." : "Podés volver a cualquier parte antes de enviarla."}
          </p>
        </div>
        <ProgressLine answered={answered} />
        <div className="space-y-6">
          {INTAKE_SECTIONS.map((section) => (
            <section key={section.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {section.roman}. {section.title}
              </h3>
              <ul className="divide-y divide-divider rounded-2xl border border-border/70 bg-card">
                {INTAKE_STEPS.map((step, index) => ({ step, index }))
                  .filter(({ step }) => step.section === section.key)
                  .map(({ step, index }) => {
                    const inputs = step.questions.filter(isInputQuestion);
                    const done = answeredCount(answers, step.questions);
                    return (
                      <li key={step.id}>
                        <button
                          type="button"
                          onClick={() => open({ kind: "step", index })}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-surface-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">{step.title}</span>
                            <span className="block text-sm text-muted-foreground">
                              {done === 0 ? "Sin respuestas" : `${done} de ${inputs.length} respondidas`}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium text-primary">Revisar</span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
        <div className="space-y-4 rounded-2xl bg-primary-soft/60 px-5 py-4 text-sm text-foreground">
          <p>
            {wasSubmitted
              ? `Cuando termines, tocá «Enviar cambios» y ${professionalName} va a recibir un aviso.`
              : `Al enviarla, ${professionalName} va a recibir un aviso y la va a leer antes de la sesión. Después la podés actualizar desde Mi perfil.`}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => saveThen("exit")} disabled={pending}>
            Guardar y salir
          </Button>
          <Button size="lg" onClick={() => saveThen({ kind: "done" }, true)} loading={pending}>
            <Send aria-hidden /> {wasSubmitted ? "Enviar cambios" : "Enviar ficha"}
          </Button>
        </div>
      </div>
    );
  }

  const index = screen.index;
  const step = INTAKE_STEPS[index]!;
  const section = INTAKE_SECTIONS.find((s) => s.key === step.section)!;
  const isLast = index === TOTAL_STEPS - 1;
  const showCrisis = step.questions.some((q) => q.sensitive);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <Progress value={((index + 1) / TOTAL_STEPS) * 100} aria-label={`Parte ${index + 1} de ${TOTAL_STEPS}`} />
        <p className="text-xs text-muted-foreground">
          {section.roman}. {section.title} · Parte {index + 1} de {TOTAL_STEPS}
        </p>
      </div>
      <div key={step.id} className="animate-fade-up space-y-8">
        <div className="space-y-2">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-medium outline-none sm:text-3xl">
            {step.title}
          </h2>
          {step.lead ? <p className="text-lg text-primary">{step.lead}</p> : null}
          {step.intro ? <p className="text-muted-foreground">{step.intro}</p> : null}
        </div>
        <div className="space-y-7">
          {step.questions.map((q) => (
            <div key={q.id} className="space-y-4">
              <Field question={q} answers={answers} error={errors[q.id]} onChange={(value) => update(q.id, value)} />
              {q.sensitive && showCrisis ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Esta ficha no se lee en el momento. Si hoy tenés ideas de hacerte daño o de quitarte la vida, no esperes a la sesión: pedí ayuda ya.
                  </p>
                  {crisis}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => saveThen(index === 0 ? { kind: "intro" } : { kind: "step", index: index - 1 })} disabled={pending}>
            <ArrowLeft aria-hidden /> Atrás
          </Button>
          <Button type="button" variant="outline" onClick={() => saveThen("exit")} disabled={pending}>
            Guardar y salir
          </Button>
        </div>
        <Button type="button" size="lg" onClick={() => saveThen(isLast ? { kind: "review" } : { kind: "step", index: index + 1 })} loading={pending}>
          {isLast ? (
            <>
              <Check aria-hidden /> Revisar y enviar
            </>
          ) : (
            <>
              Siguiente <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Point({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Check className="size-3.5" />}
      </span>
      <span className="text-foreground">{children}</span>
    </li>
  );
}

function ProgressLine({ answered }: { answered: number }) {
  return (
    <div className="space-y-2">
      <Progress value={(answered / INTAKE_INPUT_COUNT) * 100} aria-label={`${answered} de ${INTAKE_INPUT_COUNT} preguntas respondidas`} />
      <p className="text-sm text-muted-foreground">
        Respondiste {answered} de {INTAKE_INPUT_COUNT} preguntas.
      </p>
    </div>
  );
}

type FieldProps = {
  question: IntakeQuestion;
  answers: IntakeAnswers;
  error?: string;
  onChange: (value: IntakeAnswers[string] | undefined) => void;
};

function Field({ question: q, answers, error, onChange }: FieldProps) {
  const id = `ficha-${q.id}`;
  const label = questionLabel(q, "patient");
  const describedBy = [q.help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const value = answers[q.id];
  const help = q.help ? (
    <p id={`${id}-help`} className="text-sm text-muted-foreground">
      {q.help}
    </p>
  ) : null;
  const errorText = error ? (
    <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;

  if (q.type === "age") {
    const age = intakeAge(answers);
    return (
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {age === null ? "La calculamos con tu fecha de nacimiento." : `${age} años`}
        </p>
      </div>
    );
  }

  if (q.type === "scale" || q.type === "choice") {
    const options = q.type === "scale" ? Array.from({ length: q.max - q.min + 1 }, (_, i) => String(q.min + i)) : q.options;
    const current = value === undefined ? undefined : String(value);
    return (
      <fieldset className="space-y-3" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className="text-base font-medium text-foreground">{label}</legend>
        {help}
        <div className={cn(q.type === "scale" ? "grid grid-cols-5 gap-2 sm:grid-cols-10" : "grid gap-2.5 sm:grid-cols-2")}>
          {options.map((option) => (
            <label key={option} className="relative">
              <input
                type="radio"
                name={id}
                value={option}
                checked={current === option}
                onChange={() => onChange(q.type === "scale" ? Number(option) : option)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-12 cursor-pointer items-center rounded-xl border border-border bg-card px-4 text-base font-medium transition-colors hover:bg-surface-muted",
                  "peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
                  q.type === "scale" ? "justify-center px-0 tabular-nums" : "py-3",
                )}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
        {q.type === "scale" ? (
          <div className="flex justify-between text-xs text-subtle-foreground">
            <span>
              {q.min}: {q.minLabel}
            </span>
            <span>
              {q.max}: {q.maxLabel}
            </span>
          </div>
        ) : null}
        {current !== undefined ? (
          <button type="button" onClick={() => onChange(undefined)} className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Quitar respuesta
          </button>
        ) : null}
        {errorText}
      </fieldset>
    );
  }

  if (q.type === "contact") {
    const contact = (value && typeof value === "object" ? value : {}) as ContactValue;
    const set = (key: keyof ContactValue, v: string) => {
      const next = { ...contact, [key]: v };
      onChange(next.nombre || next.telefono ? next : undefined);
    };
    return (
      <fieldset className="space-y-3" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className="text-base font-medium text-foreground">{label}</legend>
        {help}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-nombre`} className="text-sm text-muted-foreground">
              Nombre y vínculo
            </label>
            <Input id={`${id}-nombre`} value={contact.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej.: Ana Pérez, mi hermana" maxLength={160} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-telefono`} className="text-sm text-muted-foreground">
              Teléfono
            </label>
            <Input
              id={`${id}-telefono`}
              type="tel"
              inputMode="tel"
              value={contact.telefono ?? ""}
              onChange={(e) => set("telefono", e.target.value)}
              placeholder="0981 123 456"
              maxLength={30}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
            />
          </div>
        </div>
        {errorText}
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  const max = maxLength(q);
  const common = {
    id,
    value: text,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    placeholder: q.placeholder,
  };
  let control: ReactNode;
  if (q.type === "date") {
    control = <Input {...common} type="date" max={toDateKey(new Date())} className="sm:max-w-xs" />;
  } else if (q.type === "phone") {
    control = <Input {...common} type="tel" inputMode="tel" autoComplete="tel" maxLength={max} className="sm:max-w-xs" />;
  } else if (q.type === "text" && max <= 300) {
    control = <Input {...common} maxLength={max} autoComplete={q.id === "nombre" ? "name" : "off"} />;
  } else {
    control = <Textarea {...common} maxLength={max} rows={q.type === "long" ? 4 : 2} className={q.type === "long" ? "min-h-28" : "min-h-16"} />;
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-base font-medium text-foreground">
        {label}
      </label>
      {help}
      {control}
      {errorText}
    </div>
  );
}
