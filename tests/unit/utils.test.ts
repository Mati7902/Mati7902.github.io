import { describe, expect, it } from "vitest";

import { formatCurrency, getInitials, normalizePhone, truncate } from "@/lib/utils";
import { formatTime, humanDay, toDateKey, zonedToUtc } from "@/lib/dates";

describe("utilidades", () => {
  it("normaliza teléfonos paraguayos a E.164", () => {
    expect(normalizePhone("0981 123 456")).toBe("+595981123456");
    expect(normalizePhone("+595 981 123456")).toBe("+595981123456");
    expect(normalizePhone("595981123456")).toBe("+595981123456");
    expect(normalizePhone("981123456")).toBe("+595981123456");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("formatea guaraníes sin decimales y maneja precios a consultar", () => {
    expect(formatCurrency(150000)).toBe("Gs. 150.000");
    expect(formatCurrency(null)).toBe("A consultar");
  });

  it("obtiene iniciales y trunca textos", () => {
    expect(getInitials("Juan Pérez")).toBe("JP");
    expect(getInitials("Ana")).toBe("A");
    expect(truncate("abcdefghij", 6)).toBe("abcde…");
  });
});

describe("fechas en America/Asuncion", () => {
  it("convierte fecha local + hora a UTC y viceversa", () => {
    const utc = zonedToUtc("2026-10-13", "18:00", "America/Asuncion");
    expect(utc.toISOString()).toBe("2026-10-13T21:00:00.000Z");
    expect(formatTime(utc, "America/Asuncion")).toBe("18:00");
    expect(toDateKey(utc, "America/Asuncion")).toBe("2026-10-13");
  });

  it("describe el día de forma humana", () => {
    expect(humanDay(new Date(), "America/Asuncion")).toBe("Hoy");
    expect(humanDay(new Date(Date.now() + 24 * 3600_000), "America/Asuncion")).toBe("Mañana");
  });
});
