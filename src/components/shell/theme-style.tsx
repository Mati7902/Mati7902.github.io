import { getPublicSettingsSafe } from "@/server/services/public-settings";

/** Inyecta los colores básicos configurados desde Administración como variables CSS. */
export async function ThemeStyle() {
  const { theme } = await getPublicSettingsSafe();
  const css = `:root{--primary:${theme.primary};--accent:${theme.accent};--background:${theme.background};}`;
  return <style id="theme-overrides" dangerouslySetInnerHTML={{ __html: css }} />;
}
