import { describe, expect, it } from "vitest";

import { contrast, readableOn } from "@/lib/color";

describe("colores de la marca", () => {
  it("calcula el contraste WCAG", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#1f4e5f", "#ffffff")).toBeGreaterThan(4.5);
  });

  it("elige texto blanco sobre colores oscuros y oscuro sobre colores claros", () => {
    expect(readableOn("#1f4e5f")).toBe("#ffffff");
    expect(readableOn("#a8dccb")).toBe("#12181b");
    expect(readableOn("#f2c94c")).toBe("#12181b");
    expect(readableOn("#5b2a86")).toBe("#ffffff");
  });
});
