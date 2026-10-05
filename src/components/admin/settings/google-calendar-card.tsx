"use client";

import { CalendarSync, Link2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, capitalize } from "@/lib/dates";
import { disconnectGoogleAction, syncGoogleNowAction } from "@/server/actions/admin-integrations";

type Integration = { external_account_email: string | null; last_synced_at: string | null; last_error: string | null; is_active: boolean } | null;

export function GoogleCalendarCard({ integration, configured, status }: { integration: Integration; configured: boolean; status?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const connected = Boolean(integration?.is_active);

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium">Google Calendar</h3>
          <p className="text-sm text-muted-foreground">Los turnos se crean, actualizan y cancelan en tu calendario. Los eventos externos bloquean horarios para evitar reservas superpuestas.</p>
        </div>
        <Badge variant={connected ? "success" : "muted"}>{connected ? "Conectado" : "No conectado"}</Badge>
      </div>
      {status === "conectado" ? <p className="text-sm text-mint-700">Cuenta conectada correctamente.</p> : null}
      {status === "error" || status === "estado-invalido" ? <p className="text-sm text-destructive">No pudimos completar la conexión. Intentá de nuevo.</p> : null}
      {status === "no-configurado" ? <p className="text-sm text-warning">Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / APP_ENCRYPTION_KEY en el servidor.</p> : null}
      {connected ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Cuenta</dt><dd>{integration?.external_account_email ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Última sincronización</dt><dd>{integration?.last_synced_at ? capitalize(formatDateTime(integration.last_synced_at)) : "Todavía no"}</dd></div>
          {integration?.last_error ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Último error</dt><dd className="text-destructive">{integration.last_error}</dd></div> : null}
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button asChild disabled={!configured}>
            <a href={configured ? "/api/integrations/google/connect" : "#"} aria-disabled={!configured}>
              <Link2 aria-hidden /> Conectar Google Calendar
            </a>
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await syncGoogleNowAction();
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(`Sincronizado: ${res.data.imported} eventos importados, ${res.data.removed} quitados.`);
                  router.refresh();
                })
              }
            >
              <CalendarSync aria-hidden /> Sincronizar ahora
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Desconectar Google Calendar? Los turnos existentes seguirán en tu calendario.")) return;
                startTransition(async () => {
                  const res = await disconnectGoogleAction();
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Google Calendar desconectado.");
                  router.refresh();
                });
              }}
            >
              <Unlink aria-hidden /> Desconectar
            </Button>
          </>
        )}
      </div>
      {!configured ? <p className="text-xs text-muted-foreground">Configurá las credenciales OAuth en Google Cloud Console y las variables de entorno (ver README › Google Calendar).</p> : null}
    </div>
  );
}
