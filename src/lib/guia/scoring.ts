import type { Level, TestDef } from "./types";

/** Respuestas por índice de ítem (desde 0) → valor de la opción elegida. Solo vive en memoria. */
export type Answers = Record<number, string | undefined>;

export type AsqState = "empty" | "incomplete" | "neg" | "pending" | "nonacute" | "acute";
export type AsqResult = { state: AsqState; level: Level; label: string; detail: string; sentence: string };

export type TestResult = {
  answered: number;
  total: number;
  complete: boolean;
  /** Puntaje total; null en el ASQ y el TIPI, que no suman un total. */
  score: number | null;
  band: { label: string; level: Level } | null;
  flags: { level: Level; text: string }[];
  extras: string[];
  tipi: { name: string; value: number | null }[] | null;
  asq: AsqResult | null;
};

/** TIPI: dimensiones como [nombre, ítem directo, ítem invertido] (índices desde 0). */
export const TIPI_DIMS: [string, number, number][] = [
  ["Extraversión", 0, 5],
  ["Amabilidad", 6, 1],
  ["Responsabilidad", 2, 7],
  ["Estabilidad emocional", 8, 3],
  ["Apertura", 4, 9],
];

const answered = (v: string | undefined): v is string => v !== undefined && v !== "";

/** Puntos que aporta un ítem según el tipo de prueba; null si no se respondió. */
export function itemScore(def: TestDef, index: number, answers: Answers): number | null {
  const v = answers[index];
  const item = def.items[index];
  if (!item || !answered(v)) return null;
  if (def.kind === "yn") return v === item.key ? 1 : 0;
  if (def.kind === "ak") return (item.key === "a" ? Number(v) <= 2 : Number(v) >= 3) ? 1 : 0;
  const n = Number(v);
  return item.reverse && def.reverseSum !== undefined ? def.reverseSum - n : n;
}

export function tipiResult(def: TestDef, answers: Answers): { name: string; value: number | null }[] {
  const val = (i: number) => itemScore(def, i, answers);
  return TIPI_DIMS.map(([name, a, b]) => {
    const x = val(a);
    const y = val(b);
    return { name, value: x === null || y === null ? null : (x + y) / 2 };
  });
}

/** ASQ (NIMH): positivo si hay «sí» o falta respuesta en los ítems 1–4; agudo si el ítem 5 es «sí» o no responde. */
export function asqResult(answers: Answers): AsqResult {
  const first = [0, 1, 2, 3].map((i) => answers[i]);
  const q5 = answers[4];
  const empty = (label: string, state: AsqState, detail: string, sentence = ""): AsqResult => ({ state, level: "neu", label, detail, sentence });
  if (first.every((x) => !answered(x))) return empty("Sin aplicar", "empty", "Responda las preguntas 1 a 4.");
  const yes: number[] = [];
  const nr: number[] = [];
  first.forEach((x, i) => {
    if (x === "si") yes.push(i + 1);
    if (x === "nr") nr.push(i + 1);
  });
  if (!yes.length && !nr.length) {
    if (first.every((x) => x === "no")) {
      return {
        state: "neg",
        level: "ok",
        label: "ASQ negativo",
        detail: "Tamizaje negativo. No descarta el riesgo; repetir si cambian las circunstancias.",
        sentence: "Tamizaje ASQ negativo (sin respuesta afirmativa en los ítems 1 a 4).",
      };
    }
    return empty("Incompleto", "incomplete", "Falta responder alguno de los ítems 1 a 4.");
  }
  const plural = (n: number[], one: string, many: string) => (n.length > 1 ? many : one);
  const hit =
    (yes.length ? `afirmativo en ${plural(yes, "el ítem", "los ítems")} ${yes.join(", ")}` : "") +
    (nr.length ? `${yes.length ? "; " : ""}sin respuesta en ${plural(nr, "el ítem", "los ítems")} ${nr.join(", ")}` : "");
  if (q5 === "si" || q5 === "nr") {
    return {
      state: "acute",
      level: "crit",
      label: "ASQ positivo agudo",
      detail: "Pensamientos suicidas en este momento. Evaluación de seguridad inmediata; no dejar sola a la persona.",
      sentence: `Tamizaje ASQ positivo agudo (${hit}); ${q5 === "si" ? "refiere pensamientos suicidas en este momento" : "no responde sobre pensamientos suicidas actuales, por lo que se trata como positivo agudo hasta aclararlo"}.`,
    };
  }
  if (q5 === "no") {
    return {
      state: "nonacute",
      level: "warn",
      label: "ASQ positivo no agudo",
      detail: "Tamizaje positivo sin pensamientos actuales. Completar la evaluación breve de seguridad antes de que la persona se retire.",
      sentence: `Tamizaje ASQ positivo no agudo (${hit}); niega pensamientos suicidas en este momento.`,
    };
  }
  return {
    state: "pending",
    level: "warn",
    label: "ASQ positivo, falta el ítem 5",
    detail: "Tamizaje positivo: preguntar por pensamientos actuales (ítem 5) y completar la evaluación de seguridad.",
    sentence: `Tamizaje ASQ positivo (${hit}); falta preguntar por pensamientos suicidas en este momento.`,
  };
}

