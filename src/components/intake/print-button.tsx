"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Imprimir o guardar como PDF desde el navegador (la barra lateral no sale en la hoja). */
export function PrintButton({ label = "Imprimir o guardar PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> {label}
    </Button>
  );
}
