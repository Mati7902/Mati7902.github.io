"use client";

import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toDateKey } from "@/lib/dates";
import { ageFrom } from "@/lib/exercises/collections";
import { signConsentAction } from "@/server/actions/consent";

type Props = {
  version: string;
  sessions: number;
  professionalName: string;
  defaultName: string;
  /** Menor de 18 años: también firma (escribe su nombre) quien autoriza. */
  minor: boolean;
  /** La ficha no tiene fecha de nacimiento: se pide para saber si firma como menor. */
  askBirthDate?: boolean;
  defaultGuardian?: string | null;
  /** Viene de crear la cuenta: la ficha de ingreso sigue con la bienvenida. */
  welcome?: boolean;
};

export function ConsentSignForm({ version, sessions, professionalName, defaultName, minor: minorByRecord, askBirthDate = false, defaultGuardian, welcome = false }: Props) {
  const router = useRouter();
  const id = useId();
  const [acceptTreatment, setAcceptTreatment] = useState(false);
  const [acceptCommitment, setAcceptCommitment] = useState(false);
  const [guardianAgrees, setGuardianAgrees] = useState(false);
  const [signedName, setSignedName] = useState(defaultName);
  const [guardianName, setGuardianName] = useState(defaultGuardian ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Sin fecha en la ficha, la edad escrita acá decide si hace falta quien autoriza.
  const typedAge = askBirthDate && birthDate ? ageFrom(birthDate) : null;
  const minor = typedAge !== null ? typedAge < 18 : minorByRecord;
  const [pending, startTransition] = useTransition();

  const clear = (key: string) => setErrors(({ [key]: _removed, ...rest }) => rest);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof signConsentAction>>;
      try {
        result = await signConsentAction({ version, signedName, guardianName, acceptTreatment, acceptCommitment, guardianAgrees, ...(askBirthDate ? { birthDate } : {}) });
      } catch {
        toast.error("No pudimos guardar tu firma. Revisá tu conexión e intentá de nuevo.");
        return;
      }
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.fieldErrors ? "Revisá lo marcado antes de firmar." : result.error);
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
        return;
      }
      toast.success("Listo, quedó firmado.");
      const next = result.data.next;
      router.push(welcome && next === "/app/ingreso" ? "/app/ingreso?bienvenida=1" : next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-3xl border border-primary/15 bg-primary-soft/40 p-6 sm:p-8">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-medium">Firma</h2>
        <p className="text-sm text-muted-foreground">Si tenés dudas, escribile a {professionalName} antes de firmar. Después de firmar sigue la ficha de ingreso.</p>
      </div>

      <div className="space-y-3">
        <Check
          id={`${id}-acceptTreatment`}
          checked={acceptTreatment}
          onChange={(v) => {
            setAcceptTreatment(v);
            clear("acceptTreatment");
          }}
          error={errors.acceptTreatment}
          label="Leí el consentimiento informado, pude hacer preguntas y acepto iniciar el tratamiento."
        />
        <Check
          id={`${id}-acceptCommitment`}
          checked={acceptCommitment}
          onChange={(v) => {
            setAcceptCommitment(v);
            clear("acceptCommitment");
          }}
          error={errors.acceptCommitment}
          label={`Me comprometo a asistir a las primeras ${sessions} sesiones y, si decido interrumpir antes, a hablarlo en una sesión de cierre.`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`${id}-signedName`} className="block text-base font-medium text-foreground">
          Tu nombre completo
        </label>
        <p id={`${id}-signedName-help`} className="text-sm text-muted-foreground">
          Escribirlo vale como tu firma.
        </p>
        <Input
          id={`${id}-signedName`}
          value={signedName}
          onChange={(e) => {
            setSignedName(e.target.value);
            clear("signedName");
          }}
          maxLength={160}
          autoComplete="name"
          aria-invalid={errors.signedName ? true : undefined}
          aria-describedby={errors.signedName ? `${id}-signedName-error` : `${id}-signedName-help`}
          className="font-display text-lg italic"
        />
        {errors.signedName ? (
          <p id={`${id}-signedName-error`} role="alert" className="text-sm font-medium text-destructive">
            {errors.signedName}
          </p>
        ) : null}
      </div>

      {askBirthDate ? (
        <div className="space-y-2">
          <label htmlFor={`${id}-birthDate`} className="block text-base font-medium text-foreground">
            Tu fecha de nacimiento
          </label>
          <p id={`${id}-birthDate-help`} className="text-sm text-muted-foreground">
            La necesitamos para saber si, por ser menor de edad, también lo autoriza una persona adulta.
          </p>
          <Input
            id={`${id}-birthDate`}
            type="date"
            max={toDateKey(new Date())}
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value);
              clear("birthDate");
            }}
            aria-invalid={errors.birthDate ? true : undefined}
            aria-describedby={errors.birthDate ? `${id}-birthDate-error` : `${id}-birthDate-help`}
            className="sm:max-w-xs"
          />
          {errors.birthDate ? (
            <p id={`${id}-birthDate-error`} role="alert" className="text-sm font-medium text-destructive">
              {errors.birthDate}
            </p>
          ) : null}
        </div>
      ) : null}

      {minor ? (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Como tenés menos de 18 años, también lo autoriza tu madre, padre o tutor</p>
            <p className="text-sm text-muted-foreground">Leanlo juntos. {professionalName} va a confirmar la autorización con esa persona.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-guardianName`} className="block text-sm font-medium text-foreground">
              Nombre completo de tu madre, padre o tutor
            </label>
            <Input
              id={`${id}-guardianName`}
              value={guardianName}
              onChange={(e) => {
                setGuardianName(e.target.value);
                clear("guardianName");
              }}
              maxLength={160}
              autoComplete="off"
              aria-invalid={errors.guardianName ? true : undefined}
              aria-describedby={errors.guardianName ? `${id}-guardianName-error` : undefined}
            />
            {errors.guardianName ? (
              <p id={`${id}-guardianName-error`} role="alert" className="text-sm font-medium text-destructive">
                {errors.guardianName}
              </p>
            ) : null}
          </div>
          <Check
            id={`${id}-guardianAgrees`}
            checked={guardianAgrees}
            onChange={(v) => {
              setGuardianAgrees(v);
              clear("guardianAgrees");
            }}
            error={errors.guardianAgrees}
            label="Mi madre, padre o tutor leyó este consentimiento y está de acuerdo con que haga el tratamiento."
          />
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
        <PenLine aria-hidden /> Firmar
      </Button>
    </form>
  );
}

function Check({ id, checked, onChange, label, error }: { id: string; checked: boolean; onChange: (value: boolean) => void; label: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3 rounded-2xl bg-card p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-foreground">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
