import { describe, expect, it } from "vitest";

import { ageFrom, audiencesFor, groupByParts, isForAudience, visibleTemplates } from "@/lib/exercises/collections";

describe("público de los ejercicios", () => {
  const today = "2026-10-09";

  it("calcula la edad cumplida", () => {
    expect(ageFrom("2010-10-09", today)).toBe(16);
    expect(ageFrom("2010-10-10", today)).toBe(15);
    expect(ageFrom(null, today)).toBeNull();
    expect(ageFrom("no es fecha", today)).toBeNull();
    expect(ageFrom("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageFrom("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("muestra Brújula hasta los 18 y el material de adultos desde los 18", () => {
    expect(audiencesFor(15)).toEqual(["todos", "adolescentes"]);
    expect(audiencesFor(18)).toEqual(["todos", "adolescentes", "adultos"]);
    expect(audiencesFor(35)).toEqual(["todos", "adultos"]);
    expect(audiencesFor(null)).toEqual(["todos", "adultos"]);
  });

  it("agrupa un cuadernillo en sus partes y filtra por público", () => {
    const items = [{ sort_order: 114 }, { sort_order: 101 }, { sort_order: 103 }, { sort_order: 150 }];
    expect(groupByParts("brujula", items).map((g) => [g.title, g.items.map((i) => i.sort_order)])).toEqual([
      ["Empezar", [101]],
      ["Entender lo que me pasa", [103]],
      ["Seguir", [114]],
      ["Registros para repetir", [150]],
    ]);
    expect(isForAudience("adolescentes", audiencesFor(35))).toBe(false);
    expect(isForAudience(null, audiencesFor(35))).toBe(true);
  });

  it("un adulto no ve Brújula salvo que se lo asignen", () => {
    const templates = [
      { id: "a", audience: "todos" },
      { id: "b", audience: "adolescentes" },
      { id: "c", audience: "adultos" },
    ];
    expect(visibleTemplates(templates, audiencesFor(40), new Set()).map((t) => t.id)).toEqual(["a", "c"]);
    expect(visibleTemplates(templates, audiencesFor(40), new Set(["b"])).map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(visibleTemplates(templates, audiencesFor(15), new Set()).map((t) => t.id)).toEqual(["a", "b"]);
  });
});
