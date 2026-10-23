import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { inline } from "@/components/exercises/rich-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Block, ListItem, Section } from "@/lib/guia/types";

function Items({ items, ordered }: { items: ListItem[]; ordered: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-1.5 pl-5 marker:text-accent", ordered ? "list-decimal" : "list-disc")}>
      {items.map((it, i) =>
        typeof it === "string" ? (
          <li key={i}>{inline(it)}</li>
        ) : (
          <li key={i}>
            {inline(it.t)}
            <ul className="mt-1.5 list-[circle] space-y-1.5 pl-5 marker:text-accent">
              {it.sub.map((s, j) => (
                <li key={j}>{inline(s)}</li>
              ))}
            </ul>
          </li>
        ),
      )}
    </Tag>
  );
}

/** Contenido de la guía: párrafos, listas, tablas y recuadros. Todo texto, sin HTML crudo. */
export function Blocks({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-foreground/90", className)}>
      {blocks.map((b, i) => {
        switch (b.k) {
          case "h":
            return (
              <h3 key={i} className="pt-3 font-display text-lg font-medium text-foreground break-after-avoid first:pt-0">
                {inline(b.t)}
              </h3>
            );
          case "p":
            return <p key={i}>{inline(b.t)}</p>;
          case "note": {
            const caution = /^\*\*Precauci/i.test(b.t);
            return (
              <p key={i} role="note" className={cn("rounded-xl border px-4 py-3 text-sm", caution ? "border-warning/40 bg-warning-soft" : "border-info/30 bg-info-soft")}>
                {inline(b.t)}
              </p>
            );
          }
          case "ul":
          case "ol":
            return <Items key={i} items={b.i} ordered={b.k === "ol"} />;
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {b.h.map((h, j) => (
                        <th key={j} scope="col" className="px-3 py-2 font-medium">
                          {inline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {b.r.map((row, r) => (
                      <tr key={r} className="align-top">
                        {row.map((c, j) => (
                          <td key={j} className="px-3 py-2">
                            {inline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

/** Secciones con título (guías de referencia, reglas, etc.). */
export function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.title} className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
          <h2 className="font-display text-xl font-medium text-foreground">{s.title}</h2>
          <Blocks blocks={s.blocks} />
        </section>
      ))}
    </div>
  );
}

export function BackToGuide({ href = "/admin/guia", label = "Guía clínica" }: { href?: string; label?: string }) {
  return (
    <Button asChild variant="ghost" className="print:hidden">
      <Link href={href}>
        <ArrowLeft aria-hidden /> {label}
      </Link>
    </Button>
  );
}

export const CLINICAL_NOTICE =
  "Material de apoyo para el profesional. No reemplaza el juicio clínico ni la entrevista. El HIS usa la CIE-10 de la OMS: los códigos de las fichas son de esa clasificación.";
