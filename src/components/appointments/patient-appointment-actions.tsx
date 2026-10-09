"use client";

import { CalendarClock, Check, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cancelAppointmentAction, confirmAttendanceAction } from "@/server/actions/appointments";
import type { Appointment } from "@/types/domain";

type Props = {
  appointment: Appointment;
  canConfirm: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  canPrepare: boolean;
  prepared?: boolean;
};

export function PatientAppointmentActions({ appointment, canConfirm, canReschedule, canCancel, canPrepare, prepared }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmAttendanceAction(appointment.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Gracias. Tu asistencia quedó confirmada.");
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelAppointmentAction({ appointmentId: appointment.id, reason: reason || null });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Tu turno fue cancelado. Podés pedir otro cuando quieras.");
      setCancelOpen(false);
      router.refresh();
    });

  return (
    <>
      {canConfirm ? (
        <Button onClick={confirm} loading={pending}>
          <Check aria-hidden /> Confirmar asistencia
        </Button>
      ) : null}
      {canPrepare ? (
        <Button asChild variant={canConfirm ? "outline" : "default"}>
          <Link href={`/app/preparar-sesion/${appointment.id}`}>
            <ClipboardList aria-hidden /> {prepared ? "Revisar mi preparación" : "Preparar mi sesión"}
          </Link>
        </Button>
      ) : null}
      {canReschedule ? (
        <Button asChild variant="outline">
          <Link href={`/app/agenda/reprogramar/${appointment.id}`}>
            <CalendarClock aria-hidden /> Reprogramar
          </Link>
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setCancelOpen(true)} disabled={pending}>
          <X aria-hidden /> Cancelar
        </Button>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar este turno?</DialogTitle>
            <DialogDescription>El horario quedará libre para otra persona. Si preferís cambiar de día, usá “Reprogramar”.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" maxLength={300} aria-label="Motivo de la cancelación" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={pending}>
              Volver
            </Button>
            <Button variant="destructive" onClick={cancel} loading={pending}>
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
