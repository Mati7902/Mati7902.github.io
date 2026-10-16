import type { Metadata } from "next";

import { PatientForm } from "@/components/admin/patients/patient-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { toDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Nuevo paciente" };

export default async function NewPatientPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Pacientes" title="Nuevo paciente" description="Ficha administrativa mínima. La ficha de ingreso (antecedentes y BASIC I.D.) la completa el paciente al crear su cuenta." />
      <PatientForm defaultAdmissionDate={toDateKey(new Date())} />
    </div>
  );
}
