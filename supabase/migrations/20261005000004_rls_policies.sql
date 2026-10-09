-- ============================================================================
-- 0004 · Row Level Security
-- Regla fundamental: un paciente SOLO accede a sus propios datos.
-- Nunca confiar únicamente en la validación del frontend.
-- ============================================================================

alter table public.roles                    enable row level security;
alter table public.profiles                 enable row level security;
alter table public.patients                 enable row level security;
alter table public.patient_admin_notes      enable row level security;
alter table public.appointment_admin_notes  enable row level security;
alter table public.therapy_plans            enable row level security;
alter table public.availability_rules       enable row level security;
alter table public.blocked_slots            enable row level security;
alter table public.appointments             enable row level security;
alter table public.appointment_history      enable row level security;
alter table public.session_preparations     enable row level security;
alter table public.exercise_templates       enable row level security;
alter table public.exercise_assignments     enable row level security;
alter table public.exercise_responses       enable row level security;
alter table public.emotional_logs           enable row level security;
alter table public.material_categories      enable row level security;
alter table public.materials                enable row level security;
alter table public.patient_materials        enable row level security;
alter table public.notification_templates   enable row level security;
alter table public.notifications            enable row level security;
alter table public.whatsapp_contacts        enable row level security;
alter table public.whatsapp_conversations   enable row level security;
alter table public.whatsapp_messages        enable row level security;
alter table public.whatsapp_webhook_events  enable row level security;
alter table public.chatbot_intents          enable row level security;
alter table public.calendar_integrations    enable row level security;
alter table public.calendar_sync_log        enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.settings                 enable row level security;
alter table public.emergency_resources      enable row level security;
alter table public.faqs                     enable row level security;
alter table public.rate_limit_hits          enable row level security;

-- Roles -------------------------------------------------------------------
create policy "roles: lectura autenticada" on public.roles for select to authenticated using (true);
create policy "roles: admin gestiona" on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles ----------------------------------------------------------------
create policy "profiles: ver propio" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: admin ve todos" on public.profiles for select to authenticated using (public.is_admin());
create policy "profiles: actualizar propio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin actualiza" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Inserción solo vía trigger handle_new_user (security definer) o service_role.

-- Patients ----------------------------------------------------------------
create policy "patients: ver propio" on public.patients for select to authenticated using (profile_id = auth.uid());
create policy "patients: actualizar propio" on public.patients for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "patients: admin gestiona" on public.patients for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notas administrativas: exclusivas del profesional (el paciente nunca las ve) -----
create policy "patient_notes: admin gestiona" on public.patient_admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "appointment_notes: admin gestiona" on public.appointment_admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Therapy plans (públicos para la landing) ----------------------------------
create policy "plans: lectura pública de activos" on public.therapy_plans for select to anon, authenticated using (is_active or public.is_admin());
create policy "plans: admin gestiona" on public.therapy_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Availability rules (horarios de atención: información pública) ------------
create policy "availability: lectura pública de activas" on public.availability_rules for select to anon, authenticated using (is_active or public.is_admin());
create policy "availability: admin gestiona" on public.availability_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Blocked slots (solo admin; los motivos pueden ser privados) ---------------
create policy "blocked: admin gestiona" on public.blocked_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Appointments ------------------------------------------------------------
create policy "appointments: paciente ve propios" on public.appointments for select to authenticated using (patient_id = public.current_patient_id());
create policy "appointments: paciente actualiza propios" on public.appointments for update to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
create policy "appointments: admin gestiona" on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Inserción de pacientes: únicamente mediante create_appointment_tx (security definer).

-- Appointment history -------------------------------------------------------
create policy "history: paciente ve propios" on public.appointment_history for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_history.appointment_id and a.patient_id = public.current_patient_id()));
create policy "history: admin ve todo" on public.appointment_history for select to authenticated using (public.is_admin());

-- Session preparations ------------------------------------------------------
create policy "prep: paciente gestiona propias" on public.session_preparations for all to authenticated
  using (patient_id = public.current_patient_id())
  with check (
    patient_id = public.current_patient_id()
    and exists (select 1 from public.appointments a where a.id = session_preparations.appointment_id and a.patient_id = public.current_patient_id())
  );
-- El profesional solo ve la preparación cuando el paciente la envía (los borradores son privados).
create policy "prep: admin lee enviadas" on public.session_preparations for select to authenticated using (public.is_admin() and submitted_at is not null);

