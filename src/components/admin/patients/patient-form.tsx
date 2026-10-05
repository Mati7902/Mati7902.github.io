"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { savePatientAction } from "@/server/actions/admin-patients";
import type { Patient } from "@/types/domain";

type Result = ActionResult<{ id: string; note?: string }>;

export function PatientForm({ patient, adminNote, defaultAdmissionDate }: { patient?: Patient; adminNote?: string | null; defaultAdmissionDate: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result | null, FormData>(savePatientAction as (prev: Result | null, formData: FormData) => Promise<Result>, null);
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok) {
      toast.success(patient ? "Paciente actualizado." : "Paciente creado.");
      if (state.data.note) toast.info(state.data.note);
      router.push(`/admin/pacientes/${state.data.id}`);
      router.refresh();
    }
  }, [state, patient, router]);

  return (
    <form action={action} className="space-y-8" noValidate>
      {patient ? <input type="hidden" name="id" value={patient.id} /> : null}
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-medium">Datos personales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${id}-fn`} label="Nombre" required error={errors.first_name}>
            <Input id={`${id}-fn`} name="first_name" defaultValue={patient?.first_name ?? ""} required autoComplete="off" />
          </FormField>
          <FormField id={`${id}-ln`} label="Apellido" required error={errors.last_name}>
            <Input id={`${id}-ln`} name="last_name" defaultValue={patient?.last_name ?? ""} required autoComplete="off" />
          </FormField>
          <FormField id={`${id}-email`} label="Email" error={errors.email} hint="Necesario para enviar la invitación de acceso.">
            <Input id={`${id}-email`} name="email" type="email" defaultValue={patient?.email ?? ""} autoComplete="off" />
          </FormField>
          <FormField id={`${id}-phone`} label="Teléfono / WhatsApp" error={errors.phone} hint="Formato local (0981 123 456) o internacional.">
            <Input id={`${id}-phone`} name="phone" type="tel" defaultValue={patient?.phone ?? ""} autoComplete="off" />
          </FormField>
          <FormField id={`${id}-birth`} label="Fecha de nacimiento" optional error={errors.birth_date}>
            <Input id={`${id}-birth`} name="birth_date" type="date" defaultValue={patient?.birth_date ?? ""} />
          </FormField>
          <FormField id={`${id}-guardian`} label="Madre / padre / tutor" optional hint="Para pacientes menores de edad.">
            <Input id={`${id}-guardian`} name="guardian_name" defaultValue={patient?.guardian_name ?? ""} />
          </FormField>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-medium">Contacto de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${id}-ecn`} label="Nombre" optional>
            <Input id={`${id}-ecn`} name="emergency_contact_name" defaultValue={patient?.emergency_contact_name ?? ""} />
          </FormField>
          <FormField id={`${id}-ecp`} label="Teléfono" optional error={errors.emergency_contact_phone}>
            <Input id={`${id}-ecp`} name="emergency_contact_phone" type="tel" defaultValue={patient?.emergency_contact_phone ?? ""} />
          </FormField>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-medium">Atención</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id={`${id}-modality`} label="Modalidad">
            <select id={`${id}-modality`} name="modality" defaultValue={patient?.modality ?? "mixta"} className="flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30">
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta</option>
            </select>
          </FormField>
          <FormField id={`${id}-status`} label="Estado">
            <select id={`${id}-status`} name="status" defaultValue={patient?.status ?? "active"} className="flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30">
              <option value="active">Activo</option>
              <option value="waiting">En espera</option>
              <option value="inactive">Inactivo</option>
              <option value="discharged">Alta</option>
            </select>
          </FormField>
          <FormField id={`${id}-admission`} label="Fecha de ingreso">
            <Input id={`${id}-admission`} name="admission_date" type="date" defaultValue={patient?.admission_date ?? defaultAdmissionDate} />
          </FormField>
        </div>
        <FormField id={`${id}-notes`} label="Notas administrativas" optional hint="Horarios preferidos, forma de pago, derivación. Solo las ves vos: el paciente no tiene acceso. No es historia clínica.">
          <Textarea id={`${id}-notes`} name="admin_notes" defaultValue={adminNote ?? ""} maxLength={2000} />
        </FormField>
      </section>

      {!patient ? (
        <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/60 p-4">
          <Checkbox id={`${id}-invite`} name="send_invite" value="true" defaultChecked className="mt-0.5" />
          <Label htmlFor={`${id}-invite`} className="items-start text-sm font-normal leading-relaxed">
            <span>
              <strong className="font-medium">Enviar invitación de acceso por email.</strong> El paciente recibirá un enlace seguro para crear su contraseña y aceptar el consentimiento de uso de la plataforma.
            </span>
          </Label>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={pending}>
          {patient ? "Guardar cambios" : "Crear paciente"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
