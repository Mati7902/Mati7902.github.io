import { describe, expect, it } from "vitest";

import { siteDefaults } from "@/lib/config/site";
import { landingSchema, siteIdentitySchema } from "@/server/services/settings";

describe("configuración guardada antes del rediseño", () => {
  it("la identidad sin logo ni bajada usa los valores de la plataforma", () => {
    const identity = siteIdentitySchema.parse({ platform_name: "Consultorio", professional_name: "Lic. Ejemplo" });
    expect(identity.logo_url).toBeNull();
    expect(identity.brand_subtitle).toBe(siteDefaults.brandSubtitle);
    expect(identity.professional_name).toBe("Lic. Ejemplo");
  });

  it("los textos del inicio sin áreas de trabajo reciben las áreas predeterminadas", () => {
    const landing = landingSchema.parse({ hero_title: "Mi título", hero_subtitle: "Mi bajada", how_it_works: [] });
    expect(landing.hero_title).toBe("Mi título");
    expect(landing.specialties).toHaveLength(siteDefaults.specialties.length);
    expect(landing.approach_label).toBe("Enfoque diferencial");
  });

  it("se puede dejar la lista de áreas vacía a propósito", () => {
    expect(landingSchema.parse({ specialties: [] }).specialties).toEqual([]);
  });
});
