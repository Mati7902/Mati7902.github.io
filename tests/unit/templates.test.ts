import { describe, expect, it } from "vitest";

import { renderTemplate, templateParams } from "@/server/services/whatsapp/templates";

describe("plantillas de mensajes", () => {
  it("reemplaza variables y limpia las faltantes", () => {
    const body = "Hola, {{first_name}}. Tu sesión es el {{date}} a las {{time}}. {{access_info}}";
    expect(renderTemplate(body, { first_name: "Juan", date: "Martes 14 de octubre", time: "18:00" })).toBe("Hola, Juan. Tu sesión es el Martes 14 de octubre a las 18:00.");
  });

  it("devuelve parámetros posicionales en el orden declarado para plantillas aprobadas", () => {
    const template = { key: "reminder_24h", channel: "whatsapp", title: null, body: "", variables: ["first_name", "professional_name", "time"], wa_template_name: "x", wa_template_language: "es", is_active: true };
    expect(templateParams(template, { first_name: "Ana", professional_name: "Lic. Sánchez" })).toEqual(["Ana", "Lic. Sánchez", "-"]);
  });
});
