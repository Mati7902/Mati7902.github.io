import type { Metadata } from "next";

import { AvailabilityEditor, BlockedSlotsList } from "@/components/admin/settings/availability-editor";
import { LandingForm, PreferencesForm, ThemeForm } from "@/components/admin/settings/content-form";
import { EmergencyMessageForm, EmergencyResourcesEditor } from "@/components/admin/settings/emergency-form";
import { FaqsEditor } from "@/components/admin/settings/faqs-form";
import { GoogleCalendarCard } from "@/components/admin/settings/google-calendar-card";
import { IdentityForm } from "@/components/admin/settings/identity-form";
import { RemindersForm } from "@/components/admin/settings/reminders-form";
import { SchedulingForm } from "@/components/admin/settings/scheduling-form";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listAvailabilityRules, listBlockedSlots } from "@/server/services/admin-schedule";
import { isGoogleConfigured } from "@/server/services/google-calendar/client";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Configuración" };

const TABS = ["identidad", "agenda", "recordatorios", "emergencia", "preguntas", "textos", "apariencia", "preferencias"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; google?: string }> }) {
  const session = await requireAdmin();
  const { tab, google } = await searchParams;
  const supabase = await createClient();
  const [settings, rules, blocked, { data: resources }, { data: faqs }, { data: integration }] = await Promise.all([
    getSettings(supabase, ["site.identity", "scheduling", "reminders", "emergency", "gamification", "theme", "legal", "landing"] as const),
    listAvailabilityRules(supabase),
    listBlockedSlots(supabase, new Date()),
    supabase.from("emergency_resources").select("*").order("sort_order"),
    supabase.from("faqs").select("*").order("sort_order"),
    supabase.from("calendar_integrations").select("external_account_email, last_synced_at, last_error, is_active").eq("owner_profile_id", session.userId).eq("provider", "google").maybeSingle(),
  ]);
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "identidad";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administración" title="Configuración" description="Todo lo que ves en la web y en la app se edita desde acá, sin tocar código." />
      <Tabs defaultValue={active}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="identidad">Identidad</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="recordatorios">Recordatorios</TabsTrigger>
          <TabsTrigger value="emergencia">Emergencia</TabsTrigger>
          <TabsTrigger value="preguntas">Preguntas</TabsTrigger>
          <TabsTrigger value="textos">Textos</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="preferencias">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="identidad" className="max-w-3xl">
          <IdentityForm initial={settings["site.identity"]} />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-10">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Reglas de reserva</h2>
            <SchedulingForm initial={settings.scheduling} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Días y horarios de atención</h2>
            <p className="text-sm text-muted-foreground">Cada franja define los horarios que se ofrecen a los pacientes. Los turnos se generan cada “duración + intervalo”.</p>
            <AvailabilityEditor rules={rules} defaultDuration={settings.scheduling.default_duration_minutes} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Bloqueos, vacaciones y feriados</h2>
            <BlockedSlotsList blocked={blocked} timezone={settings.scheduling.timezone} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Integraciones</h2>
            <GoogleCalendarCard integration={integration ?? null} configured={isGoogleConfigured()} status={google} />
          </section>
        </TabsContent>

        <TabsContent value="recordatorios" className="max-w-3xl">
          <RemindersForm initial={settings.reminders} />
        </TabsContent>

        <TabsContent value="emergencia" className="max-w-3xl space-y-10">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Protocolo de emergencia</h2>
            <EmergencyMessageForm initial={settings.emergency} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Recursos y números</h2>
            <EmergencyResourcesEditor resources={resources ?? []} />
          </section>
        </TabsContent>

        <TabsContent value="preguntas" className="max-w-3xl">
          <FaqsEditor faqs={faqs ?? []} />
        </TabsContent>

        <TabsContent value="textos" className="max-w-3xl">
          <LandingForm initial={settings.landing} />
        </TabsContent>

        <TabsContent value="apariencia" className="max-w-3xl">
          <ThemeForm initial={settings.theme} />
        </TabsContent>

        <TabsContent value="preferencias" className="max-w-3xl">
          <PreferencesForm gamification={settings.gamification} legal={settings.legal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
