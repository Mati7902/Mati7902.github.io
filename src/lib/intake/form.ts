import { z } from "zod";

import { ageFrom } from "@/lib/exercises/collections";
import { toDateKey } from "@/lib/dates";

/**
 * Ficha de ingreso del paciente: «Cuestionario clínico completo – Datos + Historial + BASIC I.D.»
 * del profesional, en el mismo orden y con los mismos ítems. El paciente la completa al crear su
 * cuenta, de a una parte por pantalla; el profesional la lee con el formato original.
 *
 * Las respuestas se guardan en patient_intakes.answers como { [id de pregunta]: valor }. Si en el
 * futuro se cambia una pregunta, se usa un id nuevo (y se sube INTAKE_FORM_VERSION) para no mezclar
 * respuestas a preguntas distintas.
 */
export const INTAKE_FORM_VERSION = "2026-10";
export const INTAKE_TITLE = "Cuestionario clínico completo – Datos + Historial + BASIC I.D.";

export type IntakeSectionKey = "datos" | "historia" | "basic" | "cierre";

export const INTAKE_SECTIONS: { key: IntakeSectionKey; roman: string; title: string }[] = [
  { key: "datos", roman: "I", title: "Datos personales" },
  { key: "historia", roman: "II", title: "Historia clínica / psicológica" },
  { key: "basic", roman: "III", title: "BASIC I.D." },
  { key: "cierre", roman: "IV", title: "Cierre" },
];

export type ContactValue = { nombre?: string; telefono?: string };
export type IntakeValue = string | number | ContactValue;
export type IntakeAnswers = Record<string, IntakeValue>;

type Base = {
  id: string;
  /** Texto del ítem tal como figura en la ficha (lo ve el profesional). */
  label: string;
  /** Texto para el paciente cuando conviene otra redacción (si no, se usa label). */
  patientLabel?: string;
  /** Aclaración en lenguaje simple debajo de la pregunta. */
  help?: string;
  placeholder?: string;
  /** Se muestra destacado en la vista del profesional (por ejemplo, autolesión). */
  sensitive?: boolean;
  /**
   * Preguntas que se repiten en BASIC I.D. (D — Drogas / Biología): si están vacías al llegar a
   * esa parte, se completan con lo que el paciente ya respondió en estas otras.
   */
  prefillFrom?: string[];
};

export type IntakeQuestion =
  | (Base & { type: "text"; max?: number })
  | (Base & { type: "long"; max?: number })
  | (Base & { type: "date" })
  | (Base & { type: "phone" })
  | (Base & { type: "contact" })
  | (Base & { type: "scale"; min: number; max: number; minLabel: string; maxLabel: string })
  | (Base & { type: "choice"; options: string[] })
  /** Se calcula a partir de otra respuesta (la edad, con la fecha de nacimiento): no se guarda. */
  | (Base & { type: "age"; from: string });

export type IntakeStep = {
  id: string;
  section: IntakeSectionKey;
  /** Encabezado del bloque en la ficha: «1. Antecedentes personales», «B — Conducta»… */
  heading: string | null;
  /** Título de la pantalla para el paciente. */
  title: string;
  /** Bajada corta (BASIC I.D.: qué área de la vida mira cada letra). */
  lead?: string;
  /** Texto de apoyo al comienzo de la pantalla. */
  intro?: string;
  /** En la ficha, los ítems van numerados o con guion (historia clínica). */
  itemStyle: "number" | "dash";
  questions: IntakeQuestion[];
};

const TEXT_MAX = 1000;
/** Igual que el nombre del contacto de emergencia en el perfil y en el panel (se copia ahí). */
export const CONTACT_NAME_MAX = 120;
const LONG_MAX = 2000;

const t = (id: string, label: string, extra: Partial<Base> & { max?: number } = {}): IntakeQuestion => ({ id, label, type: "text", ...extra });
const l = (id: string, label: string, extra: Partial<Base> & { max?: number } = {}): IntakeQuestion => ({ id, label, type: "long", ...extra });

