import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };

/** Página mostrada por el service worker cuando no hay red. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-medium">Sin conexión</h1>
      <p className="max-w-sm text-muted-foreground">Parece que no hay internet en este momento. Cuando vuelva la conexión, recargá la página y seguimos.</p>
      <p className="max-w-sm text-sm text-muted-foreground">Mientras tanto, podés respirar: inhalá 4 segundos, exhalá 6. Repetilo unas veces.</p>
    </main>
  );
}
