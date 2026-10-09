import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { DeletePlanButton, PlanFormDialog } from "@/components/admin/plans/plan-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { listPlansAdmin } from "@/server/services/admin-plans";

export const metadata: Metadata = { title: "Planes" };

export default async function AdminPlansPage() {
  await requireAdmin();
  const supabase = await createClient();
  const plans = await listPlansAdmin(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planes de atención"
        title="Planes y servicios"
        description="Todo lo que ves acá se publica en la web sin tocar código. Sin urgencias artificiales ni promesas: es un servicio de salud."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/planes" target="_blank">
                Ver página pública <ExternalLink aria-hidden />
              </Link>
            </Button>
            <PlanFormDialog />
          </>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Precio</th>
              <th className="hidden px-4 py-3 md:table-cell">Incluye</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {p.name} {p.is_featured ? <Badge variant="soft" className="ml-1">Destacado</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    /{p.slug}
                    {p.duration_minutes ? ` · ${p.duration_minutes} min` : ""}
                    {p.sessions_included ? ` · ${p.sessions_included} sesión(es)` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 font-medium">{formatCurrency(p.price_amount, p.currency)}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.features.join(" · ") || "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? "Visible" : "Oculto"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <PlanFormDialog plan={p} />
                    <DeletePlanButton plan={p} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
