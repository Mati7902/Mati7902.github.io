import { describe, expect, it } from "vitest";

import { brandLogo, brandPhoto, DEFAULT_LOGO, DEFAULT_PHOTO, splitEmphasis } from "@/lib/brand";

describe("identidad", () => {
  it("usa el emblema y la foto de la plataforma hasta que se suban otros", () => {
    expect(brandLogo({ logo_url: null })).toBe(DEFAULT_LOGO);
    expect(brandPhoto({ photo_url: null })).toBe(DEFAULT_PHOTO);
    expect(brandLogo({ logo_url: "https://x.supabase.co/logo.svg" })).toBe("https://x.supabase.co/logo.svg");
  });

  it("separa las palabras destacadas entre asteriscos", () => {
    expect(splitEmphasis("Terapia desde *donde estés*, con rigor.")).toEqual([
      { text: "Terapia desde ", emphasis: false },
      { text: "donde estés", emphasis: true },
      { text: ", con rigor.", emphasis: false },
    ]);
    expect(splitEmphasis("Sin destacados")).toEqual([{ text: "Sin destacados", emphasis: false }]);
    expect(splitEmphasis("*Todo*")).toEqual([{ text: "Todo", emphasis: true }]);
    expect(splitEmphasis("Un * suelto")).toEqual([{ text: "Un * suelto", emphasis: false }]);
    expect(splitEmphasis("Terapia **online**")).toEqual([
      { text: "Terapia ", emphasis: false },
      { text: "online", emphasis: true },
    ]);
  });
});
