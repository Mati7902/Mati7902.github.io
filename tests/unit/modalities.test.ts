import { describe, expect, it } from "vitest";

import { MODALITY_COPY, modalityMode } from "@/lib/modalities";

describe("modalidades de atención", () => {
  it("distingue online, presencial y ambas", () => {
    expect(modalityMode(["virtual"])).toBe("online");
    expect(modalityMode(["presencial"])).toBe("presencial");
    expect(modalityMode(["presencial", "virtual"])).toBe("mixta");
  });

  it("trata la lista vacía como ambas modalidades", () => {
    expect(modalityMode([])).toBe("mixta");
  });

  it("no promete videollamadas cuando la atención es solo presencial", () => {
    const copy = MODALITY_COPY[modalityMode(["presencial"])];
    expect(`${copy.label} ${copy.highlight} ${copy.heading} ${copy.intro}`).not.toMatch(/online|videollamada/i);
  });
});
