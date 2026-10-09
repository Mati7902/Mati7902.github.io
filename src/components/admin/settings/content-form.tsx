"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsSave } from "@/hooks/use-settings-save";
import type { SettingsValue } from "@/server/services/settings";

type Landing = SettingsValue<"landing">;
type Theme = SettingsValue<"theme">;
type Gamification = SettingsValue<"gamification">;
type Legal = SettingsValue<"legal">;

export function LandingForm({ initial }: { initial: Landing }) {
  const [value, setValue] = useState(initial);
  const { save, pending } = useSettingsSave("landing");
  const steps = value.how_it_works.length ? value.how_it_works : [{ title: "", text: "" }, { title: "", text: "" }, { title: "", text: "" }];
  const updateStep = (i: number, patch: Partial<{ title: string; text: string }>) =>
    setValue({ ...value, how_it_works: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const areas = [...value.specialties, ...Array.from({ length: Math.max(0, 6 - value.specialties.length) }, () => ({ title: "", text: "" }))].slice(0, 6);
  const updateArea = (i: number, patch: Partial<{ title: string; text: string }>) =>
    setValue({ ...value, specialties: areas.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          ...value,
          how_it_works: steps.filter((s) => s.title.trim() || s.text.trim()),
          specialties: areas.filter((a) => a.title.trim() || a.text.trim()),
        });
      }}
    >
      <FormField id="ld-title" label="Título principal (hero)" hint="Las palabras entre asteriscos se destacan en cursiva y en el color de acento, por ejemplo: Terapia desde *donde estés*.">
        <Textarea id="ld-title" value={value.hero_title} onChange={(e) => setValue({ ...value, hero_title: e.target.value })} className="min-h-20" />
      </FormField>
      <FormField id="ld-sub" label="Subtítulo">
        <Input id="ld-sub" value={value.hero_subtitle} onChange={(e) => setValue({ ...value, hero_subtitle: e.target.value })} />
      </FormField>
      <FormField id="ld-areas-title" label="Título de las áreas de trabajo">
        <Input id="ld-areas-title" value={value.specialties_title} onChange={(e) => setValue({ ...value, specialties_title: e.target.value })} />
      </FormField>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Áreas de trabajo (hasta 6)</legend>
        {areas.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-border/70 bg-card p-3 sm:grid-cols-[1fr_2fr]">
            <Input value={a.title} onChange={(e) => updateArea(i, { title: e.target.value })} placeholder={`Área ${i + 1}`} aria-label={`Título del área ${i + 1}`} />
            <Input value={a.text} onChange={(e) => updateArea(i, { text: e.target.value })} placeholder="Descripción breve" aria-label={`Descripción del área ${i + 1}`} />
          </div>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <FormField id="ld-approach-label" label="Etiqueta del enfoque">
          <Input id="ld-approach-label" value={value.approach_label} onChange={(e) => setValue({ ...value, approach_label: e.target.value })} />
        </FormField>
        <FormField id="ld-approach" label="Enfoque diferencial">
          <Textarea id="ld-approach" value={value.approach_text} onChange={(e) => setValue({ ...value, approach_text: e.target.value })} className="min-h-20" />
        </FormField>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Cómo funciona (3 pasos)</legend>
        {steps.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-border/70 bg-card p-3 sm:grid-cols-[1fr_2fr]">
            <Input value={s.title} onChange={(e) => updateStep(i, { title: e.target.value })} placeholder={`Paso ${i + 1}`} aria-label={`Título del paso ${i + 1}`} />
            <Input value={s.text} onChange={(e) => updateStep(i, { text: e.target.value })} placeholder="Descripción breve" aria-label={`Texto del paso ${i + 1}`} />
          </div>
        ))}
      </fieldset>
      <Button type="submit" loading={pending}>Guardar textos</Button>
    </form>
  );
}

function ColorField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <FormField id={id} label={label} error={error}>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-12 cursor-pointer rounded-xl border border-input bg-card p-1" aria-label={`${label} (selector)`} />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </FormField>
  );
}

export function ThemeForm({ initial }: { initial: Theme }) {
  const [value, setValue] = useState(initial);
  const { save, pending, fieldErrors } = useSettingsSave("theme");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <ColorField id="th-primary" label="Color principal" value={value.primary} error={fieldErrors.primary} onChange={(v) => setValue({ ...value, primary: v })} />
        <ColorField id="th-accent" label="Color de acento" value={value.accent} error={fieldErrors.accent} onChange={(v) => setValue({ ...value, accent: v })} />
        <ColorField id="th-bg" label="Fondo" value={value.background} error={fieldErrors.background} onChange={(v) => setValue({ ...value, background: v })} />
      </div>
      <div className="flex gap-2 rounded-2xl border border-border/70 p-4" style={{ background: value.background }}>
        <span className="rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: value.primary }}>Botón principal</span>
        <span className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: value.accent, color: "#12303b" }}>Acento</span>
      </div>
      <p className="text-xs text-muted-foreground">Mantené contraste suficiente (WCAG AA): el principal debe ser oscuro para texto blanco.</p>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>Guardar colores</Button>
        <Button type="button" variant="ghost" onClick={() => setValue({ primary: "#2f6468", accent: "#27b088", background: "#fbfdfc" })}>Restaurar predeterminados</Button>
      </div>
    </form>
  );
}

export function PreferencesForm({ gamification, legal }: { gamification: Gamification; legal: Legal }) {
  const [g, setG] = useState(gamification);
  const [l, setL] = useState(legal);
  const gSave = useSettingsSave("gamification");
  const lSave = useSettingsSave("legal");
  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          gSave.save(g);
        }}
      >
        <h3 className="font-display text-lg font-medium">Progreso del paciente</h3>
        <p className="text-sm text-muted-foreground">Solo elementos neutrales (“Completaste 3 ejercicios esta semana”). Sin rankings, rachas ni competencia.</p>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <Label htmlFor="gm-enabled" className="font-normal">Mostrar resumen semanal en el inicio del paciente</Label>
          <Switch id="gm-enabled" checked={g.enabled && g.weekly_summary} onCheckedChange={(v) => setG({ enabled: v, weekly_summary: v })} />
        </div>
        <Button type="submit" loading={gSave.pending}>Guardar</Button>
      </form>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          lSave.save(l);
        }}
      >
        <h3 className="font-display text-lg font-medium">Textos legales</h3>
        <p className="text-sm text-muted-foreground">Las versiones se muestran en las páginas de privacidad y términos y quedan registradas en el consentimiento de cada paciente.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="lg-priv" label="Versión de privacidad"><Input id="lg-priv" value={l.privacy_version} onChange={(e) => setL({ ...l, privacy_version: e.target.value })} /></FormField>
          <FormField id="lg-terms" label="Versión de términos"><Input id="lg-terms" value={l.terms_version} onChange={(e) => setL({ ...l, terms_version: e.target.value })} /></FormField>
          <FormField id="lg-consent" label="Versión de consentimiento"><Input id="lg-consent" value={l.consent_version} onChange={(e) => setL({ ...l, consent_version: e.target.value })} /></FormField>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <div>
            <Label htmlFor="lg-reviewed" className="font-normal">Textos revisados por un profesional competente</Label>
            <p className="text-xs text-muted-foreground">Mientras esté desactivado, las páginas legales muestran un aviso de borrador.</p>
          </div>
          <Switch id="lg-reviewed" checked={l.reviewed_by_professional} onCheckedChange={(v) => setL({ ...l, reviewed_by_professional: v })} />
        </div>
        <Button type="submit" loading={lSave.pending}>Guardar</Button>
      </form>
    </div>
  );
}
