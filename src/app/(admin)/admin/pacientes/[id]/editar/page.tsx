import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientForm } from "@/components/admin/patients/patient-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPatientAdminNote } from "@/server/services/admin-notes";
import { getPatientById } from "@/server/services/patients";
import { toDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Editar paciente" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const [patient, adminNote] = await Promise.all([getPatientById(supabase, id), getPatientAdminNote(supabase, id)]);
  if (!patient) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Pacientes" title={`Editar a ${patient.first_name} ${patient.last_name}`} />
      <PatientForm patient={patient} adminNote={adminNote} defaultAdmissionDate={toDateKey(new Date())} />
    </div>
  );
}
