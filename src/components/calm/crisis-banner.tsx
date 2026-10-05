import { LifeBuoy, MessageCircle, Phone } from "lucide-react";

import type { EmergencySettings } from "@/server/services/settings";
import type { EmergencyResource } from "@/types/domain";

type Props = {
  settings: EmergencySettings;
  resources: EmergencyResource[];
  professionalWhatsApp?: string | null;
  compact?: boolean;
};

/** Protocolo de emergencia configurable desde Administración. Nunca hardcodea números. */
export function CrisisBanner({ settings, resources, professionalWhatsApp, compact }: Props) {
  return (
    <aside aria-label="Si necesitás ayuda urgente" className="rounded-2xl border border-warning/40 bg-warning-soft/60 p-5">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-[#8a6418]">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Si necesitás ayuda urgente</p>
          <p className="text-sm text-muted-foreground">{settings.message}</p>
          {!compact && resources.length > 0 ? (
            <ul className="space-y-1.5">
              {resources.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {r.phone ? (
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                      <Phone className="size-3.5" aria-hidden /> {r.phone}
                    </a>
                  ) : null}
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                      Sitio
                    </a>
                  ) : null}
                  {r.description ? <span className="basis-full text-xs text-muted-foreground">{r.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {settings.show_contact_professional && professionalWhatsApp ? (
            <div className="space-y-1">
              <a
                href={`https://wa.me/${professionalWhatsApp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-card px-4 text-sm font-medium text-primary shadow-[var(--shadow-card)] hover:bg-primary-soft"
              >
                <MessageCircle className="size-4" aria-hidden /> Contactar al profesional
              </a>
              <p className="text-xs text-muted-foreground">{settings.contact_note}</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
