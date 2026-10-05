import { describe, expect, it } from "vitest";

import { buildCrisisMessage, detectCrisis } from "@/server/services/ai/crisis";

describe("detección de crisis", () => {
  it.each([
    ["no quiero seguir viviendo", "suicidio"],
    ["Me quiero matar", "suicidio"],
    ["me corté otra vez", "autolesion"],
    ["mi novio me pega", "violencia"],
    ["me tomé todas las pastillas", "sobredosis"],
    ["creo que me intoxiqué", "intoxicacion"],
    ["estoy en peligro, auxilio", "peligro_inmediato"],
  ])("detecta «%s» como %s", (text, category) => {
    const result = detectCrisis(text);
    expect(result.detected).toBe(true);
    expect(result.categories).toContain(category);
  });

  it("no marca mensajes administrativos comunes", () => {
    for (const text of ["quiero sacar un turno para el martes", "cuánto sale la consulta", "gracias, confirmo", "me cuesta dormir últimamente"]) {
      expect(detectCrisis(text).detected).toBe(false);
    }
  });

  it("arma el protocolo con recursos verificados y aclaración de contacto", () => {
    const msg = buildCrisisMessage({
      message: "Si existe riesgo inmediato, buscá atención de urgencia.",
      contactNote: "WhatsApp no garantiza respuesta inmediata.",
      showContactProfessional: true,
      resources: [
        { name: "Emergencias", phone: "911", url: null },
        { name: "Sin datos", phone: null, url: null },
      ],
      professionalName: "Lic. Matías Sánchez",
    });
    expect(msg).toContain("Emergencias: 911");
    expect(msg).not.toContain("Sin datos");
    expect(msg).toContain("no garantiza respuesta inmediata");
  });
});
