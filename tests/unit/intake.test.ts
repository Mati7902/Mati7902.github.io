import { describe, expect, it } from "vitest";

import {
  answeredCount,
  formatIntakeAnswer,
  INTAKE_INPUT_COUNT,
  INTAKE_QUESTIONS,
  INTAKE_SECTIONS,
  INTAKE_STEPS,
  intakeAge,
  intakeQuestion,
  initialIntakeAnswers,
  isPlainNegative,
  isValidBirthDate,
  needsAttention,
  parseIntakeAnswers,
  prefillValue,
  resumeStep,
  withPrefill,
} from "@/lib/intake/form";
import { patientUpdates } from "@/lib/intake/sync";

/** Estructura del cuestionario en papel (solo los ítems, en orden). */
const FORMATO: { heading: string | null; section: string; items: string[] }[] = [
  {
    section: "datos",
    heading: null,
    items: [
      "Nombre completo",
      "Edad",
      "Fecha de nacimiento",
      "Estado civil / pareja actual",
      "Hijos",
      "Ocupación / estudios",
      "Lugar de residencia",
      "Número de contacto",
      "Persona de referencia en caso de emergencia",
      "Motivo principal de consulta (en sus palabras)",
    ],
  },
  {
    section: "historia",
    heading: "1. Antecedentes personales",
    items: ["Consultas psicológicas previas", "Diagnósticos anteriores", "Medicación actual o pasada", "Hospitalizaciones", "Intentos de autolesión o ideas suicidas previas", "Eventos estresantes o traumáticos"],
  },
  { section: "historia", heading: "2. Antecedentes médicos", items: ["Enfermedades crónicas", "Alergias", "Cirugías", "Historia neurológica", "Dolencias actuales"] },
  { section: "historia", heading: "3. Historia familiar", items: ["Antecedentes psiquiátricos familiares", "Relación con padres/hermanos", "Conflictos importantes"] },
  { section: "historia", heading: "4. Consumo de sustancias", items: ["Alcohol", "Cannabis", "Tabaco", "Estimulantes", "Otros"] },
  { section: "historia", heading: "5. Sueño y alimentación", items: ["Horas y calidad del sueño", "Cambios en apetito", "Conductas alimentarias"] },
  {
    section: "basic",
    heading: "B — Conducta",
    items: ["Conductas problemáticas actuales", "Conductas bajo estrés", "Cambios recientes en rutinas", "Evitación", "Impulsividad", "Reacciones ante enojo o frustración"],
  },
  {
    section: "basic",
    heading: "A — Afecto",
    items: ["Emociones predominantes", "Picos emocionales", "Dificultad para regular emociones", "Estado de ánimo (1 a 10)", "Ansiedad/irritabilidad", "Anhedonia"],
  },
  {
    section: "basic",
    heading: "S — Sensación",
    items: ["Sensaciones corporales ante estrés", "Variaciones de energía", "Dolores o tensiones", "Energía general", "Cambios físicos relevantes"],
  },
  {
    section: "basic",
    heading: "I — Imágenes",
    items: ["Imágenes al sentirse mal", "Recuerdos intrusivos", "Fantasías negativas", "Imágenes idealizadas", "Proyección a 6 meses"],
  },
  {
    section: "basic",
    heading: "C — Cogniciones",
    items: ["Pensamientos negativos", "Pensamientos acelerados", "Autocrítica", "Pensamientos de culpa o desesperanza", "Ideas obsesivas", "Atención"],
  },
  {
    section: "basic",
    heading: "I — Interpersonal",
    items: ["Relaciones importantes", "Conflictos familiares/pareja", "Confianza y límites", "Soledad / acompañamiento", "Reacción a críticas", "Autopercepción social"],
  },
  {
    section: "basic",
    heading: "D — Drogas / Biología",
    items: ["Medicación", "Alcohol", "Cannabis/tabaco/otras", "Sueño", "Apetito", "Salud general", "Actividad física", "Otros factores biológicos"],
  },
  { section: "cierre", heading: null, items: ["Objetivos de terapia", "Nivel de compromiso", "Frecuencia de sesiones"] },
];

