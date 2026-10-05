import Link from "next/link";

import { getPublicSettingsSafe } from "@/server/services/public-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { "site.identity": identity } = await getPublicSettingsSafe();
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_var(--color-petrol-100),_transparent_65%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-lg font-medium text-primary">
          {identity.platform_name}
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {identity.professional_title} · {identity.license}
        </span>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12">{children}</main>
      <footer className="relative z-10 flex flex-wrap justify-center gap-x-6 gap-y-2 px-6 pb-6 text-xs text-muted-foreground">
        <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
        <Link href="/terminos" className="hover:text-foreground">Términos de uso</Link>
        <Link href="/" className="hover:text-foreground">Sitio público</Link>
      </footer>
    </div>
  );
}
