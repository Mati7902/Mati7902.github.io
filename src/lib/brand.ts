import type { SiteIdentity } from "@/server/services/settings";

/** Emblema y foto de la identidad que vienen con la plataforma; se reemplazan desde Configuración › Identidad. */
export const DEFAULT_LOGO = "/marca/emblema.svg";
export const DEFAULT_PHOTO = "/marca/matias-sanchez.webp";

export function brandLogo(identity: Pick<SiteIdentity, "logo_url">): string {
  return identity.logo_url || DEFAULT_LOGO;
}

export function brandPhoto(identity: Pick<SiteIdentity, "photo_url">): string {
  return identity.photo_url || DEFAULT_PHOTO;
}

/** Separa "Terapia desde *donde estés*" en tramos normales y destacados (entre asteriscos). */
export function splitEmphasis(text: string): { text: string; emphasis: boolean }[] {
  const parts: { text: string; emphasis: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), emphasis: false });
    parts.push({ text: m[1]!, emphasis: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), emphasis: false });
  return parts.length ? parts : [{ text, emphasis: false }];
}
