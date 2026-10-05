import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { AppointmentCard } from "@/components/appointments/appointment-card";
import { PatientAppointmentActions } from "@/components/appointments/patient-appointment-actions";
import { QuickActions } from "@/components/patient/quick-actions";
import { Button } from "@/components/ui/button";
import { requirePatient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canPatientModify, canPrepareSession, getNextAppointment } from "@/server/services/appointments";
import { weeklyExerciseCount } from "@/server/services/exercises";
import { getSessionPreparation } from "@/server/services/session-prep";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Inicio" };

function greeting(hour: number): string {
  if (hour < 12) return "Buen día";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function PatientHomePage() {
  const { patient } = await requirePatient();
  const supabase = await createClient();
  const [next, settings, weekly] = await Promise.all([
    getNextAppointment(supabase, patient.id),
    getSettings(supabase, ["scheduling", "gamification"] as const),
    weeklyExerciseCount(supabase, patient.id),
  ]);
  const prep = next ? await getSessionPreparation(supabase, next.id) : null;
  const tz = settings.scheduling.timezone;
  const hour = Number(new Intl.DateTimeFormat("es-PY", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  const canPrepare = next ? canPrepareSession(next, settings.scheduling) : false;

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{greeting(hour)}</p>
        <h1 className="font-display text-3xl font-medium sm:text-4xl">Hola, {patient.first_name}.</h1>
        <p className="text-lg text-muted-foreground">¿Cómo estás hoy?</p>
      </header>

      {next ? (
        <AppointmentCard
          appointment={next}
          timezone={tz}
          emphasis
          showAccess
          actions={
            <PatientAppointmentActions
              appointment={next}
              canConfirm={next.status === "pending" || next.status === "rescheduled"}
              canReschedule={canPatientModify(next, settings.scheduling, "reschedule")}
              canCancel={canPatientModify(next, settings.scheduling, "cancel")}
              canPrepare={canPrepare}
              prepared={Boolean(prep?.submitted_at)}
            />
          }
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
          <p className="font-display text-xl font-medium">No tenés ninguna sesión programada.</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando quieras, podés pedir un horario.</p>
          <Button asChild className="mt-4">
            <Link href="/app/agenda/nuevo">
              <CalendarPlus aria-hidden /> Solicitar turno
            </Link>
          </Button>
        </div>
      )}

      <QuickActions prepareHref={canPrepare && next ? `/app/preparar-sesion/${next.id}` : null} />

      {settings.gamification.enabled && settings.gamification.weekly_summary && weekly > 0 ? (
        <p className="rounded-2xl bg-mint-50 px-5 py-4 text-sm text-mint-700">
          Completaste {weekly} {weekly === 1 ? "ejercicio" : "ejercicios"} esta semana.
        </p>
      ) : null}
    </div>
  );
}