describe("ficha de ingreso: formato", () => {
  it("tiene las cuatro secciones del cuestionario en orden", () => {
    expect(INTAKE_SECTIONS.map((s) => `${s.roman}. ${s.title}`)).toEqual(["I. Datos personales", "II. Historia clínica / psicológica", "III. BASIC I.D.", "IV. Cierre"]);
  });

  it("respeta todos los ítems del cuestionario en papel, en el mismo orden", () => {
    expect(INTAKE_STEPS.map((s) => ({ section: s.section, heading: s.heading, items: s.questions.map((q) => q.label) }))).toEqual(FORMATO);
  });

  it("usa ids únicos en snake_case", () => {
    const ids = INTAKE_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(new Set(INTAKE_STEPS.map((s) => s.id)).size).toBe(INTAKE_STEPS.length);
  });

  it("las preguntas repetidas de BASIC I.D. toman respuestas anteriores existentes", () => {
    const order = INTAKE_QUESTIONS.map((q) => q.id);
    for (const q of INTAKE_QUESTIONS) {
      for (const source of q.prefillFrom ?? []) {
        expect(intakeQuestion(source), `${q.id} ← ${source}`).toBeDefined();
        expect(order.indexOf(source)).toBeLessThan(order.indexOf(q.id));
      }
    }
  });

  it("las opciones de elección no se repiten y la escala va de 1 a 10", () => {
    for (const q of INTAKE_QUESTIONS) {
      if (q.type === "choice") expect(new Set(q.options).size).toBe(q.options.length);
      if (q.type === "scale") expect([q.min, q.max]).toEqual([1, 10]);
    }
  });

  it("la edad se calcula (no se pregunta) y la pregunta de autolesión se destaca", () => {
    expect(intakeQuestion("edad")?.type).toBe("age");
    expect(INTAKE_INPUT_COUNT).toBe(INTAKE_QUESTIONS.length - 1);
    expect(INTAKE_QUESTIONS.filter((q) => q.sensitive).map((q) => q.id)).toEqual(["autolesion", "culpa_desesperanza"]);
  });

  it("los textos para el paciente no traen teléfonos", () => {
    const texts = INTAKE_STEPS.flatMap((s) => [s.title, s.intro ?? "", s.lead ?? "", ...s.questions.flatMap((q) => [q.label, q.patientLabel ?? "", q.help ?? "", q.placeholder ?? ""])]);
    for (const text of texts) expect(text).not.toMatch(/\b(911|141|155)\b/);
  });
});

