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

// Todas las repeticiones están acotadas: el texto llega del navegador y no puede trabar el servidor.
const EMAIL = /[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,24}/gi;
const HANDLE = /(?:^|[\s(¿¡"'«“:;,/])(@[\p{L}\p{N}._]{2,30})/u;
const URL = /\b(?:https?:\/\/|www\.)\S{0,60}/i;
// Dominios sin "www". Las terminaciones de 2 letras van en minúscula (así "tranquila.Me sentí…" no
// cuenta) y ".es" y ".me", que son palabras, solo cuentan seguidas de "/" o de fin de frase ("mal.me ayudó" no).
const DOMAINS = [
  /[\p{L}\p{N}-]{2,63}\.(?:com|net|org|info|app|link)(?![\p{L}\p{N}])/iu,
  /[\p{L}\p{N}-]{2,63}\.(?:py|ar|uy|bo|br|co|io)(?![\p{L}\p{N}])/u,
  /[\p{L}\p{N}-]{2,63}\.(?:es|me)(?=\/|[.,;:!?)](?:\s|$)|$)/u,
];
// Siete o más dígitos, juntos o con hasta 3 separadores entre cada uno: "0981 555 123", "(0981) 555-123",
// "+595 981 555123", "4.567.890". Las cédulas de 6 dígitos o menos no se detectan.
const LONG_NUMBER = /\+?\(?\d(?:[\s.()/-]{0,3}\d){6,}\)?/g;
// Excepciones: años ("2019 - 2021", "2019 2020 2021") y montos en guaraníes ("1.500.000 Gs").
const ONLY_YEARS = /^(?:19|20)\d{2}(?:[\s.()/-]{1,3}(?:19|20)\d{2})+$/;
const CURRENCY_AFTER = /^\s?(?:gs\b|₲|guaran)/i;

export type IdentifyingMatch = { kind: string; match: string };

/**
 * Datos que identifican a alguien y nunca van en un testimonio (ni guardado ni publicado), con el
 * fragmento encontrado. Los nombres no se pueden detectar con seguridad: el editor lo recuerda aparte.
 */
export function identifyingData(text: string): IdentifyingMatch[] {
  const found: IdentifyingMatch[] = [];
  const emails = text.match(EMAIL);
  if (emails) found.push({ kind: "un email", match: emails[0] });
  const rest = text.replace(EMAIL, " ");
  const handle = HANDLE.exec(rest);
  if (handle?.[1]) found.push({ kind: "un usuario de redes", match: handle[1] });
  const link = [URL, ...DOMAINS].reduce<RegExpExecArray | null>((hit, rx) => hit ?? rx.exec(rest), null);
  if (link) found.push({ kind: "un enlace", match: link[0] });
  for (const m of rest.matchAll(LONG_NUMBER)) {
    const n = m[0].trim();
    if (ONLY_YEARS.test(n.replace(/^\(|\)$/g, "")) || CURRENCY_AFTER.test(rest.slice((m.index ?? 0) + m[0].length))) continue;
    found.push({ kind: "un teléfono o número de documento", match: n });
    break;
  }
  return found;
}

export function identifyingDataMessage(found: IdentifyingMatch[]): string {
  const items = found.map((f) => `${f.kind} («${f.match.length > 40 ? `${f.match.slice(0, 40)}…` : f.match}»)`);
  const list = items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : items[0];
  return `Sacá ${list}: un testimonio no puede llevar datos que permitan reconocer a la persona.`;
}

const QUOTE_PAIRS: Record<string, string> = { '"': '"', "“": "”", "«": "»", "'": "'", "‘": "’" };

/**
 * Quita las comillas que envuelven todo el texto, si se pegaron con él (la portada ya lo muestra
 * como cita). Las que forman parte del texto, como en «aprendí a decir “no”», quedan.
 */
export function cleanQuote(text: string): string {
  const t = text.trim();
  const close = QUOTE_PAIRS[t[0] ?? ""];
  if (close && t.length > 1 && t.endsWith(close)) {
    const inner = t.slice(1, -1);
    if (!inner.includes(close) && !inner.includes(t[0]!)) return inner.trim();
  }
  return t;
}

/** Largo como lo cuentan la validación y la base (caracteres, no unidades UTF-16: un emoji cuenta 1). */
export function textLength(text: string): number {
  return [...text].length;
}

export const testimonialSchema = z
  .object({
    id: z.string().uuid().optional(),
    gender: z.enum(TESTIMONIAL_GENDERS, { error: "Elegí 👩 o 👨." }),
    quote: z
      .string()
      // Tope del texto crudo antes de limpiarlo y revisarlo.
      .max(QUOTE_MAX * 2, `El testimonio puede tener hasta ${QUOTE_MAX} caracteres.`)
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
      const text = value[field] ?? "";
      if (text.length > QUOTE_MAX * 2) continue;
      const found = identifyingData(text);
      if (found.length) ctx.addIssue({ code: "custom", path: [field], message: identifyingDataMessage(found) });
    }
    if (value.is_published && !value.consent_confirmed) {
      ctx.addIssue({ code: "custom", path: ["consent_confirmed"], message: "Para publicarlo, confirmá que tenés la autorización escrita de la persona." });
    }
  });

export type TestimonialInput = z.input<typeof testimonialSchema>;
