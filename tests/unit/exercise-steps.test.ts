import { describe, expect, it } from "vitest";

import { answerEntries, interpolate, isInputStep, isStepAnswered, parseBreathingConfig, parseSteps } from "@/lib/exercises/steps";

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
    expect(interpolate("Mi plan: {{plan}}.", { plan: ["Caminar", " ", "", "Llamar a Ana"] })).toBe("Mi plan: Caminar, Llamar a Ana.");
    expect(interpolate("{{plan}} / {{skip}}", { plan: ["", ""], skip: "" })).toBe("… / …");
  });

  it("acepta selección múltiple, devoluciones por opción y listas con mínimo", () => {
    const steps = parseSteps([
      { id: "values", type: "checklist", prompt: "¿Qué te importa?", options: ["Amigos", "Familia", "Salud"], max: 2 },
      { id: "quiz", type: "choice", prompt: "«Soy un burro»", options: ["Hecho", "Pensamiento"], feedback: { Pensamiento: "Bien: es una etiqueta." } },
      { id: "people", type: "list", prompt: "Personas de confianza", count: 5, min: 2 },
    ]);
    expect(steps).toHaveLength(3);
    expect(steps.every(isInputStep)).toBe(true);
    expect(parseSteps([{ id: "x", type: "checklist", prompt: "?", options: ["solo una"] }])).toEqual([]);
  });

  it("decide si una respuesta alcanza para seguir", () => {
    const [values, quiz, people, scale] = parseSteps([
      { id: "values", type: "checklist", prompt: "?", options: ["A", "B", "C"], max: 2 },
      { id: "quiz", type: "choice", prompt: "?", options: ["A", "B"] },
      { id: "people", type: "list", prompt: "?", count: 5, min: 2 },
      { id: "s", type: "scale", prompt: "?" },
    ]);
    expect(isStepAnswered(values!, [])).toBe(false);
    expect(isStepAnswered(values!, ["A"])).toBe(true);
    expect(isStepAnswered(values!, ["A", "B", "C"])).toBe(false);
    expect(isStepAnswered(quiz!, "")).toBe(false);
    expect(isStepAnswered(quiz!, "B")).toBe(true);
    expect(isStepAnswered(people!, ["Ana", " ", "", "", ""])).toBe(false);
    expect(isStepAnswered(people!, ["Ana", "Tío Juan", "", "", ""])).toBe(true);
    expect(isStepAnswered(scale!, undefined)).toBe(true);
  });

  it("arma pares pregunta → respuesta para el historial", () => {
    const steps = parseSteps([
      { id: "intro", type: "info", content: "Hola" },
      { id: "what", type: "text", prompt: "¿Qué pasó?" },
      { id: "how", type: "scale", prompt: "¿Cuánto?", min: 0, max: 100 },
      { id: "mood", type: "emotion", prompt: "¿Qué sentiste?" },
      { id: "tools", type: "checklist", prompt: "Herramientas", options: ["Respirar", "Caminar"] },
      { id: "people", type: "list", prompt: "Personas", count: 3, min: 1 },
      { id: "skip", type: "text", prompt: "Opcional", optional: true },
    ]);
    expect(answerEntries(steps, { what: " Discutí con mi papá ", how: 80, mood: "triste", tools: ["Caminar"], people: ["Abuela", "", " "], skip: "" })).toEqual([
      { id: "what", label: "¿Qué pasó?", value: "Discutí con mi papá" },
      { id: "how", label: "¿Cuánto?", value: "80 de 100" },
      { id: "mood", label: "¿Qué sentiste?", value: "Triste" },
      { id: "tools", label: "Herramientas", value: ["Caminar"] },
      { id: "people", label: "Personas", value: ["Abuela"] },
    ]);
    expect(answerEntries([], { duration_minutes: 3 })).toEqual([{ id: "duration_minutes", label: "Duración", value: "3 min" }]);
  });
});
