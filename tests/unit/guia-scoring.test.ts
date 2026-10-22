import { describe, expect, it } from "vitest";

import { FICHAS, PROTOCOLS, TEMAS, TESTS, getFicha, getProtocol, getTest, testForName } from "@/lib/guia/guia";
import { type Answers, asqResult, scoreTest, summaryText, tipiResult } from "@/lib/guia/scoring";
import type { TestDef } from "@/lib/guia/types";

const test = (id: string): TestDef => {
  const t = getTest(id);
  if (!t) throw new Error(`falta el test ${id}`);
  return t;
};

/** Responde todos los ítems con fn(índice, ítem). */
const fill = (def: TestDef, fn: (i: number, item: TestDef["items"][number]) => string | number): Answers =>
  Object.fromEntries(def.items.map((it, i) => [i, String(fn(i, it))]));

describe("contenido de la guía", () => {
  it("trae todos los tests, fichas, protocolos y temas", () => {
    expect(TESTS).toHaveLength(15);
    expect(FICHAS).toHaveLength(7);
    expect(PROTOCOLS).toHaveLength(12);
    expect(TEMAS).toHaveLength(7);
  });

  it("los ids son únicos", () => {
    for (const ids of <(string | number)[][]>[TESTS.map((t) => t.id), FICHAS.map((f) => f.id), PROTOCOLS.map((p) => p.id), TEMAS.map((t) => t.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("cada test tiene ítems, opciones y bandas ordenadas", () => {
    for (const t of TESTS) {
      expect(t.items.length, t.id).toBeGreaterThan(0);
      expect(t.options.length, t.id).toBeGreaterThan(1);
      const ups = (t.bands ?? []).map((b) => b.upTo);
      expect([...ups].sort((a, b) => a - b), t.id).toEqual(ups);
      if (t.bands?.length) expect(t.bands.at(-1)?.upTo, t.id).toBeGreaterThanOrEqual(t.max);
      for (const f of t.flags ?? []) expect(f.item, t.id).toBeLessThan(t.items.length);
      for (const g of t.groups ?? []) for (const i of g.items) expect(i, t.id).toBeLessThan(t.items.length);
    }
  });

  it("cada protocolo tiene sesiones numeradas, objetivo y contenido", () => {
    for (const p of PROTOCOLS) {
      expect(p.sessions.length, String(p.id)).toBeGreaterThanOrEqual(5);
      p.sessions.forEach((s, i) => {
        // El protocolo 7 agrupa las sesiones 5 a 8 en una sola entrada (nivel B, con formación específica).
        if (s.n !== "5 a 8") expect(s.n, `${p.id}.${i}`).toBe(String(i + 1));
        if (s.n === "5 a 8") {
          expect(s.extra.length).toBeGreaterThan(0);
          return;
        }
        // La sesión de cierre de varios protocolos no declara un objetivo aparte.
        if (i < 7) expect(s.objective, `${p.id}.${i}`).not.toBe("");
        expect(s.contents.length, `${p.id}.${i}`).toBeGreaterThan(0);
      });
    }
  });

  it("las fichas remiten a protocolos que existen", () => {
    for (const f of FICHAS) for (const id of f.protocols) expect(getProtocol(id), `${f.id} → ${id}`).toBeDefined();
    expect(getFicha("tea")?.codes).toEqual(["F84"]);
  });

  it("no queda HTML crudo en los textos", () => {
    const raw = JSON.stringify([FICHAS, PROTOCOLS, TEMAS]);
    expect(raw).not.toMatch(/<\/?(p|ul|ol|li|strong|table|h3|blockquote)>/);
  });

  it("une el nombre de la medición de un protocolo con el test aplicable", () => {
    expect(testForName("PHQ-9")?.id).toBe("phq9");
    expect(testForName("GAD-7")?.id).toBe("gad7");
    expect(testForName("Y-BOCS")).toBeUndefined();
  });
});

describe("puntaje y bandas", () => {
  it("PHQ-9: todo 2 suma 18 (moderadamente grave) y alerta por el ítem 9", () => {
    const def = test("phq9");
    const a = fill(def, () => 2);
    const r = scoreTest(def, a);
    expect(r.score).toBe(18);
    expect(r.band?.label).toBe("moderadamente grave");
    expect(r.flags).toHaveLength(1);
    expect(summaryText(def, a, r)).toBe("PHQ-9: 18/27 (moderadamente grave); ítem 9 = 2.");
  });

  it("PHQ-9: sin ítem 9 positivo no hay alerta", () => {
    const def = test("phq9");
    const r = scoreTest(def, fill(def, (i) => (i === 8 ? 0 : 1)));
    expect(r.score).toBe(8);
    expect(r.flags).toHaveLength(0);
  });

  it("la banda solo se informa con la prueba completa", () => {
    const def = test("gad7");
    const r = scoreTest(def, { 0: "3", 1: "3" });
    expect(r.score).toBe(6);
    expect(r.complete).toBe(false);
    expect(r.band).toBeNull();
    expect(summaryText(def, { 0: "3", 1: "3" }, r)).toContain("[parcial: 2/7 ítems]");
  });

  it.each([
    ["gds15", (_i: number, it: { key?: string }) => (it.key === "si" ? "si" : "no"), 15, "depresión grave"],
    ["gad7", () => 3, 21, "grave"],
    ["spin", () => 4, 68, "muy grave"],
    ["ocir", () => 1, 18, "por debajo"],
    ["pcl5", () => 2, 40, "sugiere probable TEPT"],
    ["sapas", (_i: number, it: { key?: string }) => it.key ?? "si", 8, "positivo"],
    ["msibpd", () => "si", 10, "positivo"],
    ["aq10", (_i: number, it: { key?: string }) => (it.key === "a" ? 1 : 4), 10, "derivar"],
    ["ais", () => 1, 8, "sugiere insomnio"],
    ["scoff", () => "si", 5, "positivo"],
    ["plut", () => "si", 15, "positiva"],
  ])("%s: puntaje máximo / de ejemplo %i", (id, fn, score, label) => {
    const def = test(id);
    const r = scoreTest(def, fill(def, fn as (i: number, item: TestDef["items"][number]) => string | number));
    expect(r.score).toBe(score);
    expect(r.band?.label).toContain(label);
  });

  it("GDS-15: los ítems 1, 5, 7, 11 y 13 puntúan con «No»", () => {
    const def = test("gds15");
    const allNo = scoreTest(def, fill(def, () => "no"));
    expect(allNo.score).toBe(5);
    expect(allNo.band?.label).toBe("depresión leve probable");
  });

  it("Rosenberg invierte los ítems 6 a 10 (todo 4 → 25, baja)", () => {
    const def = test("rses");
    const r = scoreTest(def, fill(def, () => 4));
    expect(r.score).toBe(25);
    expect(r.band?.label).toBe("autoestima baja");
    expect(scoreTest(def, fill(def, (_i, it) => (it.reverse ? 1 : 4))).score).toBe(40);
  });

  it("AQ-10: puntúa el sentido del TEA según el ítem", () => {
    const def = test("aq10");
    expect(scoreTest(def, fill(def, (_i, it) => (it.key === "a" ? 1 : 4))).score).toBe(10);
    expect(scoreTest(def, fill(def, (_i, it) => (it.key === "a" ? 4 : 1))).score).toBe(0);
  });

  it("OCI-R: informa las subescalas", () => {
    const def = test("ocir");
    const r = scoreTest(def, fill(def, () => 3));
    expect(r.score).toBe(54);
    expect(r.band?.label).toContain("sugiere TOC");
    expect(r.extras[0]).toContain("Lavado 9");
  });

  it("PCL-5: grupos y criterios provisionales", () => {
    const def = test("pcl5");
    const yes = scoreTest(def, fill(def, () => 2));
    expect(yes.extras[0]).toBe("Grupos de síntomas: B 10, C 4, D 14, E 12");
    expect(yes.extras[1]).toContain("cumple la distribución B, C, D y E");
    const no = scoreTest(def, fill(def, (i) => (i < 5 ? 0 : 2)));
    expect(no.extras[1]).toContain("no cumple la distribución");
  });

  it("MSI-BPD: el ítem 2 afirmativo alerta", () => {
    const def = test("msibpd");
    expect(scoreTest(def, { 1: "si" }).flags).toHaveLength(1);
    expect(scoreTest(def, { 1: "no" }).flags).toHaveLength(0);
  });

  it("Plutchik: el ítem 13 afirmativo alerta aunque el total sea bajo", () => {
    const def = test("plut");
    const r = scoreTest(def, { 12: "si" });
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]?.level).toBe("crit");
  });
});

describe("TIPI", () => {
  it("invierte los ítems 2, 4, 6, 8 y 10", () => {
    const def = test("tipi");
    const answers = fill(def, (_i, it) => (it.reverse ? 1 : 7));
    expect(tipiResult(def, answers).every((d) => d.value === 7)).toBe(true);
    expect(tipiResult(def, fill(def, () => 4)).every((d) => d.value === 4)).toBe(true);
  });

  it("no informa una dimensión incompleta", () => {
    const def = test("tipi");
    const dims = tipiResult(def, { 0: "7" });
    expect(dims[0]?.value).toBeNull();
  });

  it("el resumen usa coma decimal", () => {
    const def = test("tipi");
    const a = fill(def, () => 4);
    expect(summaryText(def, a, scoreTest(def, a))).toContain("Extraversión 4,0");
  });
});

describe("ASQ", () => {
  it("sin respuestas está vacío", () => {
    expect(asqResult({}).state).toBe("empty");
  });
  it("negativo con cuatro «no»", () => {
    const r = asqResult({ 0: "no", 1: "no", 2: "no", 3: "no" });
    expect(r.state).toBe("neg");
    expect(r.level).toBe("ok");
  });
  it("incompleto si falta algún ítem y no hay «sí»", () => {
    expect(asqResult({ 0: "no", 1: "no" }).state).toBe("incomplete");
  });
  it("un «sí» sin ítem 5 queda pendiente", () => {
    const r = asqResult({ 0: "si", 1: "no", 2: "no", 3: "no" });
    expect(r.state).toBe("pending");
    expect(r.sentence).toContain("afirmativo en el ítem 1");
  });
  it("positivo no agudo con ítem 5 = no", () => {
    expect(asqResult({ 0: "si", 4: "no" }).state).toBe("nonacute");
  });
  it("positivo agudo con ítem 5 = sí, y también si no responde", () => {
    expect(asqResult({ 2: "si", 4: "si" }).state).toBe("acute");
    const nr = asqResult({ 1: "si", 4: "nr" });
    expect(nr.state).toBe("acute");
    expect(nr.sentence).toContain("se trata como positivo agudo");
  });
  it("«no responde» en los ítems 1 a 4 cuenta como positivo", () => {
    expect(asqResult({ 0: "no", 1: "no", 2: "nr", 3: "no" }).state).toBe("pending");
  });
  it("el resultado del test usa el ASQ", () => {
    const def = test("asq");
    const r = scoreTest(def, { 0: "si", 4: "si" });
    expect(r.asq?.state).toBe("acute");
    expect(r.score).toBeNull();
  });
});
