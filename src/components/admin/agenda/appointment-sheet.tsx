"use client";

import { Check, ExternalLink, UserX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatTime, capitalize } from "@/lib/dates";
import {
  adminCancelAppointmentAction,
  adminRescheduleAppointmentAction,
  adminSetAppointmentStatusAction,
  adminUpdateAppointmentDetailsAction,
  getAdminAvailabilityAction,
} from "@/server/actions/admin-appointments";
import type { SerializedAvailabilityDay } from "@/server/actions/appointments";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, MODALITY_LABEL, type AppointmentWithPatient } from "@/types/domain";

type Props = {
  appointment: AppointmentWithPatient | null;
  onClose: () => void;
  timezone: string;
  defaultDuration: number;
  prep?: { week_rating: number | null; hardest: string | null; better: string | null; topics: string | null; practiced: string | null; important: string | null; submitted_at: string | null } | null;
};

type Mode = "view" | "reschedule" | "edit" | "cancel";

export function AppointmentSheet({ appointment, onClose, timezone, defaultDuration, prep }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<SerializedAvailabilityDay[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [manualStart, setManualStart] = useState("");
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");
  const [modality, setModality] = useState<"presencial" | "virtual">("presencial");
  const [videoLink, setVideoLink] = useState("");
  const [location, setLocation] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const a = appointment;
  const open = Boolean(a);

  useEffect(() => {
    if (!a) return;
    const t = window.setTimeout(() => {
      setMode("view");
      setDays(null);
      setSlot(null);
      setSelectedDate(null);
      setManualStart("");
      setReason("");
      setModality(a.modality);
      setVideoLink(a.video_link ?? "");
      setLocation(a.location ?? "");
      setAdminNotes(a.admin_notes ?? "");
    }, 0);
    return () => window.clearTimeout(t);
  }, [a]);

  useEffect(() => {
    if (mode !== "reschedule" || !a) return;
    let cancelled = false;
    getAdminAvailabilityAction({ modality: a.modality, excludeAppointmentId: a.id }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDays(res.data.days);
        setSelectedDate((current) => current ?? res.data.days[0]?.dateKey ?? null);
      } else toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, a]);

  if (!a) return <Sheet open={false} onOpenChange={() => onClose()} />;

  const name = a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Paciente";
  const duration = Math.round((new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000) || defaultDuration;
  const isFinal = ["cancelled", "completed", "no_show"].includes(a.status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "No se pudo completar la acción.");
      toast.success(success);
      router.refresh();
      onClose();
    });

  const setStatus = (status: "confirmed" | "completed" | "no_show" | "pending", success: string) =>
    run(() => adminSetAppointmentStatusAction({ appointmentId: a.id, status }), success);

  const submitReschedule = () => {
    const start = slot?.start ?? (manualStart ? new Date(manualStart).toISOString() : null);
    if (!start) return void toast.error("Elegí un horario.");
    run(() => adminRescheduleAppointmentAction({ appointmentId: a.id, start, durationMinutes: duration, reason: reason || null, notify }), "Turno reprogramado.");
  };

  const submitEdit = () =>
    run(() => adminUpdateAppointmentDetailsAction({ appointmentId: a.id, modality, videoLink: videoLink || null, location: location || null, adminNotes: adminNotes || null }), "Detalles guardados.");

  const submitCancel = () => run(() => adminCancelAppointmentAction({ appointmentId: a.id, reason: reason || null, notify }), "Turno cancelado.");

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
            <Badge variant="muted">{MODALITY_LABEL[a.modality]}</Badge>
          </div>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            {capitalize(formatDateTime(a.start_time, timezone))} – {formatTime(a.end_time, timezone)} · {duration} min
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-6">
          {mode === "view" ? (
            <>
              <dl className="space-y-2 text-sm">
                {a.patients?.phone ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Teléfono</dt>
                    <dd>{a.patients.phone}</dd>
                  </div>
                ) : null}
                {a.modality === "virtual" ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Videollamada</dt>
                    <dd>
                      {a.video_link ? (
                        <a href={a.video_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                          Abrir <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-warning">Sin enlace</span>
                      )}
                    </dd>
                  </div>
                ) : a.location ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Lugar</dt>
                    <dd>{a.location}</dd>
                  </div>
                ) : null}
                {a.patient_note ? (
                  <div>
                    <dt className="text-muted-foreground">Comentario del paciente</dt>
                    <dd className="rounded-xl bg-surface-muted px-3 py-2">{a.patient_note}</dd>
                  </div>
                ) : null}
                {a.admin_notes ? (
                  <div>
                    <dt className="text-muted-foreground">Notas administrativas</dt>
                    <dd className="rounded-xl bg-surface-muted px-3 py-2">{a.admin_notes}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Recordatorio 24 h</dt>
                  <dd>{a.reminder_24h_sent_at ? "Enviado" : "Pendiente"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Google Calendar</dt>
                  <dd className="capitalize">{a.google_sync_status === "synced" ? "Sincronizado" : a.google_sync_status === "failed" ? "Error" : "Pendiente"}</dd>
                </div>
              </dl>

              {prep?.submitted_at ? (
                <div className="rounded-2xl border border-mint-200 bg-mint-50 p-4 text-sm">
                  <p className="mb-2 font-medium text-mint-700">Preparación de sesión del paciente</p>
                  <ul className="space-y-1.5 text-foreground">
                    {prep.week_rating !== null ? <li><span className="text-muted-foreground">Semana:</span> {prep.week_rating}/10</li> : null}
                    {prep.hardest ? <li><span className="text-muted-foreground">Más difícil:</span> {prep.hardest}</li> : null}
                    {prep.better ? <li><span className="text-muted-foreground">Mejor:</span> {prep.better}</li> : null}
                    {prep.topics ? <li><span className="text-muted-foreground">Temas:</span> {prep.topics}</li> : null}
                    {prep.practiced ? <li><span className="text-muted-foreground">Practicó:</span> {prep.practiced}</li> : null}
                    {prep.important ? <li><span className="text-muted-foreground">Importante:</span> {prep.important}</li> : null}
                  </ul>
                </div>
              ) : null}

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                {a.status === "requested" ? (
                  <Button onClick={() => setStatus("confirmed", "Solicitud aprobada y confirmada.")} loading={pending} className="col-span-2">
                    <Check aria-hidden /> Aprobar solicitud
                  </Button>
                ) : null}
                {["pending", "rescheduled"].includes(a.status) ? (
                  <Button onClick={() => setStatus("confirmed", "Turno confirmado.")} loading={pending}>
                    <Check aria-hidden /> Confirmar
                  </Button>
                ) : null}
                {!isFinal ? (
                  <>
                    <Button variant="outline" onClick={() => setMode("reschedule")} disabled={pending}>
                      Reprogramar
                    </Button>
                    <Button variant="outline" onClick={() => setMode("edit")} disabled={pending}>
                      Editar detalles
                    </Button>
                    <Button variant="outline" onClick={() => setStatus("completed", "Marcado como completado.")} disabled={pending}>
                      Completado
                    </Button>
                    <Button variant="outline" onClick={() => setStatus("no_show", "Marcado como ausente.")} disabled={pending}>
                      <UserX aria-hidden /> Ausente
                    </Button>
                    <Button variant="ghost" className="col-span-2 text-destructive hover:bg-destructive/10" onClick={() => setMode("cancel")} disabled={pending}>
                      <X aria-hidden /> Cancelar turno
                    </Button>
                  </>
                ) : a.status !== "cancelled" ? (
                  <Button variant="outline" className="col-span-2" onClick={() => setStatus("pending", "Turno reabierto.")} disabled={pending}>
                    Reabrir
                  </Button>
                ) : null}
              </div>
              {a.patients ? (
                <Button asChild variant="link" className="px-0">
                  <Link href={`/admin/pacientes/${a.patients.id}`}>Ver ficha del paciente</Link>
                </Button>
              ) : null}
            </>
          ) : null}

          {mode === "reschedule" ? (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Nuevo horario</h3>
              {days === null ? (
                <Skeleton className="h-40 w-full" />
              ) : days.length > 0 ? (
                <TimeSlotPicker days={days} selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setSlot(null); }} selectedSlot={slot?.start ?? null} onSelectSlot={(s, e) => { setSlot({ start: s, end: e }); setManualStart(""); }} timezone={timezone} />
              ) : (
                <p className="text-sm text-muted-foreground">No hay horarios libres dentro de la disponibilidad. Podés indicar uno manualmente.</p>
              )}
              <FormField id="manual-start" label="O indicá fecha y hora manualmente" hint="Fuera de la disponibilidad habitual. Se valida que no se solape con otro turno.">
                <Input id="manual-start" type="datetime-local" value={manualStart} onChange={(e) => { setManualStart(e.target.value); setSlot(null); }} />
              </FormField>
              <FormField id="reschedule-reason" label="Motivo" optional>
                <Input id="reschedule-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
              </FormField>
              <div className="flex items-center gap-2">
                <Checkbox id="notify-reschedule" checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} />
                <Label htmlFor="notify-reschedule" className="font-normal">Avisar al paciente por WhatsApp</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={pending}>Volver</Button>
                <Button onClick={submitReschedule} loading={pending} className="flex-1">Guardar nuevo horario</Button>
              </div>
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Detalles</h3>
              <FormField id="edit-modality" label="Modalidad">
                <Select value={modality} onValueChange={(v) => setModality(v as "presencial" | "virtual")}>
                  <SelectTrigger id="edit-modality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="virtual">Videoconsulta</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {modality === "virtual" ? (
                <FormField id="edit-video" label="Enlace de videollamada" hint="Google Meet, Zoom u otro.">
                  <Input id="edit-video" type="url" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://meet.google.com/…" />
                </FormField>
              ) : (
                <FormField id="edit-location" label="Lugar" optional>
                  <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
                </FormField>
              )}
              <FormField id="edit-notes" label="Notas administrativas" optional hint="No incluir contenido clínico.">
                <Textarea id="edit-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} maxLength={1000} />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={pending}>Volver</Button>
                <Button onClick={submitEdit} loading={pending} className="flex-1">Guardar</Button>
              </div>
            </div>
          ) : null}

          {mode === "cancel" ? (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-medium">Cancelar turno</h3>
              <p className="text-sm text-muted-foreground">El horario quedará libre. El paciente recibirá una notificación en la app.</p>
              <FormField id="cancel-reason" label="Motivo" optional>
                <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
              </FormField>
              <div className="flex items-center gap-2">
                <Checkbox id="notify-cancel" checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} />
                <Label htmlFor="notify-cancel" className="font-normal">Avisar al paciente por WhatsApp</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={pending}>Volver</Button>
                <Button variant="destructive" onClick={submitCancel} loading={pending} className="flex-1">Confirmar cancelación</Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
