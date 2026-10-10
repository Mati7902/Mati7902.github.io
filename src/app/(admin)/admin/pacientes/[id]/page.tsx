import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil } from "lucide-react";

import { AppointmentListClient } from "@/components/admin/agenda/agenda-client";
import { NewAppointmentDialog } from "@/components/admin/agenda/new-appointment-dialog";
import { AssignExerciseForm, AssignMaterialForm } from "@/components/admin/patients/assign-forms";
import { ExerciseResponseList } from "@/components/exercises/exercise-response-list";
import { PatientAccessControls } from "@/components/admin/patients/patient-access-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/session";
import { formatCompactDate, formatShortDate, formatTime, capitalize, nowMs } from "@/lib/dates";
import { AUDIENCE_LABEL, type Audience, COLLECTIONS } from "@/lib/exercises/collections";
import { answerEntries, parseSteps } from "@/lib/exercises/steps";
import { createClient } from "@/lib/supabase/server";
import { getPatientOverview } from "@/server/services/admin-patients";
import { getIntakeStatus } from "@/server/services/intake";
import { listSharedResponses } from "@/server/services/exercises";
import { getSetting } from "@/server/services/settings";
import { APPOINTMENT_STATUS_LABEL, type AppointmentWithPatient, type Patient } from "@/types/domain";

export const metadata: Metadata = { title: "Ficha del paciente" };