export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "datos",
    section: "datos",
    heading: null,
    title: "Datos personales",
    intro: "Revisá lo que ya tenemos y completá lo que falta.",
    itemStyle: "number",
    questions: [
      t("nombre", "Nombre completo", { max: 160 }),
      { id: "edad", label: "Edad", type: "age", from: "fecha_nacimiento" },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
      t("estado_civil", "Estado civil / pareja actual", { placeholder: "Ej.: soltero/a, en pareja hace 2 años, casado/a…", max: 300 }),
      t("hijos", "Hijos", { placeholder: "Ej.: ninguno; dos, de 8 y 5 años…", max: 300 }),
      t("ocupacion", "Ocupación / estudios", { placeholder: "A qué te dedicás o qué estudiás", max: 300 }),
      t("residencia", "Lugar de residencia", { placeholder: "Ciudad y barrio", max: 300 }),
      { id: "telefono", label: "Número de contacto", type: "phone", placeholder: "0981 123 456" },
      {
        id: "contacto_emergencia",
        label: "Persona de referencia en caso de emergencia",
        type: "contact",
        help: "Alguien de confianza a quien llamar si hiciera falta.",
      },
      l("motivo", "Motivo principal de consulta (en sus palabras)", {
        patientLabel: "Motivo principal de consulta (en tus palabras)",
        help: "¿Qué te trae a consulta? Contalo como te salga.",
      }),
    ],
  },
  {
    id: "antecedentes_personales",
    section: "historia",
    heading: "1. Antecedentes personales",
    title: "Antecedentes personales",
    intro: "Si alguna pregunta te incomoda, podés dejarla en blanco y hablarla en sesión.",
    itemStyle: "dash",
    questions: [
      l("consultas_previas", "Consultas psicológicas previas", { help: "¿Hiciste terapia o consultaste antes? Cuándo y por cuánto tiempo, si te acordás." }),
      l("diagnosticos", "Diagnósticos anteriores", { help: "Si algún profesional te dio un diagnóstico, escribilo como te lo dijeron." }),
      l("medicacion", "Medicación actual o pasada", { help: "Nombre, dosis si la sabés, y si la tomás ahora o ya no." }),
      l("hospitalizaciones", "Hospitalizaciones", { help: "Internaciones por salud mental o por otros motivos." }),
      l("autolesion", "Intentos de autolesión o ideas suicidas previas", {
        help: "Podés contarlo con tus palabras o dejarlo para hablarlo en sesión.",
        sensitive: true,
      }),
      l("eventos_estresantes", "Eventos estresantes o traumáticos", { help: "Situaciones difíciles que te marcaron, recientes o de hace tiempo. No hace falta dar detalles." }),
    ],
  },
  {
    id: "antecedentes_medicos",
    section: "historia",
    heading: "2. Antecedentes médicos",
    title: "Antecedentes médicos",
    itemStyle: "dash",
    questions: [
      t("enfermedades_cronicas", "Enfermedades crónicas", { help: "Ej.: diabetes, hipertensión, tiroides, asma." }),
      t("alergias", "Alergias", { help: "A medicamentos, alimentos u otras." }),
      t("cirugias", "Cirugías"),
      t("historia_neurologica", "Historia neurológica", { help: "Golpes fuertes en la cabeza, convulsiones, desmayos, migrañas u otros problemas neurológicos." }),
      t("dolencias_actuales", "Dolencias actuales", { help: "Molestias o problemas de salud que tengas hoy." }),
    ],
  },
  {
    id: "historia_familiar",
    section: "historia",
    heading: "3. Historia familiar",
    title: "Historia familiar",
    itemStyle: "dash",
    questions: [
      l("antecedentes_familiares", "Antecedentes psiquiátricos familiares", {
        help: "Familiares con depresión, ansiedad, bipolaridad, consumo problemático, intentos de suicidio u otros problemas de salud mental.",
      }),
      l("relacion_familia", "Relación con padres/hermanos"),
      l("conflictos_familiares", "Conflictos importantes"),
    ],
  },
  {
    id: "consumo",
    section: "historia",
    heading: "4. Consumo de sustancias",
    title: "Consumo de sustancias",
    intro: "Contá con qué frecuencia y en qué cantidad, más o menos. No es para juzgarte: sirve para cuidar tu salud y tener en cuenta cómo se combina con la medicación.",
    itemStyle: "dash",
    questions: [
      t("alcohol", "Alcohol"),
      t("cannabis", "Cannabis"),
      t("tabaco", "Tabaco", { help: "Cigarrillos, vapeador u otros." }),
      t("estimulantes", "Estimulantes", {
        help: "Cocaína, anfetaminas, éxtasis o pastillas para estar despierto/a o concentrarte sin receta. Si tomás mucho café o bebidas energizantes, también podés contarlo.",
      }),
      t("otras_sustancias", "Otros", { help: "Tranquilizantes o pastillas para dormir sin receta, inhalantes, alucinógenos u otras." }),
    ],
  },
  {
    id: "sueno_alimentacion",
    section: "historia",
    heading: "5. Sueño y alimentación",
    title: "Sueño y alimentación",
    itemStyle: "dash",
    questions: [
      t("sueno", "Horas y calidad del sueño", { help: "¿Cuántas horas dormís? ¿Te cuesta dormirte, te despertás seguido, descansás?" }),
      t("apetito", "Cambios en apetito"),
      t("conductas_alimentarias", "Conductas alimentarias", { help: "Atracones, dietas muy estrictas, saltear comidas, vómitos provocados u otras conductas con la comida." }),
    ],
  },
  {
    id: "conducta",
    section: "basic",
    heading: "B — Conducta",
    title: "B — Conducta",
    lead: "Lo que hacés",
    intro: "BASIC I.D. mira siete áreas de tu vida, una por letra. Respondé pensando en cómo estuviste en general en las últimas semanas.",
    itemStyle: "number",
    questions: [
      t("conductas_problematicas", "Conductas problemáticas actuales", { help: "Cosas que hacés y te gustaría cambiar." }),
      t("conductas_estres", "Conductas bajo estrés", { help: "¿Qué hacés cuando estás con mucho estrés?" }),
      t("cambios_rutinas", "Cambios recientes en rutinas", { help: "Horarios, actividades, trabajo o estudio, comidas…" }),
      t("evitacion", "Evitación", { help: "Situaciones, lugares, personas o tareas que evitás, o cosas que hacés para no pensar o no sentir." }),
      t("impulsividad", "Impulsividad", { help: "Cosas que hacés sin pensarlo y de las que después te arrepentís." }),
      t("reaccion_enojo", "Reacciones ante enojo o frustración"),
    ],
  },
  {
    id: "afecto",
    section: "basic",
    heading: "A — Afecto",
    title: "A — Afecto",
    lead: "Lo que sentís",
    itemStyle: "number",
    questions: [
      t("emociones_predominantes", "Emociones predominantes", { help: "Las emociones que más sentís en estas semanas." }),
      t("picos_emocionales", "Picos emocionales", { help: "Momentos de euforia, enojo o angustia muy intensos o que cambian rápido." }),
      t("regulacion_emocional", "Dificultad para regular emociones", { help: "¿Cuánto te cuesta calmarte cuando una emoción es muy fuerte?" }),
      { id: "estado_animo", label: "Estado de ánimo (1 a 10)", type: "scale", min: 1, max: 10, minLabel: "Muy bajo", maxLabel: "Muy bueno", help: "En general, en las últimas semanas." },
      t("ansiedad_irritabilidad", "Ansiedad/irritabilidad", { help: "¿Cuánta ansiedad o irritabilidad sentís, y en qué momentos?" }),
      t("anhedonia", "Anhedonia", { help: "¿Te cuesta disfrutar o interesarte por cosas que antes te gustaban?" }),
    ],
  },
  {
    id: "sensacion",
    section: "basic",
    heading: "S — Sensación",
    title: "S — Sensación",
    lead: "Lo que sentís en el cuerpo",
    itemStyle: "number",
    questions: [
      t("sensaciones_estres", "Sensaciones corporales ante estrés", { help: "Ej.: palpitaciones, sudor, temblores, nudo en el estómago, falta de aire." }),
      t("variaciones_energia", "Variaciones de energía", { help: "¿Tu energía cambia mucho de un día a otro o por épocas?" }),
      t("dolores_tensiones", "Dolores o tensiones"),
      t("energia_general", "Energía general"),
      t("cambios_fisicos", "Cambios físicos relevantes", { help: "Peso, cambios hormonales u otros cambios en el cuerpo." }),
    ],
  },
  {
    id: "imagenes",
    section: "basic",
    heading: "I — Imágenes",
    title: "I — Imágenes",
    lead: "Lo que imaginás",
    itemStyle: "number",
    questions: [
      t("imagenes_malestar", "Imágenes al sentirse mal", { patientLabel: "Imágenes cuando te sentís mal", help: "Escenas o imágenes que te vienen a la mente cuando estás mal." }),
      t("recuerdos_intrusivos", "Recuerdos intrusivos", { help: "Recuerdos que aparecen solos, sin buscarlos, y te hacen mal." }),
      t("fantasias_negativas", "Fantasías negativas", { help: "Imaginar que algo malo va a pasar." }),
      t("imagenes_idealizadas", "Imágenes idealizadas", { help: "Imaginar cómo te gustaría que fuera tu vida." }),
      l("proyeccion", "Proyección a 6 meses", { help: "¿Cómo te imaginás dentro de 6 meses?" }),
    ],
  },
  {
    id: "cogniciones",
    section: "basic",
    heading: "C — Cogniciones",
    title: "C — Cogniciones",
    lead: "Lo que pensás",
    itemStyle: "number",
    questions: [
      t("pensamientos_negativos", "Pensamientos negativos", { help: "¿Qué te decís cuando las cosas salen mal?" }),
      t("pensamientos_acelerados", "Pensamientos acelerados", { help: "¿La cabeza va muy rápido, saltás de una idea a otra?" }),
      t("autocritica", "Autocrítica", { help: "¿Cuánto te exigís o te criticás?" }),
      t("culpa_desesperanza", "Pensamientos de culpa o desesperanza", {
        help: "¿Te sentís culpable seguido, o sentís que las cosas no van a mejorar? Podés contarlo con tus palabras o dejarlo para hablarlo en sesión.",
        sensitive: true,
      }),
      t("ideas_obsesivas", "Ideas obsesivas", { help: "Pensamientos que se repiten y cuesta sacarse de la cabeza." }),
      t("atencion", "Atención", { help: "¿Te cuesta concentrarte o mantener la atención?" }),
    ],
  },
  {
    id: "interpersonal",
    section: "basic",
    heading: "I — Interpersonal",
    title: "I — Interpersonal",
    lead: "Cómo te relacionás",
    itemStyle: "number",
    questions: [
      t("relaciones_importantes", "Relaciones importantes", { help: "Las personas más importantes para vos y cómo están esas relaciones." }),
      t("conflictos_pareja", "Conflictos familiares/pareja"),
      t("confianza_limites", "Confianza y límites", { help: "¿Te cuesta confiar en los demás o decir que no?" }),
      t("soledad", "Soledad / acompañamiento", { help: "¿Te sentís en compañía o en soledad?" }),
      t("reaccion_criticas", "Reacción a críticas"),
      t("autopercepcion_social", "Autopercepción social", { help: "¿Cómo creés que te ven los demás?" }),
    ],
  },
  {
    id: "biologia",
    section: "basic",
    heading: "D — Drogas / Biología",
    title: "D — Drogas / Biología",
    lead: "Tu cuerpo y tu salud",
    intro: "Algunas preguntas se repiten con la historia clínica: las completamos con lo que ya respondiste. Revisalas y cambialas si hace falta.",
    itemStyle: "number",
    questions: [
      t("bio_medicacion", "Medicación", { prefillFrom: ["medicacion"] }),
      t("bio_alcohol", "Alcohol", { prefillFrom: ["alcohol"] }),
      t("bio_otras_sustancias", "Cannabis/tabaco/otras", { prefillFrom: ["cannabis", "tabaco", "estimulantes", "otras_sustancias"] }),
      t("bio_sueno", "Sueño", { prefillFrom: ["sueno"] }),
      t("bio_apetito", "Apetito", { prefillFrom: ["apetito"] }),
      t("salud_general", "Salud general"),
      t("actividad_fisica", "Actividad física", { help: "Qué hacés y cuántas veces por semana." }),
      t("otros_biologicos", "Otros factores biológicos", { help: "Cambios hormonales, embarazo, enfermedades, dolor crónico u otros." }),
    ],
  },
  {
    id: "cierre",
    section: "cierre",
    heading: null,
    title: "Cierre",
    itemStyle: "number",
    questions: [
      l("objetivos", "Objetivos de terapia", { help: "¿Qué te gustaría que cambie o lograr con la terapia?" }),
      { id: "compromiso", label: "Nivel de compromiso", type: "choice", options: ["Bajo", "Medio", "Alto", "No lo sé todavía"], help: "¿Cuánto tiempo y energía sentís que hoy le podés dedicar a la terapia?" },
      {
        id: "frecuencia",
        label: "Frecuencia de sesiones",
        type: "choice",
        options: ["1 vez por semana", "2 veces por mes", "1 vez por mes", "A definir en la primera sesión"],
        help: "La que te gustaría o te resulta posible. Lo terminan de definir juntos.",
      },
    ],
  },
];

