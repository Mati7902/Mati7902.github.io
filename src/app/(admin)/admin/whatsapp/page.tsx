import type { Metadata } from "next";

import { ConversationList, MessageThread, type ConversationRow } from "@/components/admin/whatsapp/conversation-viewer";
import { TemplateEditor, type TemplateRow } from "@/components/admin/whatsapp/template-editor";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp/whatsapp-settings-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/session";
import { getServerEnv, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/server/services/settings";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppAdminPage({ searchParams }: { searchParams: Promise<{ conv?: string; tab?: string }> }) {
  await requireAdmin();
  const { conv, tab } = await searchParams;
  const supabase = await createClient();
  const env = getServerEnv();
  const configured = Boolean(env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID && env.META_APP_SECRET && env.META_WEBHOOK_VERIFY_TOKEN);

  const [settings, { data: conversations }, { data: templates }] = await Promise.all([
    getSetting(supabase, "whatsapp"),
    supabase.from("whatsapp_conversations").select("*, whatsapp_contacts(phone, display_name, patient_id)").order("last_message_at", { ascending: false, nullsFirst: false }).limit(50),
    supabase.from("notification_templates").select("key, body, variables, wa_template_name, is_active, channel").eq("channel", "whatsapp").order("key"),
  ]);
  const selected = conv ? ((conversations ?? []) as ConversationRow[]).find((c) => c.id === conv) ?? null : null;
  const { data: messages } = selected ? await supabase.from("whatsapp_messages").select("*").eq("conversation_id", selected.id).order("created_at").limit(200) : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria virtual" title="WhatsApp Business" description="Agenda, confirmaciones, recordatorios y consultas administrativas por la API oficial de Meta. Nunca actúa como psicólogo." />

      {!configured ? (
        <Alert variant="warning">
          <AlertTitle>Integración pendiente de configurar</AlertTitle>
          <AlertDescription>
            <p>Cargá las variables META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET y META_WEBHOOK_VERIFY_TOKEN en el servidor (ver README › Meta WhatsApp).</p>
            <p>URL del webhook para Meta: <code className="rounded bg-card px-1.5 py-0.5 text-xs">{publicEnv.appUrl}/api/webhooks/whatsapp</code></p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={tab === "config" || tab === "plantillas" ? tab : "conversaciones"}>
        <TabsList>
          <TabsTrigger value="conversaciones">Conversaciones</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>
        <TabsContent value="conversaciones">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <ConversationList conversations={(conversations ?? []) as ConversationRow[]} selectedId={selected?.id ?? null} />
            <div className="space-y-3">
              {selected ? (
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium">{selected.whatsapp_contacts?.display_name ?? selected.whatsapp_contacts?.phone}</p>
                  {selected.whatsapp_contacts?.patient_id ? (
                    <a href={`/admin/pacientes/${selected.whatsapp_contacts.patient_id}`} className="text-primary hover:underline">Ver ficha</a>
                  ) : (
                    <span className="text-muted-foreground">Contacto no vinculado a un paciente</span>
                  )}
                </div>
              ) : null}
              <MessageThread messages={messages ?? []} contactName={selected?.whatsapp_contacts?.display_name ?? "Contacto"} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="plantillas">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Textos automáticos. Dentro de las 24 h posteriores a un mensaje del paciente se envían tal cual; fuera de esa ventana Meta exige una plantilla aprobada (campo “nombre de plantilla”).
            </p>
            {((templates ?? []) as TemplateRow[]).map((t) => (
              <TemplateEditor key={t.key} template={t} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="config">
          <div className="max-w-2xl">
            <WhatsAppSettingsForm initial={settings} configured={configured} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
