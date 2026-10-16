import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cleanQuote, CONTEXT_MAX, identifyingData, identifyingDataMessage, QUOTE_MAX, QUOTE_MIN, testimonialSchema, textLength } from "@/lib/testimonials";

const MIGRATION = readFileSync(path.join(__dirname, "../../supabase/migrations/20261012000002_testimonials.sql"), "utf8");
const QUOTE = "Aprendí a frenar antes de que la ansiedad me ganara. Hoy duermo mejor y volví a salir con amigos.";

const kinds = (text: string) => identifyingData(text).map((f) => f.kind);

describe("testimonios: datos que identifican a alguien", () => {
  it("detecta emails, usuarios de redes, enlaces y números largos", () => {
    expect(kinds("Escribime a ana.paz@gmail.com")).toEqual(["un email"]);
    expect(kinds("Me encontrás como @ana_paz")).toEqual(["un usuario de redes"]);
    expect(kinds("Seguime en IG:@ana_paz")).toEqual(["un usuario de redes"]);
    expect(kinds("Lo conté en https://ejemplo.org/blog")).toEqual(["un enlace"]);
    expect(kinds("Lo conté en www.ejemplo.org")).toEqual(["un enlace"]);
    expect(kinds("Mi blog: anapaz.com.py")).toEqual(["un enlace"]);
    expect(kinds("Mi web es ANAPAZ.COM")).toEqual(["un enlace"]);
    expect(kinds("Mi web es anapaz.me.")).toEqual(["un enlace"]);
    expect(kinds("+595 981 555123 o ana@correo.com")).toEqual(["un email", "un teléfono o número de documento"]);
  });

  it("detecta los teléfonos y cédulas como se escriben en Paraguay", () => {
    for (const text of ["Llamame al 0981 555 123", "Llamame al (0981) 555-123", "Mi número: +595 (981) 555-123", "0981 - 555 - 123", "0981/555/123", "Mi cédula es 4.567.890"]) {
      expect(kinds(text), text).toEqual(["un teléfono o número de documento"]);
    }
  });

  it("muestra el fragmento encontrado", () => {
    expect(identifyingData("Llamame al (0981) 555-123, gracias")[0]?.match).toBe("(0981) 555-123");
    expect(identifyingDataMessage(identifyingData("Seguime en @ana_paz"))).toBe("Sacá un usuario de redes («@ana_paz»): un testimonio no puede llevar datos que permitan reconocer a la persona.");
  });

  it("no confunde un texto común con datos personales", () => {
    for (const text of [
      QUOTE,
      "Fueron 12 sesiones entre 2023-2024 y me cambió la vida al 100%.",
      "Estaba muy angustiada.Me ayudó a ordenarme.",
      "Estaba muy mal.me ayudó mucho.",
      "No quería ir.es increíble lo que cambió.",
      "Gracias a todos mis amig@s por apoyarme.",
      "Entre 2019 2021 fue lo peor.",
      "Entre 2019 2020 2021 tuve tres crisis.",
      "Fueron años duros (2019 2021) pero salí.",
      "Gastaba menos que 1.500.000 Gs por mes en salidas.",
      "Llegué.Como si fuera otra persona.",
    ]) {
      expect(kinds(text), text).toEqual([]);
    }
  });

  it("no traba el servidor con textos enormes", () => {
    const start = performance.now();
    for (const text of ["a".repeat(100_000), `a${" ".repeat(100_000)}b`, "1".repeat(100_000), "@".repeat(100_000)]) identifyingData(text);
    testimonialSchema.safeParse({ gender: "mujer", quote: "a".repeat(100_000), context: "b".repeat(100_000) });
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe("testimonios: validación", () => {
  const base = { gender: "mujer", quote: QUOTE, context: "Después de cinco meses de terapia" } as const;

  it("acepta un testimonio sin publicar y limpia comillas y espacios", () => {
    const parsed = testimonialSchema.parse({ ...base, quote: `  «${QUOTE}»  `, context: "  " });
    expect(parsed).toMatchObject({ gender: "mujer", quote: QUOTE, context: null, consent_confirmed: false, is_published: false, sort_order: 0 });
    expect(cleanQuote('"Hola, esto me sirvió mucho"')).toBe("Hola, esto me sirvió mucho");
    expect(cleanQuote("“Hola, esto me sirvió mucho”")).toBe("Hola, esto me sirvió mucho");
  });

  it("deja las comillas que son parte del texto", () => {
    expect(cleanQuote("Aprendí a decir “no”")).toBe("Aprendí a decir “no”");
    expect(cleanQuote("“No” era una palabra que no podía decir. Hoy sí.")).toBe("“No” era una palabra que no podía decir. Hoy sí.");
    expect(cleanQuote("Aprendí a decir 'basta'")).toBe("Aprendí a decir 'basta'");
    expect(cleanQuote("\"Me dijo \"vas a poder\" y pude\"")).toBe("\"Me dijo \"vas a poder\" y pude\"");
  });

  it("cuenta los caracteres como la base (un emoji es uno)", () => {
    expect(textLength("Me cambió la vida 🙏")).toBe(19);
    expect(testimonialSchema.safeParse({ ...base, quote: "Me cambió la vida 🙏" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, quote: `${"a".repeat(QUOTE_MAX - 1)}🙏` }).success).toBe(true);
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
    // La tabla la lee solo el profesional; la web, por una función que no devuelve fechas.
    expect(MIGRATION).toContain("revoke all on public.testimonials from anon;");
    expect(MIGRATION).toMatch(/returns table \(id uuid, gender text, quote text, context text\)/);
    expect(MIGRATION).toMatch(/where t\.is_published and t\.consent_confirmed/);
    expect(MIGRATION).toContain("grant execute on function public.published_testimonials() to anon, authenticated;");
  });
});