/** Todas las preguntas, en orden. */
export const INTAKE_QUESTIONS: IntakeQuestion[] = INTAKE_STEPS.flatMap((s) => s.questions);
const BY_ID = new Map(INTAKE_QUESTIONS.map((q) => [q.id, q]));

export function intakeQuestion(id: string): IntakeQuestion | undefined {
  return BY_ID.get(id);
}

/** Preguntas que el paciente responde (la edad se calcula). */
export function isInputQuestion(q: IntakeQuestion): boolean {
  return q.type !== "age";
}

export const INTAKE_INPUT_COUNT = INTAKE_QUESTIONS.filter(isInputQuestion).length;

export function questionLabel(q: IntakeQuestion, audience: "patient" | "professional"): string {
  return audience === "patient" ? (q.patientLabel ?? q.label) : q.label;
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

export function isAnswered(q: IntakeQuestion, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (q.type === "contact") {
    const c = value as ContactValue;
    return Boolean(c && typeof c === "object" && (c.nombre?.trim() || c.telefono?.trim()));
  }
  if (q.type === "scale") return typeof value === "number";
  return typeof value === "string" && value.trim().length > 0;
}

export function answeredCount(answers: IntakeAnswers, questions: IntakeQuestion[] = INTAKE_QUESTIONS): number {
  return questions.filter((q) => isInputQuestion(q) && isAnswered(q, answers[q.id])).length;
}

/**
 * Dónde retomar: la parte que sigue a la última con alguna respuesta (las que el paciente dejó en
 * blanco a propósito no se le vuelven a presentar). null = ya llegó al final: va a la revisión.
 */
export function resumeStep(answers: IntakeAnswers): number | null {
  let last = -1;
  INTAKE_STEPS.forEach((s, i) => {
    if (answeredCount(answers, s.questions) > 0) last = i;
  });
  return last + 1 < INTAKE_STEPS.length ? last + 1 : null;
}

/** Edad calculada con la fecha de nacimiento respondida. */
export function intakeAge(answers: IntakeAnswers, todayKey: string = toDateKey(new Date())): number | null {
  const birth = answers.fecha_nacimiento;
  return typeof birth === "string" ? ageFrom(birth, todayKey) : null;
}

/**
 * Valor sugerido para una pregunta repetida (D — Drogas / Biología) a partir de las respuestas de
 * la historia clínica. Con una sola fuente se copia tal cual; con varias, cada una con su nombre.
 */
export function prefillValue(q: IntakeQuestion, answers: IntakeAnswers): string | null {
  if (!q.prefillFrom?.length) return null;
  const parts = q.prefillFrom
    .map((id) => ({ source: BY_ID.get(id), value: answers[id] }))
    .filter((p): p is { source: IntakeQuestion; value: string } => Boolean(p.source) && typeof p.value === "string" && p.value.trim().length > 0);
  if (parts.length === 0) return null;
  if (q.prefillFrom.length === 1) return parts[0]!.value.trim();
  return parts.map((p) => `${p.source.label}: ${p.value.trim()}`).join(" · ");
}

/** Completa las preguntas repetidas de una parte que siguen vacías. Devuelve el mismo objeto si no cambia nada. */
export function withPrefill(step: IntakeStep, answers: IntakeAnswers): IntakeAnswers {
  let next = answers;
  for (const q of step.questions) {
    if (isAnswered(q, answers[q.id])) continue;
    const value = prefillValue(q, answers);
    if (value === null) continue;
    if (next === answers) next = { ...answers };
    next[q.id] = value.slice(0, maxLength(q));
  }
  return next;
}

export function maxLength(q: IntakeQuestion): number {
  if (q.type === "text") return q.max ?? TEXT_MAX;
  if (q.type === "long") return q.max ?? LONG_MAX;
  if (q.type === "phone") return 30;
  return TEXT_MAX;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha de calendario válida, no futura y con una edad razonable. */
export function isValidBirthDate(value: string, todayKey: string = toDateKey(new Date())): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
  if (value > todayKey) return false;
  return ageFrom(value, todayKey) !== null;
}

function questionSchema(q: IntakeQuestion): z.ZodType<IntakeValue | undefined> | null {
  switch (q.type) {
    case "age":
      return null;
    case "text":
    case "long":
    case "phone": {
      const max = maxLength(q);
      return z.string().max(max, `Máximo ${max} caracteres.`).optional();
    }
    case "date":
      return z
        .string()
        .refine((v) => isValidBirthDate(v), "Revisá la fecha: tiene que ser una fecha real y no puede ser futura.")
        .optional();
    case "contact":
      return z
        .object({
          nombre: z.string().max(CONTACT_NAME_MAX, `Máximo ${CONTACT_NAME_MAX} caracteres.`).optional(),
          telefono: z.string().max(30, "Máximo 30 caracteres.").optional(),
        })
        .optional();
    case "scale":
      return z.number().int().min(q.min, `Elegí un valor entre ${q.min} y ${q.max}.`).max(q.max, `Elegí un valor entre ${q.min} y ${q.max}.`).optional();
    case "choice":
      return z.enum(q.options as [string, ...string[]], { message: "Elegí una de las opciones." }).optional();
  }
}

const answersSchema = z
  // Las claves que no son preguntas se descartan (comportamiento por defecto de z.object).
  .object(Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.id, questionSchema(q)]).filter(([, s]) => s !== null)) as Record<string, z.ZodTypeAny>);

