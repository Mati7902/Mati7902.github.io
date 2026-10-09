import type { Metadata } from "next";
import Link from "next/link";
import { Library, Plus } from "lucide-react";

import { MaterialRowActions } from "@/components/admin/materials/material-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listMaterialsAdmin } from "@/server/services/admin-materials";
import { MATERIAL_TYPE_LABEL } from "@/server/services/materials";

export const metadata: Metadata = { title: "Materiales" };

export default async function AdminMaterialsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const materials = await listMaterialsAdmin(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Materiales"
        description="PDF, audios, videos, enlaces y ejercicios internos. Publicados para todos o asignados a pacientes específicos."
        actions={
          <Button asChild>
            <Link href="/admin/materiales/nuevo">
              <Plus aria-hidden /> Nuevo material
            </Link>
          </Button>
        }
      />
      {materials.length === 0 ? (
        <EmptyState icon={Library} title="Todavía no hay materiales" description="Subí tu primer PDF, audio o enlace para compartir con tus pacientes." action={<Button asChild><Link href="/admin/materiales/nuevo">Crear material</Link></Button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="hidden px-4 py-3 md:table-cell">Tipo</th>
                <th className="hidden px-4 py-3 lg:table-cell">Categoría</th>
                <th className="px-4 py-3">Visibilidad</th>
                <th className="hidden px-4 py-3 md:table-cell">Asignado a</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/materiales/${m.id}`} className="font-medium hover:underline">{m.title}</Link>
                    {!m.is_published ? <Badge variant="warning" className="ml-2">Borrador</Badge> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{MATERIAL_TYPE_LABEL[m.type]}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{m.material_categories?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.visibility === "public" ? "success" : "soft"}>{m.visibility === "public" ? "Todos" : "Asignado"}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{m.assigned_count ?? 0} paciente(s)</td>
                  <td className="px-4 py-3">
                    <MaterialRowActions id={m.id} title={m.title} />
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
