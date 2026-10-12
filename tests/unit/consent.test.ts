import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  commitmentStart,
  CONSENT_PLACEHOLDERS,
  consentParams,
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_SESSIONS,
  DEFAULT_CONSENT_TITLE,
  DEFAULT_CONSENT_VERSION,
  renderConsent,
  signsAsMinor,
  unknownPlaceholders,
} from "@/lib/consent/treatment";
import { treatmentConsentSchema } from "@/server/services/settings";

const MIGRATION = readFileSync(path.join(__dirname, "../../supabase/migrations/20261012000001_treatment_consent.sql"), "utf8");

describe("consentimiento informado: texto", () => {
  it("la migración instala exactamente el modelo de la app", () => {
    const body = /'body', \$consent\$([\s\S]*?)\$consent\$/.exec(MIGRATION)?.[1];
    expect(body).toBe(DEFAULT_CONSENT_BODY);
    expect(MIGRATION).toContain(`'version', '${DEFAULT_CONSENT_VERSION}'`);
    expect(MIGRATION).toContain(`'title', '${DEFAULT_CONSENT_TITLE}'`);
    expect(MIGRATION).toContain(`'sessions', ${DEFAULT_CONSENT_SESSIONS}`);
  });

  it("la configuración sin guardar usa el modelo", () => {
    expect(treatmentConsentSchema.parse({})).toEqual({
      enabled: true,
      version: DEFAULT_CONSENT_VERSION,
      title: DEFAULT_CONSENT_TITLE,
      sessions: 8,
      body: DEFAULT_CONSENT_BODY,
    });
    expect(treatmentConsentSchema.safeParse({ sessions: 0 }).success).toBe(false);
    expect(treatmentConsentSchema.safeParse({ body: "corto" }).success).toBe(false);
  });

  it("el modelo usa solo marcadores conocidos y los usa todos", () => {
    expect(unknownPlaceholders(DEFAULT_CONSENT_BODY)).toEqual([]);
    for (const p of CONSENT_PLACEHOLDERS) expect(DEFAULT_CONSENT_BODY).toContain(`{{${p.key}}}`);
  });

  it("fundamenta el compromiso de las primeras sesiones y deja claro que no es una obligación", () => {
    expect(DEFAULT_CONSENT_BODY).toContain("**5. Compromiso de asistir a las primeras {{sesiones}} sesiones**");
    expect(DEFAULT_CONSENT_BODY).toMatch(/Howard y colaboradores, 1986/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/Swift y Greenberg, 2012/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/no es una obligación legal/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/Podés interrumpir el tratamiento cuando quieras/);
    // Sin exagerar lo que dicen los estudios.
    expect(DEFAULT_CONSENT_BODY).toMatch(/alguna mejoría medible hacia la octava sesión/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/no es una promesa/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/En personas adultas, alrededor de una de cada cinco/);
  });

  it("explica alternativas y la reserva con adolescentes", () => {
    expect(DEFAULT_CONSENT_BODY).toMatch(/\*\*Otras opciones\.\*\*/);
    expect(DEFAULT_CONSENT_BODY).toMatch(/También podés decidir no empezar ahora/);
    expect(DEFAULT_CONSENT_BODY).toContain("**Si tenés menos de 18 años**");
    expect(DEFAULT_CONSENT_BODY).toMatch(/Para la persona adulta:/);
  });

  it("no trae teléfonos de emergencia (salen de la configuración)", () => {
    expect(DEFAULT_CONSENT_BODY).not.toMatch(/\b(911|141|155)\b/);
    expect(DEFAULT_CONSENT_BODY).toContain("«Si necesitás ayuda urgente»");
  });
});

describe("consentimiento informado: datos del consultorio", () => {
  const identity = { professional_name: "Lic. Ejemplo", professional_title: "Psicóloga", license: "RP 1234" };

  it("completa los marcadores con la configuración", () => {
    const params = consentParams(identity, { default_duration_minutes: 50, cancel_min_hours: 24 }, 8);
    expect(params).toEqual({ profesional: "Lic. Ejemplo", titulo: "Psicóloga", matricula: "RP 1234", sesiones: "8", duracion: "50", cancelacion: "24" });
    const text = renderConsent(DEFAULT_CONSENT_BODY, params);
    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain("con Lic. Ejemplo (Psicóloga, RP 1234)");
    expect(text).toContain("asistir a las primeras 8 sesiones");
    expect(text).toContain("al menos 24 horas");
  });

  it("escribe los números como la base (12 → 12, 1.5 → 1,5)", () => {
    expect(consentParams(identity, { default_duration_minutes: 60, cancel_min_hours: 1.5 }, 10)).toMatchObject({ duracion: "60", cancelacion: "1,5", sesiones: "10" });
  });

  it("deja a la vista los marcadores desconocidos o sin dato", () => {
    expect(renderConsent("Hola {{profesional}}, {{inventado}} y {{titulo}}", { profesional: "Lic. Ejemplo", titulo: " " })).toBe("Hola Lic. Ejemplo, {{inventado}} y {{titulo}}");
    expect(unknownPlaceholders("{{profesional}} {{ inventado }} {{otro}} {{inventado}}")).toEqual(["inventado", "otro"]);
  });
});

describe("consentimiento informado: reglas", () => {
  it("firma como menor con menos de 18 años, o sin fecha pero con tutor cargado", () => {
    expect(signsAsMinor(15, null)).toBe(true);
    expect(signsAsMinor(18, "Laura")).toBe(false);
    expect(signsAsMinor(null, "Laura Benítez")).toBe(true);
    expect(signsAsMinor(null, "  ")).toBe(false);
    expect(signsAsMinor(null, null)).toBe(false);
  });

  it("cuenta el compromiso desde el comienzo del tratamiento o la primera firma, lo que sea antes", () => {
    expect(commitmentStart("2026-08-01T04:00:00.000Z", "2026-08-15T12:00:00.000Z")).toBe("2026-08-01T04:00:00.000Z");
    expect(commitmentStart("2026-09-01T04:00:00.000Z", "2026-08-15T12:00:00.000Z")).toBe("2026-08-15T12:00:00.000Z");
    expect(commitmentStart(null, "2026-08-15T12:00:00.000Z")).toBe("2026-08-15T12:00:00.000Z");
  });
});
