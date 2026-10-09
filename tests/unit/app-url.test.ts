import { describe, expect, it } from "vitest";

import { domainMismatch, resolveAppUrl } from "@/lib/app-url";

describe("dirección pública de la página", () => {
  it("usa NEXT_PUBLIC_APP_URL si está definida", () => {
    expect(resolveAppUrl("https://psicologia.example", "proyecto.vercel.app")).toBe("https://psicologia.example");
  });

  it("sin NEXT_PUBLIC_APP_URL, en Vercel usa el dominio de producción (el propio si hay uno conectado)", () => {
    expect(resolveAppUrl(undefined, "psicologiamatias.com")).toBe("https://psicologiamatias.com");
    expect(resolveAppUrl("", "proyecto.vercel.app")).toBe("https://proyecto.vercel.app");
  });

  it("perdona errores comunes al cargarla: barra final, espacios o falta de https://", () => {
    expect(resolveAppUrl("https://psicologia.example/")).toBe("https://psicologia.example");
    expect(resolveAppUrl("  psicologia.example//  ")).toBe("https://psicologia.example");
    expect(resolveAppUrl("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it("en desarrollo cae en localhost", () => {
    expect(resolveAppUrl(undefined, undefined)).toBe("http://localhost:3000");
    expect(resolveAppUrl("   ", "  ")).toBe("http://localhost:3000");
  });
});

describe("aviso de dominio sin terminar de conectar", () => {
  it("avisa si el panel se usa desde un dominio propio distinto del configurado", () => {
    expect(domainMismatch("psicologiamatias.com", "https://proyecto.vercel.app")).toEqual({ requestHost: "psicologiamatias.com", appHost: "proyecto.vercel.app" });
  });

  it("no avisa desde la misma dirección, con o sin www, ni desde Vercel o localhost", () => {
    expect(domainMismatch("psicologiamatias.com", "https://psicologiamatias.com")).toBeNull();
    expect(domainMismatch("www.psicologiamatias.com", "https://psicologiamatias.com")).toBeNull();
    expect(domainMismatch("PSICOLOGIAMATIAS.COM:443", "https://psicologiamatias.com")).toBeNull();
    expect(domainMismatch("proyecto-git-main.vercel.app", "https://psicologiamatias.com")).toBeNull();
    expect(domainMismatch("localhost:3000", "https://psicologiamatias.com")).toBeNull();
    expect(domainMismatch(null, "https://psicologiamatias.com")).toBeNull();
  });
});
