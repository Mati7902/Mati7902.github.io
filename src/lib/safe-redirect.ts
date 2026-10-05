/**
 * Devuelve `next` solo si es una ruta interna segura; si no, `fallback`.
 * Evita open redirects del tipo `//evil.com`, `/\evil.com` (los navegadores tratan "\" como "/"),
 * `https://evil.com` o caracteres de control.
 */
export function safeInternalPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
