import { readableOn } from "@/lib/color";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

/**
 * Inyecta la paleta configurada en Administración como variables CSS. Las escalas y los tonos
 * derivados (globals.css) se calculan a partir de estos colores; el texto sobre el color
 * principal y sobre el acento se elige blanco u oscuro según el contraste.
 */
export async function ThemeStyle() {
  const { theme } = await getPublicSettingsSafe();
  const css = `:root{--primary:${theme.primary};--primary-foreground:${readableOn(theme.primary)};--accent:${theme.accent};--accent-foreground:${readableOn(theme.accent)};--background:${theme.background};}`;
  return <style id="theme-overrides" dangerouslySetInnerHTML={{ __html: css }} />;
}
