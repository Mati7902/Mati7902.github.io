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
 * **negrita**. Un salto de línea simple se respeta dentro del párrafo.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
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
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
