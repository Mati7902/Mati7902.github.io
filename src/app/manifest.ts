import type { MetadataRoute } from "next";

import { siteDefaults } from "@/lib/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteDefaults.platformName,
    short_name: "Psicología MS",
    description: siteDefaults.tagline,
    lang: "es",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#1f4e5f",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calmarme", url: "/app/calmarme", description: "Ejercicios de respiración y regulación" },
      { name: "Registrar cómo me siento", url: "/app/registro/nuevo" },
      { name: "Mi agenda", url: "/app/agenda" },
    ],
  };
}
