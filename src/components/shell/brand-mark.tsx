import { cn } from "@/lib/utils";

/**
 * Logo (si se cargó en Configuración) junto al nombre de la plataforma.
 * Se usa <img> y no next/image para aceptar también logos SVG.
 */
export function BrandMark({ name, logoUrl, className, logoClassName }: { name: string; logoUrl?: string | null; className?: string; logoClassName?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 font-display font-medium text-primary", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={cn("h-8 w-auto max-w-[9rem] shrink-0 object-contain", logoClassName)} />
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
