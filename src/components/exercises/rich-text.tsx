import { Fragment } from "react";

import { cn } from "@/lib/utils";

/** "Texto con **negrita**" → nodos con <strong>. React escapa el resto. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Texto de los ejercicios: párrafos separados por una línea en blanco, viñetas con "- " y
 * **negrita**. Un salto de línea simple se respeta dentro del párrafo. Con `headingLevel`, un
 * párrafo que está entero en negrita se muestra como encabezado (documentos largos).
 */
export function RichText({ text, className, headingLevel }: { text: string; className?: string; headingLevel?: 2 | 3 | 4 }) {
  const Heading = headingLevel ? (`h${headingLevel}` as const) : null;
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
        if (bullets.length > 0 && bullets.length === lines.length) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-accent">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (Heading && /^\*\*[^*]+\*\*$/.test(block)) {
          return (
            <Heading key={i} className="pt-2 font-semibold text-foreground break-after-avoid">
              {block.slice(2, -2)}
            </Heading>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
