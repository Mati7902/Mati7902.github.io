import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath (sin open redirects)", () => {
  it("acepta rutas internas y conserva query y hash", () => {
    expect(safeInternalPath("/app/agenda", "/app")).toBe("/app/agenda");
    expect(safeInternalPath("/admin/agenda?vista=semana#hoy", "/app")).toBe("/admin/agenda?vista=semana#hoy");
  });

  it.each([
    ["vacío", ""],
    ["nulo", null],
    ["absoluta", "https://evil.example/login"],
    ["protocolo relativo", "//evil.example"],
    ["barra invertida", "/\\evil.example"],
    ["barra invertida codificada en medio", "/app\\..\\evil"],
    ["caracteres de control", "/app\n/evil"],
    ["sin barra inicial", "app/agenda"],
    ["javascript:", "javascript:alert(1)"],
  ])("rechaza %s", (_label, value) => {
    expect(safeInternalPath(value, "/app")).toBe("/app");
  });
});
