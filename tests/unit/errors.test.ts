import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, fail, fromDatabaseError, ok, validationFail } from "@/lib/errors";
import { parseForm, zodFieldErrors } from "@/lib/validation";

describe("manejo de errores", () => {
  it("traduce errores de Postgres a mensajes claros", () => {
    expect(fromDatabaseError({ code: "23P01", message: "El horario ya no está disponible" }).code).toBe("CONFLICT");
    expect(fromDatabaseError({ code: "23P01", message: "El horario está bloqueado" }).message).toContain("bloqueado");
    expect(fromDatabaseError({ code: "42501", message: "permission denied" })).toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(fromDatabaseError({ code: "P0001", message: "Este turno ya no puede cancelarse" }).message).toBe("Este turno ya no puede cancelarse");
    // Una regla de negocio no es un problema de datos del formulario: no se debe reintentar igual.
    expect(fromDatabaseError({ code: "P0001", message: "Este turno ya no puede cancelarse" }).code).toBe("FORBIDDEN");
    expect(fromDatabaseError({ code: "22023", message: "Ese horario está fuera de la disponibilidad del profesional." }).code).toBe("VALIDATION");
    expect(fromDatabaseError(null).code).toBe("UNKNOWN");
  });

  it("serializa resultados de acciones sin filtrar detalles internos", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
    const failed = fail(new AppError("RATE_LIMITED", "Demasiados intentos."));
    expect(failed).toEqual({ ok: false, error: "Demasiados intentos.", code: "RATE_LIMITED" });
    expect(fail(new Error("stack interno secreto"))).toMatchObject({ ok: false, code: "UNKNOWN", error: expect.not.stringContaining("secreto") });
    expect(validationFail({ email: "Inválido" })).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { email: "Inválido" } });
  });
});

describe("validación de formularios", () => {
  const schema = z.object({ email: z.string().email("Email inválido."), tags: z.array(z.string()).default([]), remember: z.coerce.boolean().default(false) });

  it("convierte FormData a datos tipados y errores por campo", () => {
    const fd = new FormData();
    fd.set("email", "no-es-email");
    fd.append("tags[]", "a");
    fd.append("tags[]", "b");
    fd.set("$ACTION_ID", "ignorado");
    const bad = parseForm(schema, fd);
    expect(bad.errors).toEqual({ email: "Email inválido." });
    fd.set("email", "ok@example.com");
    fd.set("remember", "true");
    const good = parseForm(schema, fd);
    expect(good.data).toEqual({ email: "ok@example.com", tags: ["a", "b"], remember: true });
  });

  it("mapea rutas anidadas de Zod", () => {
    const nested = z.object({ links: z.object({ instagram: z.string().url() }) });
    const result = nested.safeParse({ links: { instagram: "x" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(zodFieldErrors(result.error))).toEqual(["links.instagram"]);
  });
});
