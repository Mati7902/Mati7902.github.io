"use client";

import { ArrowLeft, ArrowRight, Check, MapPin, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, capitalize } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getAvailabilityAction, requestAppointmentAction, rescheduleAppointmentAction, type SerializedAvailabilityDay } from "@/server/actions/appointments";
import type { AppointmentModality } from "@/types/domain";

type Props = {
  mode: "new" | "reschedule";
  appointmentId?: string;
  fixedModality?: AppointmentModality;
  modalitiesEnabled: AppointmentModality[];
  planSlug?: string | null;
  planName?: string | null;
  timezone: string;
};

export function BookingWizard({ mode, appointmentId, fixedModality, modalitiesEnabled, planSlug, planName, timezone }: Props) {
  const router = useRouter();
  const steps = fixedModality ? ["slot", "confirm"] : ["modality", "slot", "confirm"];
  const [stepIndex, setStepIndex] = useState(0);
  const [modality, setModality] = useState<AppointmentModality | null>(fixedModality ?? (modalitiesEnabled.length === 1 ? modalitiesEnabled[0]! : null));
  const [availability, setAvailability] = useState<{ key: string; days: SerializedAvailabilityDay[] | null; bookingMode: "auto" | "approval"; error: string | null } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: string } | null>(null);

  const step = steps[stepIndex];
  const availabilityKey = `${modality ?? ""}:${appointmentId ?? ""}`;
  const loaded = availability?.key === availabilityKey ? availability : null;
  const days = loaded?.days ?? null;
  const loadError = loaded?.error ?? null;
  const bookingMode = loaded?.bookingMode ?? "approval";

  useEffect(() => {
    if (step !== "slot" || !modality) return;
    let cancelled = false;
    const key = `${modality}:${appointmentId ?? ""}`;
    getAvailabilityAction({ modality, excludeAppointmentId: appointmentId }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setAvailability({ key, days: [], bookingMode: "approval", error: res.error });
        return;
      }
      setAvailability({ key, days: res.data.days, bookingMode: res.data.bookingMode, error: null });
      setSelectedDate((current) => current ?? res.data.days[0]?.dateKey ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [step, modality, appointmentId]);

  const submit = () =>
    startTransition(async () => {
      if (!modality || !slot) return;
      const res =
        mode === "new"
          ? await requestAppointmentAction({ modality, start: slot.start, end: slot.end, note: note || null, planSlug: planSlug ?? null })
          : await rescheduleAppointmentAction({ appointmentId: appointmentId!, start: slot.start, end: slot.end });
      if (!res.ok) {
        toast.error(res.error);
        if (res.code === "CONFLICT") {
          setSlot(null);
          setStepIndex(steps.indexOf("slot"));
          const key = `${modality}:${appointmentId ?? ""}`;
          setAvailability(null);
          getAvailabilityAction({ modality, excludeAppointmentId: appointmentId }).then((r) => {
            if (r.ok) setAvailability({ key, days: r.data.days, bookingMode: r.data.bookingMode, error: null });
          });
        }
        return;
      }
      setResult({ status: res.data.status });
      router.refresh();
    });

  if (result) {
    const confirmed = result.status === "confirmed";
    return (
      <div className="mx-auto max-w-lg space-y-6 animate-fade-up">
        <div className="flex size-16 items-center justify-center rounded-full bg-success-soft text-mint-700">
          <Check className="size-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-medium">{confirmed ? "Tu turno quedó confirmado." : "Tu solicitud fue registrada."}</h2>
          <p className="text-muted-foreground">
            {slot ? capitalize(formatDateTime(slot.start, timezone)) : null}
            {" · "}
            {modality === "virtual" ? "Videoconsulta" : "Presencial"}
          </p>
          <p className="text-muted-foreground">
            {confirmed ? "Te vamos a recordar un día antes." : "El profesional la revisará y te avisaremos en cuanto esté confirmada."}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/app/agenda">Ver mi agenda</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="space-y-2">
        <Progress value={((stepIndex + 1) / steps.length) * 100} aria-label={`Paso ${stepIndex + 1} de ${steps.length}`} />
        <p className="text-xs text-muted-foreground">
          Paso {stepIndex + 1} de {steps.length}
          {planName ? ` · ${planName}` : ""}
        </p>
      </div>

      {step === "modality" ? (
        <div className="space-y-5 animate-fade-up">
          <h2 className="font-display text-2xl font-medium sm:text-3xl">¿Cómo preferís tener la sesión?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {modalitiesEnabled.map((m) => {
              const Icon = m === "virtual" ? Video : MapPin;
              const selected = modality === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModality(m)}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none",
                    selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-surface-muted",
                  )}
                >
                  <span className={cn("flex size-11 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-surface-muted text-primary")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-lg font-medium">{m === "virtual" ? "Videoconsulta" : "Presencial"}</span>
                  <span className="text-sm text-muted-foreground">{m === "virtual" ? "Desde donde estés, por videollamada." : "En el consultorio."}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {step === "slot" ? (
        <div className="space-y-5 animate-fade-up">
          <h2 className="font-display text-2xl font-medium sm:text-3xl">{mode === "new" ? "Elegí día y horario" : "Elegí el nuevo horario"}</h2>
          {loadError ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar la disponibilidad</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : days === null || (loaded === null) ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : days.length === 0 ? (
            <EmptyState title="No hay horarios disponibles en los próximos días" description="Escribinos y buscamos una alternativa juntos." compact />
          ) : (
            <TimeSlotPicker days={days} selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setSlot(null); }} selectedSlot={slot?.start ?? null} onSelectSlot={(start, end) => setSlot({ start, end })} timezone={timezone} />
          )}
        </div>
      ) : null}

      {step === "confirm" && slot && modality ? (
        <div className="space-y-5 animate-fade-up">
          <h2 className="font-display text-2xl font-medium sm:text-3xl">Revisá y confirmá</h2>
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="font-display text-xl font-medium">{capitalize(formatDateTime(slot.start, timezone))}</p>
            <p className="text-muted-foreground">{modality === "virtual" ? "Videoconsulta" : "Presencial"}</p>
            {mode === "new" && bookingMode === "approval" ? <p className="mt-3 text-sm text-muted-foreground">Tu solicitud quedará pendiente hasta que el profesional la confirme.</p> : null}
          </div>
          {mode === "new" ? (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Querés agregar algo? (opcional, no es necesario contar detalles)" maxLength={500} aria-label="Comentario opcional" />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0 || pending}>
          <ArrowLeft aria-hidden /> Atrás
        </Button>
        {step === "confirm" ? (
          <Button type="button" size="lg" onClick={submit} loading={pending}>
            <Check aria-hidden /> {mode === "new" ? (bookingMode === "auto" ? "Confirmar turno" : "Enviar solicitud") : "Confirmar cambio"}
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={() => setStepIndex((i) => i + 1)} disabled={(step === "modality" && !modality) || (step === "slot" && !slot)}>
            Continuar <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
