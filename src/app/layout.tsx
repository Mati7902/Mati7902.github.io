import type { Metadata, Viewport } from "next";

import "./globals.css";

import { ServiceWorkerRegistration } from "@/components/shell/sw-registration";
import { ThemeStyle } from "@/components/shell/theme-style";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import { fontDisplay, fontSans } from "@/lib/fonts";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { "site.identity": identity } = await getPublicSettingsSafe();
  const title = identity.platform_name;
  const description = `${identity.professional_name}, ${identity.professional_title.toLowerCase()} (${identity.license}). ${identity.tagline}`;
  return {
    metadataBase: new URL(publicEnv.appUrl),
    title: { default: title, template: `%s · ${title}` },
    description,
    applicationName: title,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "es_PY",
      siteName: title,
      title,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#2f6468",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`} suppressHydrationWarning>
      <head>
        <ThemeStyle />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        {children}
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