describe("ficha de ingreso: respuestas", () => {
  it("valida, recorta espacios y descarta lo vacío o desconocido", () => {
    const result = parseIntakeAnswers({
      nombre: "  Ana Ejemplo ",
      motivo: "",
      hijos: "   ",
      estado_animo: 4,
      compromiso: "Medio",
      contacto_emergencia: { nombre: " Luis ", telefono: "", otra: "x" },
      edad: "40",
      inventada: "no existe",
    });
    expect(result.errors).toBeNull();
    expect(result.answers).toEqual({ nombre: "Ana Ejemplo", estado_animo: 4, compromiso: "Medio", contacto_emergencia: { nombre: "Luis" } });
  });

  it("rechaza valores fuera de rango, opciones inventadas, textos largos y fechas imposibles", () => {
    const today = new Date().toISOString().slice(0, 10);
    const future = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
    const result = parseIntakeAnswers({
      estado_animo: 11,
      compromiso: "Muchísimo",
      motivo: "a".repeat(2001),
      fecha_nacimiento: future,
    });
    expect(result.answers).toBeNull();
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(["compromiso", "estado_animo", "fecha_nacimiento", "motivo"]);
    expect(parseIntakeAnswers(null).errors).toEqual({ _form: "No pudimos leer tus respuestas." });
    expect(parseIntakeAnswers(["x"]).errors).not.toBeNull();
  });

  it("valida fechas de nacimiento reales", () => {
    expect(isValidBirthDate("1990-03-15", "2026-10-10")).toBe(true);
    expect(isValidBirthDate("2001-02-30", "2026-10-10")).toBe(false);
    expect(isValidBirthDate("2027-01-01", "2026-10-10")).toBe(false);
    expect(isValidBirthDate("1800-01-01", "2026-10-10")).toBe(false);
    expect(isValidBirthDate("15/03/1990", "2026-10-10")).toBe(false);
  });

  it("cuenta respuestas y retoma después de la última parte con respuestas", () => {
    const answers = { nombre: "Ana", motivo: "Ansiedad", consultas_previas: "Sí", estado_animo: 5 };
    expect(answeredCount(answers)).toBe(4);
    expect(answeredCount({ contacto_emergencia: {} })).toBe(0);
    // Dejó en blanco las partes intermedias (antecedentes, etc.) y llegó hasta «A — Afecto»: sigue en «S — Sensación».
    const afecto = INTAKE_STEPS.findIndex((s) => s.id === "afecto");
    expect(resumeStep(answers)).toBe(afecto + 1);
    expect(resumeStep({ nombre: "Ana" })).toBe(1);
    expect(resumeStep({})).toBe(0);
    expect(resumeStep({ nombre: "Ana", compromiso: "Medio" })).toBeNull();
  });

  it("calcula la edad con la fecha de nacimiento", () => {
    expect(intakeAge({ fecha_nacimiento: "1990-03-15" }, "2026-10-10")).toBe(36);
    expect(intakeAge({}, "2026-10-10")).toBeNull();
    expect(formatIntakeAnswer(intakeQuestion("edad")!, { fecha_nacimiento: "1990-03-15" }, "2026-10-10")).toBe("36 años");
  });

  it("muestra las respuestas con el formato de la ficha", () => {
    const answers = { fecha_nacimiento: "1990-03-15", estado_animo: 4, contacto_emergencia: { nombre: "Luis, mi hermano", telefono: "+595981000010" }, hijos: "Dos, de 8 y 5 años" };
    expect(formatIntakeAnswer(intakeQuestion("fecha_nacimiento")!, answers)).toBe("15/03/1990");
    expect(formatIntakeAnswer(intakeQuestion("estado_animo")!, answers)).toBe("4 de 10");
    expect(formatIntakeAnswer(intakeQuestion("contacto_emergencia")!, answers)).toBe("Luis, mi hermano · +595981000010");
    expect(formatIntakeAnswer(intakeQuestion("hijos")!, answers)).toBe("Dos, de 8 y 5 años");
    expect(formatIntakeAnswer(intakeQuestion("motivo")!, answers)).toBeNull();
  });

  it("completa las preguntas repetidas sin pisar lo que ya respondió", () => {
    const bio = INTAKE_STEPS.find((s) => s.id === "biologia")!;
    const answers = { medicacion: "Fluoxetina", cannabis: "Nunca", tabaco: "A diario", estimulantes: "Energizantes en época de parciales", bio_alcohol: "Ya lo respondí", alcohol: "Fines de semana" };
    expect(prefillValue(intakeQuestion("bio_medicacion")!, answers)).toBe("Fluoxetina");
    expect(prefillValue(intakeQuestion("bio_otras_sustancias")!, answers)).toBe("Cannabis: Nunca · Tabaco: A diario · Estimulantes: Energizantes en época de parciales");
    expect(prefillValue(intakeQuestion("bio_sueno")!, answers)).toBeNull();
    const next = withPrefill(bio, answers);
    expect(next).toMatchObject({ bio_medicacion: "Fluoxetina", bio_alcohol: "Ya lo respondí", bio_otras_sustancias: "Cannabis: Nunca · Tabaco: A diario · Estimulantes: Energizantes en época de parciales" });
    expect(next.bio_sueno).toBeUndefined();
    expect(withPrefill(bio, next)).toBe(next);
  });

  it("destaca la pregunta de autolesión salvo que la respuesta sea solo un «no»", () => {
    const q = intakeQuestion("autolesion")!;
    for (const negative of ["No", "no.", "Nunca", "ninguna", "Ninguno", "Nada", "No, nunca"]) expect(isPlainNegative(negative), negative).toBe(true);
    expect(needsAttention(q, { autolesion: "No" })).toBe(false);
    expect(needsAttention(q, { autolesion: "No, pero a veces lo pensé" })).toBe(true);
    expect(needsAttention(q, { autolesion: "Solo ideas" })).toBe(true);
    expect(needsAttention(q, {})).toBe(false);
    expect(needsAttention(intakeQuestion("motivo")!, { motivo: "Ansiedad" })).toBe(false);
  });

  it("arranca con lo que ya está en la ficha administrativa", () => {
    expect(
      initialIntakeAnswers({ first_name: "Ana", last_name: "Ejemplo", birth_date: "1990-03-04", phone: "+595981111111", emergency_contact_name: "Luis", emergency_contact_phone: null }),
    ).toEqual({ nombre: "Ana Ejemplo", fecha_nacimiento: "1990-03-04", telefono: "+595981111111", contacto_emergencia: { nombre: "Luis" } });
    expect(initialIntakeAnswers({ first_name: "Ana", last_name: "Ejemplo", birth_date: null, phone: null, emergency_contact_name: null, emergency_contact_phone: null })).toEqual({ nombre: "Ana Ejemplo" });
  });
});

