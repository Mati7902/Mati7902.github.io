import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { formatCompactDate, formatTime, capitalize } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listPatients } from "@/server/services/admin-patients";
import type { Patient } from "@/types/domain";

export const metadata: Metadata = { title: "Pacientes" };

const STATUS_LABEL: Record<Patient["status"], string> = { active: "Activo", inactive: "Inactivo", waiting: "En espera", discharged: "Alta" };
const STATUS_TONE: Record<Patient["status"], "success" | "muted" | "warning" | "info"> = { active: "success", inactive: "muted", waiting: "warning", discharged: "info" };
const MODALITY: Record<Patient["modality"], string> = { presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  await requireAdmin();
  const { q, estado } = await searchParams;
  const supabase = await createClient();
  const status = (["active", "inactive", "waiting", "discharged"] as const).includes(estado as Patient["status"]) ? (estado as Patient["status"]) : "all";
  const patients = await listPatients(supabase, { query: q, status });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pacientes"
        title="Pacientes"
        description="Ficha administrativa, acceso a la plataforma y asignaciones."
        actions={
          <Button asChild>
            <Link href="/admin/pacientes/nuevo">
              <Plus aria-hidden /> Nuevo paciente
            </Link>
          </Button>
        }
      />
      <form className="flex flex-col gap-3 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar por nombre, email o teléfono" className="pl-11" aria-label="Buscar pacientes" />
        </div>
        <select name="estado" defaultValue={status} className="h-12 rounded-xl border border-input bg-card px-4 text-base" aria-label="Filtrar por estado">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="waiting">En espera</option>
          <option value="inactive">Inactivos</option>
          <option value="discharged">Alta</option>
        </select>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      {patients.length === 0 ? (
        <EmptyState icon={Users} title={q ? "Sin resultados" : "Todavía no hay pacientes"} description={q ? "Probá con otro nombre o teléfono." : "Creá la primera ficha y enviá la invitación de acceso."} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="hidden px-4 py-3 md:table-cell">Contacto</th>
                <th className="hidden px-4 py-3 lg:table-cell">Modalidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="hidden px-4 py-3 md:table-cell">Acceso</th>
                <th className="px-4 py-3">Próximo turno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pacientes/${p.id}`} className="font-medium text-foreground hover:underline">
                      {p.last_name}, {p.first_name}
                    </Link>
                    <p className="text-xs text-muted-foreground md:hidden">{p.phone ?? p.email ?? ""}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {p.phone ? <span className="block">{p.phone}</span> : null}
                    {p.email ? <span className="block text-xs">{p.email}</span> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{MODALITY[p.modality]}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {p.profile_id ? (p.profile_active === false ? "Desactivado" : "Activo") : p.invited_at ? "Invitado" : "Sin invitar"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.next_appointment ? `${capitalize(formatCompactDate(p.next_appointment))} · ${formatTime(p.next_appointment)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
