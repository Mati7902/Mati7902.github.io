import { ShieldCheck } from "lucide-react";

import { isTestimonialGender, TESTIMONIAL_EMOJI, TESTIMONIAL_LABEL } from "@/lib/testimonials";
import type { PublicTestimonial } from "@/types/domain";

/** Testimonios anónimos: solo 👩 o 👨, el texto que la persona aprobó y un contexto breve. */
export function TestimonialsSection({ testimonials }: { testimonials: PublicTestimonial[] }) {
  if (testimonials.length === 0) return null;
  const columns = testimonials.length === 1 ? "max-w-2xl" : testimonials.length % 2 === 0 && testimonials.length < 6 ? "md:columns-2 lg:max-w-4xl" : "md:columns-2 lg:columns-3";

  return (
    <section id="testimonios" aria-labelledby="testimonios-titulo" className="scroll-mt-20 border-b border-border/60 bg-surface-muted">
      <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Testimonios</p>
          <h2 id="testimonios-titulo" className="mt-3 font-display text-3xl font-medium text-balance sm:text-4xl">
            Lo que cuentan quienes hicieron el proceso
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Con sus palabras, qué cambió a partir de la terapia.</p>
        </div>

        <ul className={`mt-10 gap-6 ${columns}`}>
          {testimonials.map((t) => {
            const gender = isTestimonialGender(t.gender) ? t.gender : null;
            return (
              <li key={t.id} className="mb-6 break-inside-avoid">
                <figure className="relative rounded-3xl border border-border/70 bg-card p-7 pt-9">
                  <span aria-hidden className="absolute top-3 left-6 font-display text-6xl leading-none text-accent/40">
                    “
                  </span>
                  <blockquote className="relative space-y-3 text-lg leading-relaxed text-foreground">
                    {t.quote.split(/\n+/).filter((p) => p.trim()).map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-divider pt-4 text-sm text-muted-foreground">
                    {gender ? (
                      <span role="img" aria-label={TESTIMONIAL_LABEL[gender]} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl">
                        {TESTIMONIAL_EMOJI[gender]}
                      </span>
                    ) : null}
                    <span>{t.context ?? "Testimonio anónimo"}</span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 flex max-w-3xl gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
          Testimonios reales, compartidos con autorización escrita y sin datos que permitan reconocer a nadie. Cada proceso es distinto: no son una promesa de resultados.
        </p>
      </div>
    </section>
  );
}
