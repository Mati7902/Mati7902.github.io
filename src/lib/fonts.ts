import { Fraunces, Inter } from "next/font/google";

/** Tipografía de títulos: elegante, con personalidad y ejes variables (opsz/SOFT). */
export const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

/** Tipografía de contenido, formularios y dashboard: extremadamente legible. */
export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
