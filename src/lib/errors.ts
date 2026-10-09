/**
 * Errores de dominio con mensajes aptos para mostrar al usuario.
 * Los mensajes técnicos van al log; al usuario siempre le llega algo claro y en español.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "EXTERNAL"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, options?: { status?: number; details?: unknown; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? defaultStatus(code);
    this.details = options?.details;
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 400;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "NOT_CONFIGURED":
      return 503;
    case "EXTERNAL":
      return 502;
    default:
      return 500;
  }
}

type PostgrestLikeError = { code?: string; message?: string; details?: string; hint?: string };

/** Traduce errores de Postgres/PostgREST a mensajes claros. */
export function fromDatabaseError(error: PostgrestLikeError | null | undefined, fallback = "No pudimos completar la operación."): AppError {
  if (!error) return new AppError("UNKNOWN", fallback);
  const message = error.message ?? fallback;
  switch (error.code) {
    case "23P01": // exclusion_violation (double booking / bloqueo)
      return new AppError("CONFLICT", message.includes("bloqueado") ? "Ese horario está bloqueado." : "Ese horario ya no está disponible. Elegí otro.", { details: error });
    case "23505":
      return new AppError("CONFLICT", "Ya existe un registro con esos datos.", { details: error });
    case "42501":
      return new AppError("FORBIDDEN", "No tenés permiso para realizar esta acción.", { details: error });
    case "P0001": // regla de negocio que impide la acción (ventanas, estados): mensaje para el usuario
      return new AppError("FORBIDDEN", message, { details: error });
    case "P0002":
      return new AppError("NOT_FOUND", "No encontramos lo que buscabas.", { details: error });
    case "22023":
      return new AppError("VALIDATION", message, { details: error });
    case "PGRST116":
      return new AppError("NOT_FOUND", "No encontramos lo que buscabas.", { details: error });
    default:
      return new AppError("UNKNOWN", fallback, { details: error });
  }
}

/** Resultado estándar de server actions: nunca lanzar al cliente, siempre devolver un objeto. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AppErrorCode; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: unknown, fallback = "Ocurrió un error inesperado. Intentá de nuevo."): ActionResult<T> {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    const appError = fromDatabaseError(error as PostgrestLikeError, fallback);
    return { ok: false, error: appError.message, code: appError.code };
  }
  return { ok: false, error: fallback, code: "UNKNOWN" };
}

export function validationFail<T = undefined>(fieldErrors: Record<string, string>, message = "Revisá los campos marcados."): ActionResult<T> {
  return { ok: false, error: message, code: "VALIDATION", fieldErrors };
}
