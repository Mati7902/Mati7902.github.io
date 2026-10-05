import { describe, expect, it } from "vitest";

import { isWithinServiceWindow } from "@/server/services/appointment-notifications";

const now = new Date("2026-10-12T15:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("ventana de atención de 24 h de WhatsApp", () => {
  it("sin mensajes del contacto no hay ventana abierta (se requiere plantilla)", () => {
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });

  it("dentro de la ventana se puede responder con texto libre", () => {
    expect(isWithinServiceWindow(hoursAgo(1), now)).toBe(true);
    expect(isWithinServiceWindow(hoursAgo(23.5), now)).toBe(true);
  });

  it("deja un margen de 15 minutos antes del cierre", () => {
    expect(isWithinServiceWindow(hoursAgo(23.8), now)).toBe(false);
    expect(isWithinServiceWindow(hoursAgo(30), now)).toBe(false);
  });
});