-- Exercise templates --------------------------------------------------------
create policy "exercises: lectura de activos" on public.exercise_templates for select to authenticated using (is_active or public.is_admin());
create policy "exercises: admin gestiona" on public.exercise_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Exercise assignments ------------------------------------------------------
create policy "assignments: paciente ve propias" on public.exercise_assignments for select to authenticated using (patient_id = public.current_patient_id());
create policy "assignments: paciente completa propias" on public.exercise_assignments for update to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
create policy "assignments: admin gestiona" on public.exercise_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Exercise responses (registros personales del paciente) --------------------
create policy "responses: paciente gestiona propias" on public.exercise_responses for all to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
create policy "responses: profesional lee si el paciente comparte" on public.exercise_responses for select to authenticated
  using (public.is_admin() and exists (select 1 from public.patients p where p.id = exercise_responses.patient_id and p.share_records_with_professional));

-- Emotional logs ------------------------------------------------------------
create policy "logs: paciente gestiona propios" on public.emotional_logs for all to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
create policy "logs: profesional lee si el paciente comparte" on public.emotional_logs for select to authenticated
  using (public.is_admin() and exists (select 1 from public.patients p where p.id = emotional_logs.patient_id and p.share_records_with_professional));

-- Material categories -------------------------------------------------------
create policy "categories: lectura autenticada" on public.material_categories for select to authenticated using (true);
create policy "categories: admin gestiona" on public.material_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Materials -----------------------------------------------------------------
create policy "materials: paciente ve públicos o asignados" on public.materials for select to authenticated
  using (
    public.is_admin()
    or (is_published and visibility = 'public')
    or exists (select 1 from public.patient_materials pm where pm.material_id = materials.id and pm.patient_id = public.current_patient_id() and pm.assigned_by is not null)
  );
create policy "materials: admin gestiona" on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Patient materials ---------------------------------------------------------
create policy "patient_materials: paciente ve propios" on public.patient_materials for select to authenticated using (patient_id = public.current_patient_id());
create policy "patient_materials: paciente registra vistos de públicos" on public.patient_materials for insert to authenticated
  with check (
    patient_id = public.current_patient_id()
    and assigned_by is null
    and exists (select 1 from public.materials m where m.id = patient_materials.material_id and m.is_published and m.visibility = 'public')
  );
create policy "patient_materials: paciente actualiza propios" on public.patient_materials for update to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
create policy "patient_materials: admin gestiona" on public.patient_materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notification templates ----------------------------------------------------
create policy "templates: admin gestiona" on public.notification_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications -------------------------------------------------------------
create policy "notifications: ver propias" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: marcar leídas" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: borrar propias" on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy "notifications: admin crea" on public.notifications for insert to authenticated with check (public.is_admin());

-- WhatsApp (solo admin; el procesamiento lo hace service_role) --------------
create policy "wa_contacts: admin" on public.whatsapp_contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wa_conversations: admin" on public.whatsapp_conversations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wa_messages: admin" on public.whatsapp_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wa_webhooks: admin lee" on public.whatsapp_webhook_events for select to authenticated using (public.is_admin());
create policy "intents: admin" on public.chatbot_intents for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Calendar integrations -----------------------------------------------------
create policy "calendar: dueño admin gestiona" on public.calendar_integrations for all to authenticated
  using (public.is_admin() and owner_profile_id = auth.uid()) with check (public.is_admin() and owner_profile_id = auth.uid());
create policy "calendar_log: admin lee" on public.calendar_sync_log for select to authenticated using (public.is_admin());

-- Audit logs ----------------------------------------------------------------
create policy "audit: admin lee" on public.audit_logs for select to authenticated using (public.is_admin());
-- Inserción vía public.audit_log() (security definer) o service_role.

-- Settings ------------------------------------------------------------------
create policy "settings: lectura pública" on public.settings for select to anon, authenticated using (is_public or public.is_admin());
create policy "settings: admin gestiona" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Emergency resources & FAQs (públicos) --------------------------------------
create policy "emergency: lectura pública de activos" on public.emergency_resources for select to anon, authenticated using (is_active or public.is_admin());
create policy "emergency: admin gestiona" on public.emergency_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "faqs: lectura pública" on public.faqs for select to anon, authenticated using (is_published or public.is_admin());
create policy "faqs: admin gestiona" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- rate_limit_hits: sin políticas → solo service_role / funciones security definer.
