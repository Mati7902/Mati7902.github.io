import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Devuelve las iniciales (máximo 2) de un nombre completo para avatares. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Normaliza un teléfono a formato E.164 básico (solo dígitos con prefijo +). */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "595"): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Números locales paraguayos que empiezan con 0 (ej: 0981 123 456).
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) {
    digits = defaultCountryCode + digits.slice(1);
  } else if (digits.length <= 10 && !digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Formatea montos en guaraníes: Gs. 150.000 */
export function formatCurrency(amount: number | null | undefined, currency = "PYG"): string {
  if (amount === null || amount === undefined) return "A consultar";
  if (currency === "PYG") {
    return `Gs. ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  return new Intl.NumberFormat("es-PY", { style: "currency", currency }).format(amount);
}

export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function assertNever(value: never, message = "Valor inesperado"): never {
  throw new Error(`${message}: ${String(value)}`);
}
