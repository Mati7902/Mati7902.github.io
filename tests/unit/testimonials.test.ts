import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cleanQuote, CONTEXT_MAX, identifyingData, QUOTE_MAX, QUOTE_MIN, testimonialSchema } from "@/lib/testimonials";

const MIGRATION = readFileSync(path.join(__dirname, "../../supabase/migrations/20261012000002_testimonials.sql"), "utf8");
const QUOTE = "Aprendí a frenar antes de que la ansiedad me ganara. Hoy duermo mejor y volví a salir con amigos.";

describe("testimonios: datos que identifican a alguien", () => {
  it("detecta emails, usuarios de redes, enlaces y números largos", () => {
    expect(identifyingData("Escribime a ana.paz@gmail.com")).toEqual(["un email"]);
    expect(identifyingData("Me encontrás como @ana_paz")).toEqual(["un usuario de redes"]);
    expect(identifyingData("Lo conté en https://ejemplo.org/blog")).toEqual(["un enlace"]);
    expect(identifyingData("Lo conté en www.ejemplo.org")).toEqual(["un enlace"]);
    expect(identifyingData("Mi blog: anapaz.com.py")).toEqual(["un enlace"]);
    expect(identifyingData("Llamame al 0981 555 123")).toEqual(["un teléfono o número de documento"]);
    expect(identifyingData("Mi cédula es 4.567.890")).toEqual(["un teléfono o número de documento"]);
    expect(identifyingData("+595 981 555123 o ana@correo.com")).toEqual(["un email", "un teléfono o número de documento"]);
  });

  it("no confunde un texto común con datos personales", () => {
    expect(identifyingData(QUOTE)).toEqual([]);
    expect(identifyingData("Fueron 12 sesiones entre 2023-2024 y me cambió la vida al 100%.")).toEqual([]);
    expect(identifyingData("Estaba muy angustiada.Me ayudó a ordenarme.")).toEqual([]);
    expect(identifyingData("Gracias a todos mis amig@s por apoyarme.")).toEqual([]);
    expect(identifyingData("Entre 2019 2021 fue lo peor.")).toEqual([]);
  });
});

describe("testimonios: validación", () => {
  const base = { gender: "mujer", quote: QUOTE, context: "Después de cinco meses de terapia" } as const;

  it("acepta un testimonio sin publicar y limpia comillas y espacios", () => {
    const parsed = testimonialSchema.parse({ ...base, quote: `  «${QUOTE}»  `, context: "  " });
    expect(parsed).toMatchObject({ gender: "mujer", quote: QUOTE, context: null, consent_confirmed: false, is_published: false, sort_order: 0 });
    expect(cleanQuote('"Hola, esto me sirvió mucho"')).toBe("Hola, esto me sirvió mucho");
  });

  it("no publica sin la autorización escrita confirmada", () => {
    const result = testimonialSchema.safeParse({ ...base, is_published: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["consent_confirmed"]);
    expect(testimonialSchema.safeParse({ ...base, is_published: true, consent_confirmed: true }).success).toBe(true);
  });

  it("solo 👩 o 👨", () => {
    expect(testimonialSchema.safeParse({ ...base, gender: "otro" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, gender: "" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, gender: "hombre" }).success).toBe(true);
  });

  it("respeta los largos", () => {
    expect(testimonialSchema.safeParse({ ...base, quote: "x".repeat(QUOTE_MIN - 1) }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, quote: "x".repeat(QUOTE_MAX + 1) }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, context: "x".repeat(CONTEXT_MAX + 1) }).success).toBe(false);
  });

  it("rechaza datos que identifican en el texto o en el contexto", () => {
    const inQuote = testimonialSchema.safeParse({ ...base, quote: `${QUOTE} Escribime al 0981 555 123.` });
    expect(inQuote.error?.issues.map((i) => i.path[0])).toEqual(["quote"]);
    const inContext = testimonialSchema.safeParse({ ...base, context: "Seguime en @ana_paz" });
    expect(inContext.error?.issues.map((i) => i.path[0])).toEqual(["context"]);
  });

  it("la base aplica las mismas reglas", () => {
    expect(MIGRATION).toContain("check (gender in ('mujer', 'hombre'))");
    expect(MIGRATION).toContain(`between ${QUOTE_MIN} and ${QUOTE_MAX}`);
    expect(MIGRATION).toContain(`char_length(context) <= ${CONTEXT_MAX}`);
    expect(MIGRATION).toContain("check (not is_published or consent_confirmed)");
    expect(MIGRATION).toMatch(/using \(\(is_published and consent_confirmed\) or public\.is_admin\(\)\)/);
  });
});