const STATUS_LABEL: Record<Patient["status"], string> = { active: "Activo", inactive: "Inactivo", waiting: "En espera", discharged: "Alta" };
const MODALITY: Record<Patient["modality"], string> = { presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" };

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const [overview, scheduling, { data: materials }, { data: templates }, { data: prepRows }, { count: logCount }, sharedResponses, intake] = await Promise.all([
    getPatientOverview(supabase, id),
    getSetting(supabase, "scheduling"),
    supabase.from("materials").select("id, title, material_categories(name)").eq("is_published", true).order("title"),
    supabase.from("exercise_templates").select("id, title, collection, audience").eq("is_active", true).order("sort_order"),
    supabase.from("session_preparations").select("appointment_id, week_rating, hardest, better, topics, practiced, important, submitted_at").eq("patient_id", id),
    supabase.from("emotional_logs").select("id", { count: "exact", head: true }).eq("patient_id", id),
    listSharedResponses(supabase, id),
    // Solo el estado: el contenido se lee (y se audita) en la página de la ficha de ingreso.
    // Solo llega si el paciente ya la envió (RLS); un error de lectura no rompe la ficha.
    getIntakeStatus(supabase, id).catch(() => null),
  ]);
  const materialOptions = (materials ?? []).map((m) => ({ id: m.id, title: m.title, group: (m.material_categories as { name: string } | null)?.name ?? "Sin categoría" }));
  const templateOptions = (templates ?? []).map((t) => {
    const collection = t.collection ? COLLECTIONS[t.collection] : undefined;
    const audience = t.audience !== "todos" ? ` (${AUDIENCE_LABEL[t.audience as Audience]?.toLowerCase() ?? t.audience})` : "";
    return { id: t.id, title: t.title, group: collection ? `${collection.title}${audience}` : `Ejercicios${audience}` };
  });
  if (!overview) notFound();
  const { patient, appointments, materials: assigned, assignments, profile, adminNote } = overview;
  const now = nowMs();
  const upcoming = appointments
    .filter((a) => new Date(a.end_time).getTime() >= now && !["cancelled", "completed", "no_show"].includes(a.status))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((a) => ({ ...a, patients: { id: patient.id, first_name: patient.first_name, last_name: patient.last_name, phone: patient.phone, whatsapp_phone: patient.whatsapp_phone, email: patient.email, profile_id: patient.profile_id } })) as AppointmentWithPatient[];
  const past = appointments.filter((a) => !upcoming.some((u) => u.id === a.id)).slice(0, 10);
  const sharedLogs = logCount ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ficha administrativa"
        title={`${patient.first_name} ${patient.last_name}`}
        description={`${MODALITY[patient.modality]} · Ingreso ${formatShortDate(patient.admission_date)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/admin/pacientes/${patient.id}/editar`}>
                <Pencil aria-hidden /> Editar
              </Link>
            </Button>
            <NewAppointmentDialog patients={[{ id: patient.id, first_name: patient.first_name, last_name: patient.last_name, phone: patient.phone, modality: patient.modality }]} defaultPatientId={patient.id} timezone={scheduling.timezone} defaultDuration={scheduling.default_duration_minutes} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="surface-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Datos</h2>
            <Badge variant={patient.status === "active" ? "success" : "muted"}>{STATUS_LABEL[patient.status]}</Badge>
          </div>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Teléfono / WhatsApp" value={patient.phone} />
            <Item label="Email" value={patient.email} />
            <Item label="Fecha de nacimiento" value={patient.birth_date ? formatShortDate(patient.birth_date) : null} />
            <Item label="Tutor" value={patient.guardian_name} />
            <Item label="Contacto de emergencia" value={patient.emergency_contact_name ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}` : null} />
            <Item label="Consentimiento" value={patient.consent_accepted_at ? `Aceptado el ${formatShortDate(patient.consent_accepted_at)} (${patient.consent_version ?? "—"})` : "Pendiente"} />
          </dl>
          {adminNote ? (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas administrativas</p>
                <p className="mt-1 text-sm whitespace-pre-line">{adminNote}</p>
              </div>
            </>
          ) : null}
        </section>

        <section className="surface-card space-y-4 p-6">
          <h2 className="font-display text-lg font-medium">Acceso a la plataforma</h2>
          <dl className="space-y-2 text-sm">
            <Item label="Estado" value={patient.profile_id ? (profile?.is_active === false ? "Desactivado" : "Cuenta activa") : patient.invited_at ? `Invitado el ${formatShortDate(patient.invited_at)} (sin ingresar)` : "Sin invitar"} />
            <Item label="Último acceso" value={profile?.last_seen_at ? capitalize(formatCompactDate(profile.last_seen_at)) : null} />
            <Item label="Comparte registros" value={patient.share_records_with_professional ? `Sí${sharedLogs ? ` · ${sharedLogs} registros emocionales` : ""}` : "No (privados)"} />
          </dl>
          <PatientAccessControls patient={patient} profileActive={profile?.is_active ?? null} />
          {!patient.email ? <p className="text-xs text-warning">Cargá un email para poder invitar al paciente.</p> : null}
        </section>
      </div>

      <IntakeSummary patientId={patient.id} intake={intake} hasAccount={Boolean(patient.profile_id)} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Próximos turnos</h2>
        <AppointmentListClient appointments={upcoming} preps={prepRows ?? []} timezone={scheduling.timezone} defaultDuration={scheduling.default_duration_minutes} emptyText="Sin turnos próximos." showDate showPatient={false} />
        {past.length > 0 ? (
          <details className="rounded-2xl border border-border/70 bg-card px-5 py-3 text-sm">
            <summary className="cursor-pointer font-medium">Historial reciente ({past.length})</summary>
            <ul className="mt-3 divide-y divide-divider">
              {past.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>{capitalize(formatCompactDate(a.start_time, scheduling.timezone))} · {formatTime(a.start_time, scheduling.timezone)}</span>
                  <span className="text-muted-foreground">{APPOINTMENT_STATUS_LABEL[a.status]}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card space-y-4 p-6">
          <h2 className="font-display text-lg font-medium">Materiales asignados</h2>
          <AssignMaterialForm patientId={patient.id} materials={materialOptions.filter((m) => !assigned.some((a) => a.material_id === m.id))} />
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no asignaste materiales.</p>
          ) : (
            <ul className="divide-y divide-divider text-sm">
              {assigned.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium">{(a.materials as { title: string } | null)?.title ?? "Material"}</p>
                    {a.note ? <p className="text-xs text-muted-foreground">{a.note}</p> : null}
                  </div>
                  <Badge variant={a.completed_at ? "success" : a.viewed_at ? "info" : "muted"}>{a.completed_at ? "Completado" : a.viewed_at ? "Visto" : "Asignado"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface-card space-y-4 p-6">
          <h2 className="font-display text-lg font-medium">Ejercicios sugeridos</h2>
          <AssignExerciseForm patientId={patient.id} templates={templateOptions} />
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no sugeriste ejercicios.</p>
          ) : (
            <ul className="divide-y divide-divider text-sm">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium">{(a.exercise_templates as { title: string } | null)?.title ?? "Ejercicio"}</p>
                    <p className="text-xs text-muted-foreground">
                      {capitalize(formatCompactDate(a.assigned_at))}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>
                  <Badge variant={a.completed_at ? "success" : "muted"}>{a.completed_at ? "Hecho" : "Pendiente"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="surface-card space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-medium">Respuestas de ejercicios</h2>
          <p className="text-sm text-muted-foreground">
            {patient.share_records_with_professional
              ? "Lo que escribió en los ejercicios (las 20 más recientes). Las ves porque comparte sus registros con vos."
              : "No comparte sus registros: sus respuestas de ejercicios son privadas. Puede activarlo desde su perfil."}
          </p>
        </div>
        {patient.share_records_with_professional ? (
          sharedResponses.length > 0 ? (
            <ExerciseResponseList
              responses={sharedResponses.map((r) => ({
                id: r.id,
                completedAt: r.completed_at,
                title: r.exercise_templates?.title ?? "Ejercicio",
                entries: answerEntries(parseSteps(r.exercise_templates?.steps), (r.answers ?? {}) as Record<string, unknown>),
                emotionBefore: r.emotion_before,
                emotionAfter: r.emotion_after,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no completó ejercicios.</p>
          )
        ) : null}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-subtle-foreground">—</span>}</dd>
    </div>
  );
}

/** Estado de la ficha de ingreso, con enlace a la ficha completa (sin mostrar respuestas acá). */
function IntakeSummary({ patientId, intake, hasAccount }: { patientId: string; intake: Awaited<ReturnType<typeof getIntakeStatus>>; hasAccount: boolean }) {
  const submitted = Boolean(intake?.submitted_at);
  return (
    <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <ClipboardList className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-lg font-medium">Ficha de ingreso</h2>
          {submitted && intake?.submitted_at ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enviada el {formatShortDate(intake.first_submitted_at ?? intake.submitted_at)}
                {intake.first_submitted_at && intake.submitted_at !== intake.first_submitted_at ? ` · actualizada el ${formatShortDate(intake.submitted_at)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {hasAccount ? "Todavía no la envió. La completa desde su cuenta; el borrador es privado hasta que la envíe." : "La completa el paciente cuando crea su cuenta."}
            </p>
          )}
        </div>
      </div>
      {submitted ? (
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/admin/pacientes/${patientId}/ingreso`}>Ver ficha completa</Link>
        </Button>
      ) : (
        <Badge variant="muted" className="shrink-0 self-start">Pendiente</Badge>
      )}
    </section>
  );
}