/** Quita espacios de más y descarta lo vacío (para no guardar claves sin contenido). */
function compact(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const inner: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) inner[k] = v.trim();
      }
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Valida y normaliza las respuestas que manda el formulario. Las claves desconocidas (por ejemplo,
 * de una versión anterior) se descartan; los errores vuelven por id de pregunta.
 */
export function parseIntakeAnswers(raw: unknown): { answers: IntakeAnswers; errors: null } | { answers: null; errors: Record<string, string> } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { answers: null, errors: { _form: "No pudimos leer tus respuestas." } };
  const parsed = answersSchema.safeParse(compact(raw as Record<string, unknown>));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      errors[key] ??= issue.message;
    }
    return { answers: null, errors };
  }
  const answers: IntakeAnswers = {};
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) answers[key] = value as IntakeValue;
  return { answers, errors: null };
}

/** Respuesta que solo niega («No», «Nunca», «Ninguna»…), sin nada más. */
export function isPlainNegative(text: string): boolean {
  return /^(no|nunca|jam[aá]s|ningun[oa]?s?|nada|no,? nunca)[.!]?$/i.test(text.trim());
}

/**
 * Pregunta sensible respondida con algo más que un «no»: en la vista del profesional se destaca
 * para revisarla antes de la sesión. Ante la duda, se destaca.
 */
