import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientForm } from "@/components/admin/patients/patient-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPatientById } from "@/server/services/patients";

export const metadata: Metadata = { title: "Editar paciente" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const patient = await getPatientById(supabase, id);
  if (!patient) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Pacientes" title={`Editar a ${patient.first_name} ${patient.last_name}`} />
      <PatientForm patient={patient} />
    </div>
  );
}
