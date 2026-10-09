import { describe, expect, it } from "vitest";

import { interpolate, isInputStep, parseBreathingConfig, parseSteps } from "@/lib/exercises/steps";

describe("esquema de pasos de ejercicios", () => {
  it("valida pasos correctos y descarta JSON inválido", () => {
    const steps = parseSteps([
      { id: "situation", type: "text", prompt: "¿Qué ocurrió?" },
      { id: "intensity", type: "scale", prompt: "¿Qué intensidad tuvo?", min: 0, max: 10, maps_to: "emotion_before" },
      { id: "intro", type: "info", content: "Texto" },
    ]);
    expect(steps).toHaveLength(3);
    expect(steps.filter(isInputStep)).toHaveLength(2);
    expect(parseSteps([{ id: "x", type: "unknown" }])).toEqual([]);
    expect(parseSteps("no es un array")).toEqual([]);
  });

  it("parsea la configuración de respiración", () => {
    expect(parseBreathingConfig({ pattern: { inhale: 4, exhale: 6 }, durations: [1, 3, 5] })).toMatchObject({ pattern: { inhale: 4, hold: 0, exhale: 6, hold_after: 0 } });
    expect(parseBreathingConfig({ pattern: { inhale: 0, exhale: 6 } })).toBeNull();
  });

  it("interpola respuestas previas en plantillas de defusión", () => {
    expect(interpolate("Estoy teniendo el pensamiento de que {{thought}}.", { thought: "soy un fracaso" })).toBe("Estoy teniendo el pensamiento de que soy un fracaso.");
    expect(interpolate("{{missing}}", {})).toBe("…");
  });
});
