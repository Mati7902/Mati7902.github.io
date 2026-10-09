import Link from "next/link";

import { PublicMobileMenu } from "@/components/public/public-mobile-menu";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";

export const publicLinks = [
  { href: "/#sobre-mi", label: "Sobre mí" },
  { href: "/#areas", label: "Áreas" },
  { href: "/#modalidades", label: "Modalidades" },
  { href: "/planes", label: "Planes" },
  { href: "/#preguntas", label: "Preguntas" },
];

export function SiteHeader({
  brandName,
  subtitle,
  logoUrl,
  showAreas = true,
}: {
  brandName: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  /** Sin áreas de trabajo cargadas, la sección no existe y su enlace se oculta. */
  showAreas?: boolean;
}) {
  const links = showAreas ? publicLinks : publicLinks.filter((link) => link.href !== "/#areas");
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 lg:px-8">
        <Link href="/" className="flex min-w-0 shrink text-lg">
          <BrandMark name={brandName} subtitle={subtitle} logoUrl={logoUrl} />
        </Link>
        <nav aria-label="Navegación del sitio" className="hidden items-center gap-6 xl:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Acceso pacientes</Link>
          </Button>
          <Button asChild>
            <Link href="/#solicitar-turno">Solicitar turno</Link>
          </Button>
        </div>
        <PublicMobileMenu links={links} />
      </div>
    </header>
  );
}
