import Link from "next/link";

import { BrandMark } from "@/components/shell/brand-mark";
import { brandLogo } from "@/lib/brand";
import type { SiteIdentity } from "@/server/services/settings";

export function SiteFooter({ identity }: { identity: SiteIdentity }) {
  return (
    <footer className="border-t border-border/60 bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3 lg:px-8">
        <div className="space-y-2">
          <p className="text-lg">
            <BrandMark name={identity.professional_name} subtitle={identity.brand_subtitle} logoUrl={brandLogo(identity)} />
          </p>
          <p className="text-sm text-muted-foreground">
            {identity.professional_name} · {identity.professional_title}
            <br />
            {identity.license} · {identity.country}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Contacto</p>
          <ul className="space-y-1 text-muted-foreground">
            {identity.email ? (
              <li>
                <a href={`mailto:${identity.email}`} className="hover:text-foreground">
                  {identity.email}
                </a>
              </li>
            ) : null}
            {identity.whatsapp ? (
              <li>
                <a href={`https://wa.me/${identity.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  WhatsApp
                </a>
              </li>
            ) : null}
            {identity.location_address ? <li>{identity.location_address}</li> : null}
            {!identity.email && !identity.whatsapp && !identity.location_address ? <li>Datos de contacto disponibles al solicitar turno.</li> : null}
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Legal</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <Link href="/privacidad" className="hover:text-foreground">Política de privacidad</Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-foreground">Términos de uso</Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">Acceso pacientes</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 px-5 py-4 text-center text-xs text-subtle-foreground">
        Esta plataforma es un apoyo administrativo y entre sesiones. No reemplaza la atención profesional ni los servicios de emergencia.
      </div>
    </footer>
  );
}