/** Calcula puntaje, banda, alertas y datos extra. La banda solo se informa con la prueba completa. */
export function scoreTest(def: TestDef, answers: Answers): TestResult {
  const total = def.items.length;
  const count = def.items.filter((_, i) => answered(answers[i])).length;
  const complete = count === total;
  const base = { answered: count, total, complete, band: null, flags: [], extras: [], tipi: null, asq: null, score: null } satisfies TestResult;

  if (def.kind === "asq") return { ...base, asq: asqResult(answers) };
  if (def.kind === "tipi") return { ...base, tipi: tipiResult(def, answers) };

  let score = 0;
  def.items.forEach((_, i) => {
    score += itemScore(def, i, answers) ?? 0;
  });

  let band: TestResult["band"] = null;
  if (complete && def.bands?.length) {
    const b = def.bands.find((x) => score <= x.upTo) ?? def.bands.at(-1);
    if (b) band = { label: b.label, level: b.level };
  }

  const flags: TestResult["flags"] = [];
  for (const f of def.flags ?? []) {
    const v = answers[f.item];
    if (!answered(v)) continue;
    const hit = "gt" in f.when ? Number(v) > f.when.gt : v === f.when.is;
    if (hit) flags.push({ level: f.level, text: f.text });
  }

  const extras: string[] = [];
  if (def.groups?.length && count > 0) {
    const sums = def.groups.map((g) => `${g.label} ${g.items.reduce((s, i) => s + (itemScore(def, i, answers) ?? 0), 0)}`);
    extras.push(`${def.groupsLabel ?? "Subescalas"}: ${sums.join(", ")}`);
    if (def.criteria && complete) {
      const { threshold, min, label } = def.criteria;
      const ok = def.groups.every((g) => g.items.filter((i) => Number(answers[i]) >= threshold).length >= (min[g.label] ?? 0));
      extras.push(`${label}: ${ok ? `cumple la distribución ${def.groups.map((g) => g.label).join(", ").replace(/, ([^,]*)$/, " y $1")}` : "no cumple la distribución"}`);
    }
  }

  return { ...base, score, band, flags, extras };
}

const comma = (n: number) => n.toFixed(1).replace(".", ",");

/** Texto listo para pegar en la nota clínica o en el HIS. */
export function summaryText(def: TestDef, answers: Answers, r: TestResult): string {
  if (r.asq) return r.asq.sentence || `ASQ: ${r.asq.label.toLowerCase()}.`;
  if (r.tipi) {
    const parts = r.tipi.filter((d) => d.value !== null).map((d) => `${d.name} ${comma(d.value as number)}`);
    return `TIPI (rasgos de personalidad, escala 1–7): ${parts.join("; ")}. Descriptivo; no constituye diagnóstico.`;
  }
  let t = `${def.name}: ${r.score}/${def.max}`;
  if (r.band) t += ` (${r.band.label})`;
  if (!r.complete) t += ` [parcial: ${r.answered}/${r.total} ítems]`;
  const rep = def.reportItem !== undefined ? answers[def.reportItem] : undefined;
  if (def.reportItem !== undefined && answered(rep)) t += `; ítem ${def.reportItem + 1} = ${rep}`;
  if (r.extras.length) t += `; ${r.extras.join("; ")}`;
  return `${t}.`;
}
