import { CalendarDays, Clock, MapPin, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatLongDate, formatTime, capitalize, humanDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, MODALITY_LABEL, type Appointment } from "@/types/domain";

type Props = {
  appointment: Appointment;
  timezone?: string;
  /** Mostrar enlace de videollamada solo cuando corresponde (confirmado y próximo). */
  showAccess?: boolean;
  actions?: React.ReactNode;
  className?: string;
  emphasis?: boolean;
};

export function AppointmentCard({ appointment, timezone, showAccess = false, actions, className, emphasis }: Props) {
  const isVirtual = appointment.modality === "virtual";
  const Icon = isVirtual ? Video : MapPin;
  const canShowLink = showAccess && isVirtual && appointment.video_link && ["confirmed", "pending", "rescheduled"].includes(appointment.status);
  return (
    <article className={cn("rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]", emphasis ? "border-primary/30" : "border-border/70", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{emphasis ? "Próxima sesión" : "Sesión"}</p>
        <Badge variant={APPOINTMENT_STATUS_TONE[appointment.status]}>{APPOINTMENT_STATUS_LABEL[appointment.status]}</Badge>
      </div>
      <div className="mt-3 space-y-1">
        <p className="font-display text-2xl font-medium leading-tight sm:text-3xl">{humanDay(appointment.start_time, timezone)}</p>
        {humanDay(appointment.start_time, timezone) !== capitalize(formatLongDate(appointment.start_time, timezone)) ? (
          <p className="text-sm text-muted-foreground">{capitalize(formatLongDate(appointment.start_time, timezone))}</p>
        ) : null}
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Hora</dt>
          <dd className="font-medium">
            {formatTime(appointment.start_time, timezone)} – {formatTime(appointment.end_time, timezone)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Modalidad</dt>
          <dd>{MODALITY_LABEL[appointment.modality]}</dd>
        </div>
        {!isVirtual && appointment.location ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Lugar</dt>
            <dd>{appointment.location}</dd>
          </div>
        ) : null}
      </dl>
      {canShowLink ? (
        <a
          href={appointment.video_link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-medium text-primary hover:bg-petrol-100"
        >
          <Video className="size-4" aria-hidden /> Entrar a la videollamada
        </a>
      ) : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
