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
    // La normalización resuelve segmentos "." y ".." (también codificados): "/..//evil.com"
    // termina en "//evil.com", que el navegador interpreta como otro host. Se valida el resultado.
    const out = `${url.pathname}${url.search}${url.hash}`;
    if (!out.startsWith("/") || out.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(out)) return fallback;
    return out;
  } catch {
    return fallback;
  }
}
