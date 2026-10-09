import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/planes", "/privacidad", "/terminos"], disallow: ["/app", "/admin", "/api", "/login", "/recuperar", "/restablecer", "/bienvenida"] },
    ],
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
  };
}
