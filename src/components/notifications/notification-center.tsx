"use client";

import { Bell, CalendarCheck, CalendarClock, CalendarX, FileText, Sparkles, Info } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import type { Notification } from "@/types/domain";

const ICONS = {
  appointment_requested: CalendarClock,
  appointment_confirmed: CalendarCheck,
  appointment_updated: CalendarClock,
  appointment_cancelled: CalendarX,
  appointment_reminder: Bell,
  new_material: FileText,
  exercise_assigned: Sparkles,
  system: Info,
} as const;

function hrefFor(n: Notification, basePath: string): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  if (typeof data.appointment_id === "string") return `${basePath}/agenda`;
  if (typeof data.material_id === "string") return `${basePath}/materiales`;
  if (typeof data.template_id === "string") return `${basePath}/ejercicios`;
  return null;
}

export function NotificationCenter({ notifications, basePath }: { notifications: Notification[]; basePath: "/app" | "/admin" }) {
  const [items, setItems] = useOptimistic(notifications);
  const [pending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.read_at).length;

  const markAll = () =>
    startTransition(async () => {
      setItems(items.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      await markAllNotificationsReadAction();
    });

  const markOne = (id: string) =>
    startTransition(async () => {
      setItems(items.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
      await markNotificationReadAction(id);
    });

  if (items.length === 0) {
    return <EmptyState icon={Bell} title="Sin novedades por ahora" description="Acá vas a ver confirmaciones de turnos, materiales nuevos y recordatorios." />;
  }

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={markAll} disabled={pending}>
            Marcar todo como leído
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? Info;
          const href = hrefFor(n, basePath);
          const content = (
            <div className={cn("flex gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors", !n.read_at && "border-primary/30 bg-primary-soft/40")}>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", n.read_at ? "bg-surface-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-subtle-foreground">{formatRelative(n.created_at)}</p>
              </div>
              {!n.read_at ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" /> : null}
            </div>
          );
          return (
            <li key={n.id}>
              {href ? (
                <Link href={href} onClick={() => !n.read_at && markOne(n.id)} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-ring">
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => !n.read_at && markOne(n.id)} className="block w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-ring">
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
