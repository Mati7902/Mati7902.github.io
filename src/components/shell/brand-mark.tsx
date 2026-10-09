import { cn } from "@/lib/utils";

/**
 * Logo de la identidad: emblema + nombre en serif cursiva + bajada en versalitas.
 * Se usa <img> y no next/image para aceptar también logos SVG.
 * En espacios angostos el texto se corta con "…"; con `wrap` (barras laterales) pasa a dos líneas.
 */
export function BrandMark({
  name,
  subtitle,
  logoUrl,
  className,
  logoClassName,
  wrap = false,
}: {
  name: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  className?: string;
  logoClassName?: string;
  wrap?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 max-w-full items-center gap-3 text-primary", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={cn("h-10 w-auto max-w-[9rem] shrink-0 object-contain", logoClassName)} />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-display text-[1.05em] italic leading-tight", wrap ? "text-balance break-words" : "truncate")}>{name}</span>
        {subtitle ? (
          <span className={cn("mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground", wrap ? "break-words leading-snug" : "truncate leading-tight")}>{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
