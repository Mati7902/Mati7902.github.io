import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Error 404</p>
      <h1 className="font-display text-3xl font-medium">No encontramos esta página</h1>
      <p className="max-w-md text-muted-foreground">Puede que el enlace haya cambiado o que ya no exista. Te llevamos de vuelta a un lugar seguro.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Mi espacio</Link>
        </Button>
      </div>
    </main>
  );
}