describe("ficha de ingreso: datos que pasan a la ficha administrativa", () => {
  const record = { birth_date: "1990-03-15", phone: "+595981222333", emergency_contact_name: "Marta, mi mamá", emergency_contact_phone: "+595981000010" };

  it("en el primer guardado pasa lo que difiere de la ficha administrativa", () => {
    expect(patientUpdates(record, { telefono: "+595981999888", fecha_nacimiento: "1990-03-15" }, null)).toEqual({ phone: "+595981999888" });
  });

  it("un valor viejo de la ficha no pisa una corrección posterior", () => {
    const previous = { telefono: "+595981111111", fecha_nacimiento: "1991-01-01", contacto_emergencia: { nombre: "Marta, mi mamá" } };
    // El paciente solo cambió «Sueño»; los datos personales siguen como estaban en la ficha.
    expect(patientUpdates(record, { ...previous, sueno: "Mejor" }, previous)).toEqual({});
  });

  it("si el paciente cambia el contacto de emergencia, se actualiza entero", () => {
    const previous = { contacto_emergencia: { nombre: "Marta, mi mamá", telefono: "+595981000010" } };
    expect(patientUpdates(record, { contacto_emergencia: { nombre: "Pedro, mi hermano" } }, previous)).toEqual({ emergency_contact_name: "Pedro, mi hermano", emergency_contact_phone: null });
    // Las claves en otro orden (como las devuelve jsonb) no cuentan como cambio.
    expect(patientUpdates({ ...record, emergency_contact_name: "Otra" }, { contacto_emergencia: { telefono: "+595981000010", nombre: "Marta, mi mamá" } }, previous)).toEqual({});
  });

  it("lo que queda en blanco no borra lo cargado", () => {
    expect(patientUpdates(record, {}, { telefono: "+595981222333", contacto_emergencia: { nombre: "Marta, mi mamá" } })).toEqual({});
  });

  it("el nombre del contacto tiene el mismo límite que el perfil", () => {
    expect(parseIntakeAnswers({ contacto_emergencia: { nombre: "a".repeat(121) } }).errors).toHaveProperty("contacto_emergencia");
    expect(parseIntakeAnswers({ contacto_emergencia: { nombre: "a".repeat(120) } }).errors).toBeNull();
  });
});
