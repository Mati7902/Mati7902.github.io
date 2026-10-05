"use client";

import { Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { invitePatientAction, setPatientAccessAction } from "@/server/actions/admin-patients";
import type { Patient } from "@/types/domain";

export function PatientAccessControls({ patient, profileActive }: { patient: Patient; profileActive: boolean | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const linked = Boolean(patient.profile_id);
  const active = patient.status === "active" && (profileActive ?? true);

  const invite = () =>
    startTransition(async () => {
      const res = await invitePatientAction(patient.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.message);
      router.refresh();
    });

  const toggle = () =>
    startTransition(async () => {
      if (active && !window.confirm("¿Desactivar el acceso de este paciente? Podrás reactivarlo después.")) return;
      const res = await setPatientAccessAction(patient.id, !active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(active ? "Acceso desactivado." : "Acceso reactivado.");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={invite} loading={pending} disabled={!patient.email}>
        <Mail aria-hidden /> {linked ? "Reenviar acceso" : patient.invited_at ? "Reenviar invitación" : "Enviar invitación"}
      </Button>
      <Button variant={active ? "ghost" : "secondary"} onClick={toggle} disabled={pending} className={active ? "text-destructive hover:bg-destructive/10" : ""}>
        {active ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />} {active ? "Desactivar acceso" : "Reactivar acceso"}
      </Button>
    </div>
  );
}
