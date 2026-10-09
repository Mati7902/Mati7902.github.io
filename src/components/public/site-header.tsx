import Link from "next/link";

import { PublicMobileMenu } from "@/components/public/public-mobile-menu";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";

export const publicLinks = [
  { href: "/#sobre-mi", label: "Sobre mí" },
  { href: "/#modalidades", label: "Modalidades" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/planes", label: "Planes" },
  { href: "/#preguntas", label: "Preguntas" },
];

export function SiteHeader({ platformName, logoUrl }: { platformName: string; logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="min-w-0 text-lg">
          <BrandMark name={platformName} logoUrl={logoUrl} />
        </Link>
        <nav aria-label="Navegación del sitio" className="hidden items-center gap-7 md:flex">
          {publicLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Acceso pacientes</Link>
          </Button>
          <Button asChild>
            <Link href="/#solicitar-turno">Solicitar turno</Link>
          </Button>
        </div>
        <PublicMobileMenu links={publicLinks} />
      </div>
    </header>
  );
}
