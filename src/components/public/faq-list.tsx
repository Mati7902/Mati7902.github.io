import type { Faq } from "@/types/domain";

export function FaqList({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return null;
  return (
    <dl className="divide-y divide-divider rounded-3xl border border-border/70 bg-card">
      {faqs.map((faq) => (
        <details key={faq.id} className="group px-6 py-5 open:bg-surface-muted/50 first:rounded-t-3xl last:rounded-b-3xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <dt>{faq.question}</dt>
            <span aria-hidden className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
        </details>
      ))}
    </dl>
  );
}
