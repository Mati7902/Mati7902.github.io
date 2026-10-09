import { Globe } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Aviso cuando el panel se usa desde un dominio que la configuración todavía no conoce. */
export function DomainNotice({ requestHost, appHost }: { requestHost: string; appHost: string }) {
  return (
    <Alert variant="warning" className="mb-6">
      <Globe aria-hidden />
      <AlertTitle>Falta terminar de conectar {requestHost}</AlertTitle>
      <AlertDescription>
        <p>
          La página está configurada con la dirección <strong>{appHost}</strong>: los emails de invitación y los enlaces del chatbot salen con esa dirección.
          Para usar <strong>{requestHost}</strong>, en Vercel volvé a publicar (Deployments › ⋯ › Redeploy) y en Supabase cambiá la <em>Site URL</em> y las
          <em> Redirect URLs</em>. Si cargaste la variable <code>NEXT_PUBLIC_APP_URL</code>, actualizala o borrala antes de publicar. Ver PUBLICAR.md.
        </p>
      </AlertDescription>
    </Alert>
  );
}
