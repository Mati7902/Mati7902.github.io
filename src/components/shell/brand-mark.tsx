import { cn } from "@/lib/utils";

/**
 * Logo de la identidad: emblema + nombre en serif cursiva + bajada en versalitas.
 * Se usa <img> y no next/image para aceptar también logos SVG.
 */
export function BrandMark({
  name,
  subtitle,
  logoUrl,
  className,
  logoClassName,
}: {
  name: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3 text-primary", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={cn("h-10 w-auto max-w-[9rem] shrink-0 object-contain", logoClassName)} />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[1.05em] italic leading-tight">{name}</span>
        {subtitle ? <span className="truncate text-[0.62rem] font-semibold uppercase leading-tight tracking-[0.18em] text-muted-foreground">{subtitle}</span> : null}
      </span>
    </span>
  );
}
