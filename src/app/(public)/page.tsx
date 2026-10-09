import { ArrowRight, CalendarCheck, Heart, Lock, MapPin, MessageCircle, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FaqList } from "@/components/public/faq-list";
import { NeuralField } from "@/components/public/neural-field";
import { PlanCard } from "@/components/plans/plan-card";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { getActivePlans, getPublicAvailability, getPublishedFaqs } from "@/server/services/public-content";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const revalidate = 300;

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function LandingPage() {
  const [{ "site.identity": identity, landing, scheduling }, plans, faqs, availability] = await Promise.all([
    getPublicSettingsSafe(),
    getActivePlans(),
    getPublishedFaqs(),
    getPublicAvailability(),
  ]);

  const featuredPlans = plans.slice(0, 2);
  const days = Array.from(new Set(availability.map((r) => r.weekday))).sort();
  const scheduleSummary =
    days.length > 0
      ? `${days.map((d) => WEEKDAYS[d]).join(", ")} · ${availability[0]?.start_time.slice(0, 5)} a ${availability[availability.length - 1]?.end_time.slice(0, 5)}`
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Psychologist",
    name: identity.professional_name,
    description: identity.tagline,
    url: publicEnv.appUrl,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.phone ? { telephone: identity.phone } : {}),
    ...(identity.location_address ? { address: { "@type": "PostalAddress", streetAddress: identity.location_address, addressCountry: "PY" } } : {}),
    ...(identity.photo_url ? { image: identity.photo_url } : {}),
    availableService: plans.map((p) => ({ "@type": "MedicalTherapy", name: p.name })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: red neuronal animada detrás, mensaje a la izquierda y la foto a la derecha */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top_left,_var(--color-petrol-50),_transparent_55%),radial-gradient(ellipse_at_85%_60%,_var(--color-mint-50),_transparent_55%)]" />
        <NeuralField className="absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,transparent_40%,black_85%)] lg:opacity-80 lg:[mask-image:linear-gradient(to_right,transparent_28%,black_62%)]" />
        <div className="mx-auto grid max-w-6xl gap-14 px-5 pt-14 pb-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:px-8 lg:pt-24 lg:pb-28">
          <div className="space-y-7 animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider text-accent-strong backdrop-blur">
              <span className="size-1.5 rounded-full bg-accent-strong" aria-hidden />
              Psicología para adolescentes y adultos
            </p>
            <h1 className="font-display text-4xl font-medium leading-[1.08] text-foreground sm:text-5xl lg:text-[3.6rem]">{landing.hero_title}</h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{landing.hero_subtitle || identity.tagline}</p>
            <div className="flex items-center gap-4">
              <span className="h-10 w-px bg-border" aria-hidden />
              <div>
                <p className="font-display text-xl font-medium">{identity.professional_name}</p>
                <p className="text-sm text-muted-foreground">
                  {[identity.professional_title, identity.license].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="#solicitar-turno">
                  Solicitar turno <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-card/70 backdrop-blur">
                <Link href="/planes">Conocer los planes</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Video className="size-4 text-accent-strong" aria-hidden /> Presencial y online</li>
              <li className="flex items-center gap-2"><CalendarCheck className="size-4 text-accent-strong" aria-hidden /> Sesiones de {scheduling.default_duration_minutes} minutos</li>
              <li className="flex items-center gap-2"><Lock className="size-4 text-accent-strong" aria-hidden /> Confidencial</li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.75rem] bg-[conic-gradient(from_200deg,_var(--color-petrol-100),_var(--color-mint-100),_var(--color-petrol-50),_var(--color-petrol-100))] opacity-80 blur-2xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-border/60 bg-card shadow-[var(--shadow-float)]">
              {identity.photo_url ? (
                <Image src={identity.photo_url} alt={identity.professional_name} fill sizes="(max-width: 1024px) 80vw, 448px" className="object-cover" priority />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-[linear-gradient(160deg,_var(--color-petrol-50),_var(--color-mint-100))] p-8 text-center">
                  <span className="flex size-20 items-center justify-center rounded-full bg-card text-primary shadow-[var(--shadow-card)]">
                    <Heart className="size-9" aria-hidden />
                  </span>
                  <p className="font-display text-2xl text-primary">Un espacio seguro</p>
                  <p className="text-sm text-muted-foreground">Confidencial, cercano y a tu ritmo.</p>
                </div>
              )}
            </div>
            {identity.logo_url ? (
              <div className="absolute -top-4 -right-3 flex size-20 items-center justify-center rounded-2xl border border-border/60 bg-card/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur sm:-right-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={identity.logo_url} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
            {scheduleSummary ? (
              <div className="absolute -bottom-5 -left-3 max-w-[16rem] rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur sm:-left-8">
                <p className="text-xs font-medium uppercase tracking-wider text-accent-strong">Horarios de atención</p>
                <p className="mt-1 text-sm text-foreground">{scheduleSummary}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Sobre mí */}
      <section id="sobre-mi" className="scroll-mt-20 border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.4fr] lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Sobre mí</p>
            <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">Acompañar con claridad, respeto y método</h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-muted-foreground">
            {identity.bio.split("\n").filter(Boolean).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <ul className="grid gap-3 pt-2 text-base sm:grid-cols-3">
              {["Terapia cognitivo-conductual", "Aceptación y compromiso", "Habilidades DBT"].map((item) => (
                <li key={item} className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-medium text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Modalidades */}
      <section id="modalidades" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Modalidades de atención</p>
            <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">Presencial o por videollamada</h2>
            <p className="mt-4 text-lg text-muted-foreground">Elegís la modalidad que mejor se adapte a tu momento. Podés alternar entre ambas según disponibilidad.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ModalityCard icon={MapPin} title="Presencial" text={identity.location_address ? `Consultorio en ${identity.location_name ? `${identity.location_name}, ` : ""}${identity.location_address}.` : "Sesiones en consultorio. La dirección se comparte al confirmar el turno."} />
            <ModalityCard icon={Video} title="Videoconsulta" text="Sesiones por videollamada segura. Recibís el enlace antes de cada encuentro, desde la app o por WhatsApp." />
            <ModalityCard icon={CalendarCheck} title="Horarios" text={scheduleSummary ? `${scheduleSummary}. Sesiones de ${scheduling.default_duration_minutes} minutos.` : `Sesiones de ${scheduling.default_duration_minutes} minutos. Consultá la disponibilidad al solicitar turno.`} />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-y border-border/60 bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Cómo funciona</p>
          <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">Empezar es simple</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {landing.how_it_works.map((step, i) => (
              <li key={step.title} className="relative rounded-3xl border border-border/70 bg-background p-7">
                <span className="font-display text-4xl text-petrol-200">0{i + 1}</span>
                <h3 className="mt-3 font-display text-xl font-medium">{step.title}</h3>
                <p className="mt-2 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Planes de atención</p>
              <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">Transparencia desde el inicio</h2>
            </div>
            <Button asChild variant="link" className="px-0">
              <Link href="/planes">
                Ver todos los planes <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          {featuredPlans.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:max-w-4xl">
              {featuredPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} bookHref="/login" consultHref="#solicitar-turno" />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-muted-foreground">Los planes se publican próximamente.</p>
          )}
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="scroll-mt-20 border-t border-border/60 bg-card">
        <div className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-wider text-accent-strong">Preguntas frecuentes</p>
          <h2 className="mt-3 mb-10 font-display text-3xl font-medium sm:text-4xl">Lo que suelen preguntarme</h2>
          <FaqList faqs={faqs} />
        </div>
      </section>

      {/* Solicitar turno / contacto */}
      <section id="solicitar-turno" className="scroll-mt-20">
        <div id="contacto" className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="relative isolate grid gap-8 overflow-hidden rounded-[2rem] bg-primary px-8 py-12 text-primary-foreground md:grid-cols-[1.3fr_1fr] md:items-center md:px-12">
            <NeuralField tone="light" density={1.3} interactive={false} className="absolute inset-0 -z-10 opacity-45 [mask-image:linear-gradient(to_left,black_25%,transparent_80%)]" />
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-medium sm:text-4xl">Solicitar turno</h2>
              <p className="max-w-xl text-petrol-100">
                Si ya sos paciente, ingresá a tu espacio y elegí un horario disponible. Si es tu primera vez, escribime por WhatsApp o email y coordinamos la primera sesión.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" variant="accent">
                  <Link href="/login">
                    <Lock aria-hidden /> Acceso pacientes
                  </Link>
                </Button>
                {identity.whatsapp ? (
                  <Button asChild size="lg" variant="outline" className="border-petrol-300 bg-transparent text-primary-foreground hover:bg-petrol-700">
                    <a href={`https://wa.me/${identity.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, quisiera consultar por un turno.")}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden /> Escribir por WhatsApp
                    </a>
                  </Button>
                ) : identity.email ? (
                  <Button asChild size="lg" variant="outline" className="border-petrol-300 bg-transparent text-primary-foreground hover:bg-petrol-700">
                    <a href={`mailto:${identity.email}?subject=${encodeURIComponent("Consulta por turno")}`}>Escribir por email</a>
                  </Button>
                ) : null}
              </div>
            </div>
            <ul className="space-y-3 text-sm text-petrol-100">
              <li className="flex gap-3"><CalendarCheck className="size-5 shrink-0" aria-hidden /> Confirmación y recordatorio antes de cada sesión.</li>
              <li className="flex gap-3"><Lock className="size-5 shrink-0" aria-hidden /> Tus datos protegidos con acceso individual y cifrado.</li>
              <li className="flex gap-3"><Heart className="size-5 shrink-0" aria-hidden /> Ejercicios y materiales entre sesiones, a tu ritmo.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function ModalityCard({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-[var(--shadow-card)]">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-5 font-display text-xl font-medium">{title}</h3>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </div>
  );
}
