import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { AppointmentCard } from "@/components/appointments/appointment-card";
import { PatientAppointmentActions } from "@/components/appointments/patient-appointment-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatCompactDate, formatTime, capitalize } from "@/lib/dates";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canPatientModify, canPrepareSession, listPatientAppointments } from "@/server/services/appointments";
import { getSetting } from "@/server/services/settings";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, MODALITY_LABEL } from "@/types/domain";

export const metadata: Metadata = { title: "Agenda" };

export default async function PatientAgendaPage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [{ upcoming, past }, scheduling] = await Promise.all([listPatientAppointments(supabase, patient.id), getSetting(supabase, "scheduling")]);
  const tz = scheduling.timezone;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Mis sesiones"
        title="Agenda"
        actions={
          <Button asChild>
            <Link href="/app/agenda/nuevo">
              <CalendarPlus aria-hidden /> Solicitar turno
            </Link>
          </Button>
        }
      />

      <section className="space-y-4" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="font-display text-xl font-medium">
          Próximas
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="font-display text-xl font-medium">No tenés ninguna sesión programada.</p>
            <Button asChild className="mt-4">
              <Link href="/app/agenda/nuevo">Solicitar turno</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {upcoming.map((a, i) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                timezone={tz}
                emphasis={i === 0}
                showAccess={i === 0}
                actions={
                  <PatientAppointmentActions
                    appointment={a}
                    canConfirm={a.status === "pending" || a.status === "rescheduled"}
                    canReschedule={canPatientModify(a, scheduling, "reschedule")}
                    canCancel={canPatientModify(a, scheduling, "cancel")}
                    canPrepare={canPrepareSession(a, scheduling)}
                  />
                }
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Podés reprogramar o cancelar desde la app hasta {scheduling.cancel_min_hours} horas antes. Después, escribinos y lo coordinamos.
        </p>
      </section>

      {past.length > 0 ? (
        <section className="space-y-3" aria-labelledby="past-title">
          <h2 id="past-title" className="font-display text-xl font-medium">
            Anteriores
          </h2>
          <ul className="divide-y divide-divider rounded-2xl border border-border/70 bg-card">
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-medium">
                    {capitalize(formatCompactDate(a.start_time, tz))} · {formatTime(a.start_time, tz)}
                  </p>
                  <p className="text-muted-foreground">{MODALITY_LABEL[a.modality]}</p>
                </div>
                <Badge variant={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
