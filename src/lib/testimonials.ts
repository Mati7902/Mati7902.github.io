import { z } from "zod";

/**
 * Testimonios anónimos de la portada. Los carga el profesional con el texto que la persona
 * aprobó y su autorización escrita; en la web solo se ve 👩 o 👨, el texto y un contexto breve.
 */

export const TESTIMONIAL_GENDERS = ["mujer", "hombre"] as const;
export type TestimonialGender = (typeof TESTIMONIAL_GENDERS)[number];

export const TESTIMONIAL_EMOJI: Record<TestimonialGender, string> = { mujer: "👩", hombre: "👨" };
export const TESTIMONIAL_LABEL: Record<TestimonialGender, string> = { mujer: "Mujer", hombre: "Hombre" };

export const QUOTE_MIN = 20;
export const QUOTE_MAX = 600;
export const CONTEXT_MAX = 80;
/** Cuántos testimonios publicados se ven en la portada (los primeros por orden). */
export const LANDING_TESTIMONIALS = 6;

export function isTestimonialGender(value: string): value is TestimonialGender {
  return (TESTIMONIAL_GENDERS as readonly string[]).includes(value);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi;
const HANDLE = /(^|[\s(¿¡"'«“])@[\p{L}\p{N}._]{2,}/u;
const URL = /\bhttps?:\/\/|\bwww\./i;
// Dominio sin "www" (en minúscula, para no confundir "tranquila.Me sentí…" con un enlace).
const DOMAIN = /[\p{L}\p{N}-]+\.(com|net|org|info|py|ar|uy|bo|br|es|io|me|app|link)(?![\p{L}\p{N}])/u;
// Siete o más dígitos seguidos o separados por espacios, puntos o guiones: teléfono, cédula, RUC.
const LONG_NUMBER = /\+?\d(?:[\s.()-]?\d){6,}/g;
const YEAR_RANGE = /^(19|20)\d{2}\s*[-–\s]\s*(19|20)\d{2}$/;

/**
 * Datos que identifican a alguien y nunca van en un testimonio (ni guardado ni publicado).
 * Los nombres no se pueden detectar con seguridad: el editor lo recuerda aparte.
 */
export function identifyingData(text: string): string[] {
  const found: string[] = [];
  const rest = text.replace(EMAIL, " ");
  if (rest !== text) found.push("un email");
  if (HANDLE.test(rest)) found.push("un usuario de redes");
  if (URL.test(rest) || DOMAIN.test(rest)) found.push("un enlace");
  const numbers = (rest.match(LONG_NUMBER) ?? []).filter((n) => !YEAR_RANGE.test(n.trim()));
  if (numbers.length) found.push("un teléfono o número de documento");
  return found;
}

export function identifyingDataMessage(found: string[]): string {
  const list = found.length > 1 ? `${found.slice(0, -1).join(", ")} y ${found.at(-1)}` : found[0];
  return `Sacá ${list}: un testimonio no puede llevar datos que permitan reconocer a la persona.`;
}

/** Quita las comillas que se suelen pegar con el texto (la portada ya lo muestra como cita). */
export function cleanQuote(text: string): string {
  return text.trim().replace(/^["“”«»'‘’\s]+/, "").replace(/["“”«»'‘’\s]+$/, "").trim();
}

export const testimonialSchema = z
  .object({
    id: z.string().uuid().optional(),
    gender: z.enum(TESTIMONIAL_GENDERS, { error: "Elegí 👩 o 👨." }),
    quote: z
      .string()
      .transform(cleanQuote)
      .pipe(
        z
          .string()
          .min(QUOTE_MIN, `El testimonio necesita al menos ${QUOTE_MIN} caracteres.`)
          .max(QUOTE_MAX, `El testimonio puede tener hasta ${QUOTE_MAX} caracteres.`),
      ),
    context: z
      .string()
      .trim()
      .max(CONTEXT_MAX, `El contexto puede tener hasta ${CONTEXT_MAX} caracteres.`)
      .nullish()
      .transform((v) => v || null),
    sort_order: z.number().int().min(0).max(999).default(0),
    consent_confirmed: z.boolean().default(false),
    is_published: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    for (const field of ["quote", "context"] as const) {
      const found = identifyingData(value[field] ?? "");
      if (found.length) ctx.addIssue({ code: "custom", path: [field], message: identifyingDataMessage(found) });
    }
    if (value.is_published && !value.consent_confirmed) {
      ctx.addIssue({ code: "custom", path: ["consent_confirmed"], message: "Para publicarlo, confirmá que tenés la autorización escrita de la persona." });
    }
  });

export type TestimonialInput = z.input<typeof testimonialSchema>;
