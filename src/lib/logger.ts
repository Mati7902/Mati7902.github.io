/**
 * Logger estructurado y mínimo (JSON en producción, legible en desarrollo).
 * Compatible con herramientas como Sentry / Logtail / Vercel Logs.
 * REGLA: nunca registrar contenido clínico ni datos sensibles innecesarios.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const threshold = LEVELS[configured] ?? LEVELS.info;

const SENSITIVE_KEYS = new Set([
  "password", "token", "access_token", "refresh_token", "authorization", "secret",
  "body", "thought", "situation", "behavior", "need", "answers", "hardest", "important",
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(meta ? (sanitize(meta) as Record<string, unknown>) : {}),
  };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(entry) : `[${level}] ${scope}: ${message}${meta ? " " + JSON.stringify(sanitize(meta)) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => write("debug", scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => write("info", scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => write("warn", scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => write("error", scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** Serializa un error desconocido de forma segura para logs. */
export function errorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, name: error.name, stack: process.env.NODE_ENV === "production" ? undefined : error.stack };
  }
  if (error && typeof error === "object") {
    // `details` de Postgres puede incluir valores de la fila (p. ej. "Key (email)=(...)"): no se registra.
    const e = error as { message?: unknown; code?: unknown; status?: unknown };
    return {
      error: typeof e.message === "string" ? e.message : "error sin mensaje",
      code: e.code,
      status: e.status,
    };
  }
  return { error: String(error) };
}
