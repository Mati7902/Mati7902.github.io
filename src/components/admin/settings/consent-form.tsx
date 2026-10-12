"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { RichText } from "@/components/exercises/rich-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsSave } from "@/hooks/use-settings-save";
import { CONSENT_PLACEHOLDERS, type ConsentParams, DEFAULT_CONSENT_BODY, DEFAULT_CONSENT_TITLE, renderConsent, unknownPlaceholders } from "@/lib/consent/treatment";
import type { TreatmentConsentSettings } from "@/server/services/settings";

/**
 * Texto del consentimiento informado y del compromiso de las primeras sesiones. Cada firma guarda
 * el texto de ese momento: cambiar la versión hace que quien firmó otra la vuelva a firmar.
 */
export function TreatmentConsentForm({ initial, params, signedCount }: { initial: TreatmentConsentSettings; params: Omit<ConsentParams, "sesiones">; signedCount: number }) {
  const [value, setValue] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { save, pending, fieldErrors } = useSettingsSave("treatment_consent");
  const textChanged = value.body !== initial.body || value.title !== initial.title || value.sessions !== initial.sessions;
  const sameVersion = value.version.trim() === initial.version;
  const unknown = unknownPlaceholders(`${value.title}\n${value.body}`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save({ ...value, version: value.version.trim(), title: value.title.trim(), body: value.body.trim() }, "Consentimiento guardado.");
      }}
    >
      <Alert variant="warning">
        <AlertTitle>Revisalo antes de pedir firmas</AlertTitle>
        <AlertDescription>
          <p>
            El texto inicial es un modelo: adaptalo a tu forma de trabajo (y, si querés, revisalo con un abogado). Los pacientes lo firman al crear su cuenta, antes de la ficha de ingreso.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
        <Label htmlFor="tc-enabled" className="font-normal">
          Pedir el consentimiento informado al crear la cuenta
        </Label>
        <Switch id="tc-enabled" checked={value.enabled} onCheckedChange={(v) => setValue({ ...value, enabled: v })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_12rem]">
        <FormField id="tc-title" label="Título" error={fieldErrors.title}>
          <Input id="tc-title" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} maxLength={200} />
        </FormField>
        <FormField id="tc-sessions" label="Sesiones del compromiso" error={fieldErrors.sessions}>
          <Input
            id="tc-sessions"
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            value={value.sessions}
            onChange={(e) => setValue({ ...value, sessions: Math.max(1, Math.min(40, Math.round(Number(e.target.value) || 1))) })}
          />
        </FormField>
        <FormField id="tc-version" label="Versión" error={fieldErrors.version} hint="Cambiala si cambiás el texto.">
          <Input id="tc-version" value={value.version} onChange={(e) => setValue({ ...value, version: e.target.value })} maxLength={40} />
        </FormField>
      </div>

      {textChanged && sameVersion && signedCount > 0 ? (
        <Alert variant="info">
          <AlertTitle>¿Querés que lo vuelvan a firmar?</AlertTitle>
          <AlertDescription>
            <p>
              Cambiaste el texto y {signedCount === 1 ? "1 paciente ya firmó" : `${signedCount} pacientes ya firmaron`} la versión {initial.version}. Si es un cambio de fondo, poné una versión nueva: se
              les va a pedir que firmen la versión nueva. Si es una corrección menor, podés dejar la misma (cada firma conserva el texto que se firmó).
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setValue({ ...value, version: today })}>
              Usar la versión {today}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormField id="tc-body" label="Texto" error={fieldErrors.body} hint="Párrafos separados por una línea en blanco, viñetas con «- » y **negrita** (un párrafo entero en negrita funciona como subtítulo).">
        <Textarea id="tc-body" value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} rows={22} maxLength={20000} className="min-h-96 text-sm leading-relaxed" />
      </FormField>

      <div className="space-y-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Datos que se completan solos</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {CONSENT_PLACEHOLDERS.map((p) => (
            <li key={p.key} className="text-muted-foreground">
              <code className="rounded bg-card px-1.5 py-0.5 text-xs text-foreground">{`{{${p.key}}}`}</code> {p.label}
            </li>
          ))}
        </ul>
      </div>

      {unknown.length > 0 ? (
        <p role="alert" className="text-sm font-medium text-warning">
          Estos marcadores no existen y se van a ver tal cual: {unknown.map((k) => `{{${k}}}`).join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          Guardar consentimiento
        </Button>
        <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
          {preview ? "Ocultar vista previa" : "Ver cómo lo lee el paciente"}
        </Button>
        {confirmReset ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            ¿Reemplazar el título y el texto por el modelo inicial?
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                setValue({ ...value, title: DEFAULT_CONSENT_TITLE, body: DEFAULT_CONSENT_BODY });
                setConfirmReset(false);
              }}
            >
              Sí, reemplazar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw aria-hidden /> Volver al modelo
          </Button>
        )}
      </div>

      {preview ? (
        <article className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
          <h3 className="font-display text-2xl font-medium">{value.title}</h3>
          <RichText text={renderConsent(value.body, { ...params, sesiones: String(value.sessions) })} className="space-y-4 text-[0.95rem] leading-relaxed" />
        </article>
      ) : null}
    </form>
  );
}