export function needsAttention(q: IntakeQuestion, answers: IntakeAnswers): boolean {
  if (!q.sensitive) return false;
  const value = answers[q.id];
  if (!isAnswered(q, value)) return false;
  return !(typeof value === "string" && isPlainNegative(value));
}

/** Respuesta lista para mostrar (null = sin responder). */
export function formatIntakeAnswer(q: IntakeQuestion, answers: IntakeAnswers, todayKey?: string): string | null {
  if (q.type === "age") {
    const age = intakeAge(answers, todayKey);
    return age === null ? null : `${age} años`;
  }
  const value = answers[q.id];
  if (!isAnswered(q, value)) return null;
  if (q.type === "date") {
    const m = DATE_RE.exec(String(value));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
  }
  if (q.type === "scale") return `${value} de ${q.max}`;
  if (q.type === "contact") {
    const c = value as ContactValue;
    return [c.nombre?.trim(), c.telefono?.trim()].filter(Boolean).join(" · ");
  }
  return String(value).trim();
}

/** Respuestas iniciales a partir de la ficha administrativa (lo que el profesional ya cargó). */
export function initialIntakeAnswers(patient: {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}): IntakeAnswers {
  const answers: IntakeAnswers = { nombre: `${patient.first_name} ${patient.last_name}`.trim() };
  if (patient.birth_date) answers.fecha_nacimiento = patient.birth_date.slice(0, 10);
  if (patient.phone) answers.telefono = patient.phone;
  if (patient.emergency_contact_name || patient.emergency_contact_phone) {
    answers.contacto_emergencia = {
      ...(patient.emergency_contact_name ? { nombre: patient.emergency_contact_name } : {}),
      ...(patient.emergency_contact_phone ? { telefono: patient.emergency_contact_phone } : {}),
    };
  }
  return answers;
}
