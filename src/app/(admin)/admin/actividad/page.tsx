import type { Metadata } from "next";
import { Activity, CalendarCheck, CalendarX, UserX, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { auditActionLabel } from "@/lib/audit-labels";
import { requireAdmin } from "@/lib/auth/session";
import { formatCompactDate, formatTime, capitalize } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { countActivePatients, getMonthlyStats, getPopularHours } from "@/server/services/admin-analytics";
import { listAuditLogs, listWebhookEvents } from "@/server/services/admin-audit";

export const metadata: Metadata = { title: "Actividad" };

export default async function ActivityPage() {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [stats, hours, activePatients, logs, webhooks] = await Promise.all([
    getMonthlyStats(supabase, from, to),
    getPopularHours(supabase, new Date(now.getFullYear(), now.getMonth() - 2, 1), to),
    countActivePatients(supabase),
    listAuditLogs(supabase, 100),
    listWebhookEvents(supabase, 30),
  ]);
  const maxBookings = Math.max(1, ...hours.map((h) => h.bookings));

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Sistema" title="Actividad y estadísticas" description="Métricas administrativas del mes y registro de acciones críticas. Sin contenido clínico." />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">Este mes</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Turnos" value={stats.total} icon={Activity} />
          <StatCard label="Confirmados / completados" value={stats.confirmed + stats.completed} icon={CalendarCheck} tone="success" />
          <StatCard label="Cancelados" value={stats.cancelled} icon={CalendarX} tone="destructive" />
          <StatCard label="Ausencias" value={stats.no_show} icon={UserX} tone="warning" />
          <StatCard label="Pacientes activos" value={activePatients} icon={Users} tone="info" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card p-6">
            <h3 className="font-display text-lg font-medium">Modalidad</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Presencial</dt>
                <dd className="font-display text-2xl">{stats.presencial}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Videoconsulta</dt>
                <dd className="font-display text-2xl">{stats.virtual}</dd>
              </div>
            </dl>
          </div>
          <div className="surface-card p-6">
            <h3 className="font-display text-lg font-medium">Horarios más solicitados</h3>
            <p className="text-xs text-muted-foreground">Últimos 3 meses</p>
            {hours.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Todavía no hay suficientes turnos.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {hours.map((h) => (
                  <li key={h.hour} className="flex items-center gap-3 text-sm">
                    <span className="w-12 font-medium">{h.hour}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand-200">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(h.bookings / maxBookings) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right text-muted-foreground">{h.bookings}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Registro de actividad</h2>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acción</th>
                <th className="hidden px-4 py-3 md:table-cell">Actor</th>
                <th className="hidden px-4 py-3 lg:table-cell">Entidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin actividad registrada.</td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {capitalize(formatCompactDate(l.created_at))} {formatTime(l.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block">{auditActionLabel(l.action)}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{l.action}</span>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">{l.actor_name ?? "—"}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      {l.entity_type ? `${l.entity_type} · ${l.entity_id?.slice(0, 8) ?? ""}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">Webhooks de WhatsApp</h2>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se recibieron eventos.</p>
        ) : (
          <ul className="divide-y divide-divider overflow-hidden rounded-2xl border border-border/70 bg-card text-sm">
            {webhooks.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate font-mono text-xs">{w.event_type} · {w.event_key.slice(0, 32)}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {capitalize(formatCompactDate(w.received_at))} {formatTime(w.received_at)}
                  <Badge variant={w.status === "processed" ? "success" : w.status === "failed" ? "destructive" : "muted"}>{w.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
