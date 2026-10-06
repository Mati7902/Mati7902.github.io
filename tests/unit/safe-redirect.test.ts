import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath (sin open redirects)", () => {
  it("normaliza segmentos inofensivos sin salir del sitio", () => {
    expect(safeInternalPath("/app/./agenda", "/app")).toBe("/app/agenda");
    expect(safeInternalPath("/app/x/../agenda", "/app")).toBe("/app/agenda");
  });

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
    ["segmento . antes de //", "/.//evil.example"],
    ["segmento .. antes de //", "/..//evil.example"],
    ["subcarpeta y ..", "/a/..//evil.example"],
    ["puntos codificados", "/%2e%2e//evil.example"],
    ["punto codificado en mayúscula", "/%2E//evil.example"],
    ["mezcla de punto literal y codificado", "/.%2e//evil.example"],
  ])("rechaza %s", (_label, value) => {
    expect(safeInternalPath(value, "/app")).toBe("/app");
  });
});
