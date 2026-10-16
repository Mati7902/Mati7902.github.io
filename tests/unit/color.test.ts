import { describe, expect, it } from "vitest";

import { contrast, readableOn } from "@/lib/color";
import { themeSchema } from "@/server/services/settings";

describe("colores de la marca", () => {
  it("calcula el contraste WCAG", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#2f6468", "#ffffff")).toBeGreaterThan(4.5);
  });

  it("elige texto blanco sobre colores oscuros y oscuro sobre colores claros", () => {
    expect(readableOn("#2f6468")).toBe("#ffffff");
    expect(readableOn("#27b088")).toBe("#12181b");
    expect(readableOn("#f2c94c")).toBe("#12181b");
    expect(readableOn("#5b2a86")).toBe("#ffffff");
  });

  it("la paleta predeterminada es legible", () => {
    const theme = themeSchema.parse({});
    expect(theme).toEqual({ primary: "#2f6468", accent: "#27b088", background: "#fbfdfc" });
    expect(contrast(theme.primary, readableOn(theme.primary))).toBeGreaterThan(4.5);
    expect(contrast(theme.accent, readableOn(theme.accent))).toBeGreaterThan(4.5);
    expect(contrast("#0f2333", theme.background)).toBeGreaterThan(7);
  });
});
