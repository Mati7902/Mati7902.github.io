import { toDateKey } from "@/lib/dates";

/**
 * Público y colecciones de los ejercicios (columnas audience y collection de exercise_templates).
 * Las colecciones son los cuadernillos del profesional: se muestran como un recorrido en orden.
 */
export type Audience = "todos" | "adolescentes" | "adultos";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  todos: "Todos",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
};

/** Partes del recorrido, por rango de sort_order (como el índice del cuadernillo). */
export type CollectionPart = { title: string; from: number; to: number };
/** Plan para momentos muy difíciles (Brújula, página 14): tiene acceso rápido desde Calmarme. */
export const PLAN_SLUG = "brujula-plan-momentos-dificiles";

export type CollectionInfo = { title: string; description: string; audience: Audience; parts: CollectionPart[] };

export const COLLECTIONS: Record<string, CollectionInfo> = {
  brujula: {
    title: "Brújula",
    description: "Tu cuadernillo para entender lo que sentís, manejar momentos difíciles y acercarte a la vida que querés. De a una página por vez, entre sesión y sesión.",
    audience: "adolescentes",
    parts: [
      { title: "Empezar", from: 100, to: 101 },
      { title: "Entender lo que me pasa", from: 102, to: 104 },
      { title: "Probar cosas nuevas", from: 105, to: 109 },
      { title: "Cuidarme y pedir ayuda", from: 110, to: 113 },
      { title: "Seguir", from: 114, to: 199 },
    ],
  },
  tcc: {
    title: "Cuadernillo de Terapia Cognitivo-Conductual",
    description: "Siete capítulos para entender cómo influyen los pensamientos en lo que sentís y hacés, con prácticas y registros para cada uno.",
    audience: "adultos",
    parts: [
      { title: "Capítulos", from: 200, to: 209 },
      { title: "Registros para repetir", from: 210, to: 219 },
      { title: "Para consultar", from: 220, to: 299 },
    ],
  },
};

/** Agrupa los ejercicios de una colección en sus partes, en orden; lo que no encaja va al final. */
export function groupByParts<T extends { sort_order: number }>(collection: string, items: T[]): { title: string | null; items: T[] }[] {
  const parts = COLLECTIONS[collection]?.parts ?? [];
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const groups = parts.map((part) => ({ title: part.title as string | null, items: sorted.filter((i) => i.sort_order >= part.from && i.sort_order <= part.to) }));
  const rest = sorted.filter((i) => !parts.some((part) => i.sort_order >= part.from && i.sort_order <= part.to));
  return [...groups, { title: null, items: rest }].filter((g) => g.items.length > 0);
}

/** ¿Este ejercicio se le ofrece a este paciente? (lo asignado se muestra aparte, siempre). */
export function isForAudience(audience: string | null | undefined, allowed: Audience[]): boolean {
  return allowed.includes((audience ?? "todos") as Audience);
}

/**
 * Edad cumplida a partir de "aaaa-mm-dd", comparando fechas de calendario en la zona del
 * consultorio (sin pasar por Date, que corre la fecha según la zona del servidor).
 */
export function ageFrom(birthDate: string | null | undefined, todayKey: string = toDateKey(new Date())): number | null {
  const birth = birthDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate) : null;
  const today = /^(\d{4})-(\d{2})-(\d{2})/.exec(todayKey);
  if (!birth || !today) return null;
  let age = Number(today[1]) - Number(birth[1]);
  if (`${today[2]}${today[3]}` < `${birth[2]}${birth[3]}`) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Qué públicos ve un paciente en su lista. Hasta los 18 años, el material para adolescentes;
 * desde los 18, el de adultos (a los 18 justos, los dos). Sin fecha de nacimiento cargada se
 * asume adulto: el material para adolescentes se puede asignar desde la ficha.
 */
export function audiencesFor(age: number | null): Audience[] {
  if (age === null) return ["todos", "adultos"];
  if (age < 18) return ["todos", "adolescentes"];
  if (age === 18) return ["todos", "adolescentes", "adultos"];
  return ["todos", "adultos"];
}

/**
 * Ejercicios activos que un paciente ve en su lista: los de su público y, además, los que el
 * profesional le asignó (aunque sean de otro público).
 */
export function visibleTemplates<T extends { id: string; audience?: string | null }>(templates: T[], allowed: Audience[], assignedIds: Set<string>): T[] {
  return templates.filter((t) => assignedIds.has(t.id) || isForAudience(t.audience, allowed));
}
