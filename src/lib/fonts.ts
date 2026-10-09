import { Inter, Libre_Baskerville } from "next/font/google";

/** Tipografía de títulos: la serif de la identidad del Lic. Matías Sánchez (Libre Baskerville). */
export const fontDisplay = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

/** Tipografía de contenido, formularios y dashboard: extremadamente legible. */
export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
