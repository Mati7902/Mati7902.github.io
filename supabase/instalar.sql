-- ============================================================================
-- Instalación completa de la base de datos (Supabase)
--
-- Cómo usarlo: en Supabase abrí SQL Editor › New query, pegá TODO este archivo y
-- tocá Run. Se ejecuta una sola vez, en un proyecto nuevo. Si algo falla no queda
-- nada a medias (todo va en una transacción): corregí el problema y volvé a correrlo.
--
-- Archivo generado con `pnpm db:instalar` a partir de supabase/migrations.
-- No lo edites a mano: cambiá las migraciones y volvé a generarlo.
-- No incluye supabase/seed.sql (datos ficticios de demostración).
-- ============================================================================

begin;

-- >>> supabase/migrations/20261005000001_extensions_and_types.sql

-- ============================================================================
-- 0001 · Extensiones y tipos enumerados
-- ============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- Roles de usuario (RBAC). Se dejan preparados receptionist / guardian / professional.
create type public.user_role as enum ('admin', 'professional', 'receptionist', 'guardian', 'patient');

create type public.patient_status as enum ('active', 'inactive', 'waiting', 'discharged');
create type public.care_modality as enum ('presencial', 'virtual', 'mixta');
create type public.appointment_modality as enum ('presencial', 'virtual');

-- Estados de turno definidos en el brief: solicitado, pendiente, confirmado, reprogramado,
-- cancelado, completado, ausente.
create type public.appointment_status as enum (
  'requested', 'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'
);
create type public.appointment_source as enum ('app', 'admin', 'whatsapp', 'google', 'system');

create type public.material_type as enum ('pdf', 'image', 'audio', 'video', 'link', 'exercise');
create type public.material_visibility as enum ('public', 'assigned');

create type public.exercise_kind as enum (
  'thought_record', 'values', 'committed_action', 'defusion', 'dbt_skill',
  'breathing', 'grounding', 'mindful_pause', 'custom'
);
create type public.therapeutic_approach as enum ('tcc', 'act', 'dbt', 'regulacion', 'general');

create type public.notification_type as enum (
  'appointment_requested', 'appointment_confirmed', 'appointment_updated', 'appointment_cancelled',
  'appointment_reminder', 'new_material', 'exercise_assigned', 'system'
);

create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_status as enum ('received', 'queued', 'sent', 'delivered', 'read', 'failed');
create type public.conversation_status as enum ('open', 'handed_off', 'closed');
create type public.block_type as enum ('block', 'vacation', 'holiday', 'exception');
create type public.booking_mode as enum ('auto', 'approval');
create type public.calendar_sync_status as enum ('pending', 'synced', 'failed', 'skipped');

-- >>> supabase/migrations/20261005000002_core_tables.sql

-- ============================================================================
-- 0002 · Tablas principales
-- Convenciones: UUID como PK, created_at/updated_at donde corresponde,
-- zona horaria operativa America/Asuncion (todos los timestamptz se guardan en UTC).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles y perfiles
-- ---------------------------------------------------------------------------
create table public.roles (
  key         public.user_role primary key,
  name        text not null,
  description text,
  permissions text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.user_role not null default 'patient' references public.roles (key),
  email              text,
  first_name         text,
  last_name          text,
  full_name          text generated always as (
                       nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
                     ) stored,
  phone              text,
  avatar_url         text,
  is_active          boolean not null default true,
  two_factor_enabled boolean not null default false,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Pacientes (ficha ADMINISTRATIVA mínima; sin historia clínica)
-- ---------------------------------------------------------------------------
create table public.patients (
  id                               uuid primary key default gen_random_uuid(),
  profile_id                       uuid unique references public.profiles (id) on delete set null,
  first_name                       text not null,
  last_name                        text not null,
  email                            text,
  phone                            text,          -- E.164 (+595...)
  whatsapp_phone                   text,          -- E.164; si es null se usa phone
  birth_date                       date,
  emergency_contact_name           text,
  emergency_contact_phone          text,
  guardian_name                    text,          -- para menores (opcional)
  modality                         public.care_modality not null default 'mixta',
  status                           public.patient_status not null default 'active',
  admission_date                   date not null default current_date,
  share_records_with_professional  boolean not null default true,
  consent_accepted_at              timestamptz,
  consent_version                  text,
  invited_at                       timestamptz,
  created_by                       uuid references public.profiles (id) on delete set null,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);
create unique index patients_email_unique on public.patients (lower(email)) where email is not null;
create index patients_phone_idx on public.patients (phone);
create index patients_whatsapp_phone_idx on public.patients (whatsapp_phone);
create index patients_status_idx on public.patients (status);

-- Notas administrativas del profesional sobre el paciente (horarios, pagos, derivación).
-- Tabla separada: el paciente puede leer su propia ficha, pero NUNCA estas notas.
create table public.patient_admin_notes (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  notes      text not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Planes / servicios
-- ---------------------------------------------------------------------------
create table public.therapy_plans (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  short_description text,
  description       text,
  price_amount      numeric(12, 0),               -- null = "a consultar"
  currency          text not null default 'PYG',
  duration_minutes  integer,
  sessions_included integer,
  features          text[] not null default '{}',
  cta_label         text not null default 'Solicitar turno',
  cta_type          text not null default 'book' check (cta_type in ('book', 'consult')),
  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Disponibilidad y bloqueos
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id                    uuid primary key default gen_random_uuid(),
  weekday               smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time            time not null,
  end_time              time not null,
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes between 15 and 240),
  buffer_minutes        integer not null default 0 check (buffer_minutes between 0 and 120),
  modality              public.care_modality not null default 'mixta',
  is_active             boolean not null default true,
  valid_from            date,
  valid_until           date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint availability_rules_time_order check (end_time > start_time)
);
create index availability_rules_weekday_idx on public.availability_rules (weekday) where is_active;

create table public.blocked_slots (
  id         uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time   timestamptz not null,
  type       public.block_type not null default 'block',
  reason     text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_slots_time_order check (end_time > start_time)
);
create index blocked_slots_range_idx on public.blocked_slots using gist (tstzrange(start_time, end_time, '[)'));

-- ---------------------------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------------------------
create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients (id) on delete restrict,
  plan_id               uuid references public.therapy_plans (id) on delete set null,
  start_time            timestamptz not null,
  end_time              timestamptz not null,
  modality              public.appointment_modality not null default 'presencial',
  status                public.appointment_status not null default 'requested',
  source                public.appointment_source not null default 'app',
  video_link            text,
  location              text,
  patient_note          text,     -- comentario breve del paciente al solicitar (no clínico)
  confirmed_at          timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          uuid references public.profiles (id) on delete set null,
  cancellation_reason   text,
  completed_at          timestamptz,
  reminder_24h_sent_at  timestamptz,
  reminder_2h_sent_at   timestamptz,
  change_notice_sent_at timestamptz,
  google_event_id       text,
  google_sync_status    public.calendar_sync_status not null default 'pending',
  google_synced_at      timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint appointments_time_order check (end_time > start_time),
  -- Garantía definitiva contra double booking: dos turnos no cancelados no pueden solaparse.
  constraint appointments_no_overlap exclude using gist (
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status <> 'cancelled')
);
create index appointments_patient_idx on public.appointments (patient_id, start_time desc);
create index appointments_start_idx on public.appointments (start_time);
create index appointments_status_idx on public.appointments (status);
-- Coincide con la consulta del job de recordatorios (estados activos dentro de una ventana de start_time).
create index appointments_reminder_idx on public.appointments (start_time)
  where status in ('pending', 'confirmed', 'rescheduled');
create unique index appointments_google_event_idx on public.appointments (google_event_id) where google_event_id is not null;

-- Notas administrativas del turno (solo profesional).
create table public.appointment_admin_notes (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  notes          text not null,
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now()
);

create table public.appointment_history (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid not null references public.appointments (id) on delete cascade,
  previous_status     public.appointment_status,
  new_status          public.appointment_status not null,
  previous_start_time timestamptz,
  new_start_time      timestamptz,
  changed_by          uuid references public.profiles (id) on delete set null,
  change_source       public.appointment_source not null default 'system',
  reason              text,
  created_at          timestamptz not null default now()
);
create index appointment_history_appointment_idx on public.appointment_history (appointment_id, created_at desc);

create table public.session_preparations (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  week_rating    smallint check (week_rating between 0 and 10),
  hardest        text,
  better         text,
  topics         text,
  practiced      text,
  important      text,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ejercicios interactivos
-- ---------------------------------------------------------------------------
create table public.exercise_templates (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  description       text,
  kind              public.exercise_kind not null,
  approach          public.therapeutic_approach not null default 'general',
  steps             jsonb not null default '[]'::jsonb,
  estimated_minutes integer,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.exercise_assignments (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  template_id  uuid not null references public.exercise_templates (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  note         text,
  assigned_at  timestamptz not null default now(),
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index exercise_assignments_patient_idx on public.exercise_assignments (patient_id, completed_at);

create table public.exercise_responses (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  template_id      uuid not null references public.exercise_templates (id) on delete cascade,
  assignment_id    uuid references public.exercise_assignments (id) on delete set null,
  answers          jsonb not null default '{}'::jsonb,
  emotion_before   smallint check (emotion_before between 0 and 10),
  emotion_after    smallint check (emotion_after between 0 and 10),
  duration_seconds integer,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index exercise_responses_patient_idx on public.exercise_responses (patient_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Registro emocional
-- ---------------------------------------------------------------------------
create table public.emotional_logs (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  logged_at  timestamptz not null default now(),
  emotions   text[] not null check (cardinality(emotions) between 1 and 5),
  intensity  smallint not null check (intensity between 0 and 10),
  situation  text,
  thought    text,
  behavior   text,
  need       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index emotional_logs_patient_idx on public.emotional_logs (patient_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Materiales
-- ---------------------------------------------------------------------------
create table public.material_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.materials (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  description          text,
  type                 public.material_type not null,
  category_id          uuid references public.material_categories (id) on delete set null,
  storage_path         text,      -- ruta en el bucket privado "materials"
  external_url         text,      -- enlaces / videos externos
  exercise_template_id uuid references public.exercise_templates (id) on delete set null,
  cover_url            text,
  duration_minutes     integer,
  visibility           public.material_visibility not null default 'assigned',
  is_published         boolean not null default false,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint materials_source_check check (
    (type = 'link' and external_url is not null)
    or (type = 'exercise' and exercise_template_id is not null)
    or (type in ('pdf', 'image', 'audio', 'video') and (storage_path is not null or external_url is not null))
  )
);
create index materials_category_idx on public.materials (category_id);
create index materials_visibility_idx on public.materials (visibility, is_published);

create table public.patient_materials (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  material_id  uuid not null references public.materials (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  note         text,
  assigned_at  timestamptz not null default now(),
  viewed_at    timestamptz,
  completed_at timestamptz,
  unique (patient_id, material_id)
);
create index patient_materials_patient_idx on public.patient_materials (patient_id);

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------
create table public.notification_templates (
  key                  text primary key,
  channel              text not null check (channel in ('whatsapp', 'in_app')),
  title                text,
  body                 text not null,
  variables            text[] not null default '{}',
  wa_template_name     text,     -- nombre de plantilla aprobada en Meta (para mensajes fuera de la ventana de 24h)
  wa_template_language text default 'es',
  is_active            boolean not null default true,
  updated_at           timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- WhatsApp Business (Cloud API)
-- ---------------------------------------------------------------------------
create table public.whatsapp_contacts (
  id               uuid primary key default gen_random_uuid(),
  phone            text not null unique,       -- E.164
  wa_id            text,
  display_name     text,
  patient_id       uuid references public.patients (id) on delete set null,
  opted_out        boolean not null default false,
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index whatsapp_contacts_patient_idx on public.whatsapp_contacts (patient_id);

create table public.whatsapp_conversations (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null references public.whatsapp_contacts (id) on delete cascade,
  status            public.conversation_status not null default 'open',
  current_intent    text,
  state             jsonb not null default '{}'::jsonb,   -- slot-filling del flujo activo
  crisis_flagged_at timestamptz,
  handed_off_at     timestamptz,
  last_message_at   timestamptz,
  closed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index whatsapp_conversations_contact_idx on public.whatsapp_conversations (contact_id, status);

create table public.whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations (id) on delete cascade,
  contact_id      uuid not null references public.whatsapp_contacts (id) on delete cascade,
  direction       public.message_direction not null,
  wa_message_id   text unique,
  message_type    text not null default 'text',
  body            text,
  payload         jsonb,
  intent          text,
  confidence      numeric(4, 3),
  kind            text,          -- reminder_24h | reminder_2h | change_notice | booking_confirmation | reply | ...
  status          public.message_status not null default 'received',
  error           text,
  appointment_id  uuid references public.appointments (id) on delete set null,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id, created_at);
create index whatsapp_messages_appointment_idx on public.whatsapp_messages (appointment_id, kind);
-- Último mensaje enviado a un contacto (incluye avisos del sistema, que no tienen conversación).
create index whatsapp_messages_contact_idx on public.whatsapp_messages (contact_id, direction, created_at desc);

-- Idempotencia de webhooks: cada evento (message id / status id) se procesa una sola vez.
create table public.whatsapp_webhook_events (
  id           uuid primary key default gen_random_uuid(),
  event_key    text not null unique,
  event_type   text not null,
  payload      jsonb not null,
  status       text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  error        text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create table public.chatbot_intents (
  key                         text primary key,
  name                        text not null,
  description                 text,
  examples                    text[] not null default '{}',
  keywords                    text[] not null default '{}',
  response_template           text,
  requires_identified_patient boolean not null default false,
  is_enabled                  boolean not null default true,
  sort_order                  integer not null default 0,
  updated_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integraciones de calendario
-- ---------------------------------------------------------------------------
create table public.calendar_integrations (
  id                      uuid primary key default gen_random_uuid(),
  provider                text not null default 'google',
  owner_profile_id        uuid not null references public.profiles (id) on delete cascade,
  external_account_email  text,
  calendar_id             text not null default 'primary',
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  scopes                  text[] not null default '{}',
  sync_token              text,
  channel_id              text,
  channel_expires_at      timestamptz,
  last_synced_at          timestamptz,
  last_error              text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (provider, owner_profile_id)
);

create table public.calendar_sync_log (
  id                uuid primary key default gen_random_uuid(),
  integration_id    uuid references public.calendar_integrations (id) on delete cascade,
  appointment_id    uuid references public.appointments (id) on delete set null,
  direction         text not null check (direction in ('push', 'pull')),
  action            text not null,
  external_event_id text,
  status            text not null check (status in ('ok', 'error', 'skipped')),
  error             text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auditoría, configuración, recursos de emergencia, FAQs, rate limiting
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_role  public.user_role,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,   -- visible sin autenticación (landing)
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table public.emergency_resources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  phone       text,
  url         text,
  country     text not null default 'PY',
  sort_order  integer not null default 0,
  is_active   boolean not null default false,  -- inactivo hasta que el profesional lo verifique
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.rate_limit_hits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

-- >>> supabase/migrations/20261005000003_functions_and_triggers.sql

-- ============================================================================
-- 0003 · Funciones y triggers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'patients', 'therapy_plans', 'availability_rules', 'appointments',
    'session_preparations', 'exercise_templates', 'emotional_logs', 'materials',
    'whatsapp_contacts', 'whatsapp_conversations', 'calendar_integrations',
    'emergency_resources', 'faqs', 'chatbot_intents', 'notification_templates', 'settings',
    'patient_admin_notes', 'appointment_admin_notes'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers de identidad / rol (SECURITY DEFINER para evitar recursión en RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin', 'professional') from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin', 'professional', 'receptionist') from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- true cuando:
--   · la sesión es una conexión directa a la base SIN ningún JWT (migraciones, seed, SQL editor),
--   · la sesión es service_role (webhooks, crons, servidor),
--   · el usuario autenticado es administrador.
-- IMPORTANTE: una petición anónima de PostgREST (clave pública) SÍ trae JWT con role=anon y sin "sub";
-- por eso no alcanza con auth.uid() is null: se exige que no exista JWT en absoluto.
create or replace function public.is_privileged()
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.jwt() is null
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or public.is_admin();
$$;

create or replace function public.current_patient_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.patients where profile_id = auth.uid();
$$;

-- Los permisos de ejecución se definen al final del archivo (sección "Permisos de ejecución").

-- ---------------------------------------------------------------------------
-- Alta de perfil al crear usuario en auth.users (invitación / creación por admin)
-- El rol NUNCA se toma de user_metadata (editable por el usuario): solo de app_metadata.
-- El paciente se vincula por coincidencia de email verificado, no por IDs enviados por el cliente.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role       public.user_role := 'patient';
  v_patient    public.patients%rowtype;
  v_first      text;
  v_last       text;
  v_full       text;
begin
  begin
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'patient');
  exception when others then
    v_role := 'patient';
  end;

  v_full  := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_first := coalesce(new.raw_user_meta_data ->> 'first_name', nullif(split_part(v_full, ' ', 1), ''));
  v_last  := coalesce(new.raw_user_meta_data ->> 'last_name', nullif(regexp_replace(v_full, '^\S+\s*', ''), ''));

  if new.email is not null then
    select * into v_patient
    from public.patients
    where lower(email) = lower(new.email) and profile_id is null
    limit 1;
    if found then
      v_first := coalesce(v_patient.first_name, v_first);
      v_last  := coalesce(v_patient.last_name, v_last);
    end if;
  end if;

  insert into public.profiles (id, role, email, first_name, last_name, phone)
  values (new.id, v_role, new.email, v_first, v_last, coalesce(v_patient.phone, new.phone))
  on conflict (id) do nothing;

  if v_patient.id is not null then
    update public.patients
       set profile_id = new.id,
           invited_at = coalesce(invited_at, now())
     where id = v_patient.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Guardas de columnas: un usuario no privilegiado no puede escalar rol ni
-- modificar campos administrativos.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'No tenés permiso para modificar estos campos del perfil' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_patient_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.profile_id is distinct from old.profile_id
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.email is distinct from old.email
     or new.modality is distinct from old.modality
     or new.status is distinct from old.status
     or new.admission_date is distinct from old.admission_date
     -- El número de WhatsApp identifica al paciente ante la secretaria virtual: solo lo cambia el profesional.
     or new.whatsapp_phone is distinct from old.whatsapp_phone
     or new.created_by is distinct from old.created_by
     or new.invited_at is distinct from old.invited_at then
    raise exception 'No tenés permiso para modificar estos campos' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger patients_guard_update
  before update on public.patients
  for each row execute function public.guard_patient_update();

create or replace function public.guard_patient_material_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.patient_id is distinct from old.patient_id
     or new.material_id is distinct from old.material_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at
     or new.note is distinct from old.note then
    raise exception 'Solo podés actualizar el estado de visto/completado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger patient_materials_guard_update
  before update on public.patient_materials
  for each row execute function public.guard_patient_material_update();

create or replace function public.guard_exercise_assignment_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.patient_id is distinct from old.patient_id
     or new.template_id is distinct from old.template_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at
     or new.due_at is distinct from old.due_at
     or new.note is distinct from old.note then
    raise exception 'Solo podés marcar el ejercicio como completado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger exercise_assignments_guard_update
  before update on public.exercise_assignments
  for each row execute function public.guard_exercise_assignment_update();

-- ---------------------------------------------------------------------------
-- Configuración: lectura tipada de settings desde SQL
-- ---------------------------------------------------------------------------
create or replace function public.setting_value(p_key text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Turnos: historial de cambios
-- ---------------------------------------------------------------------------
create or replace function public.log_appointment_history()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_source public.appointment_source;
begin
  begin
    v_source := coalesce(nullif(current_setting('app.change_source', true), '')::public.appointment_source, 'system');
  exception when others then
    v_source := 'system';
  end;

  if tg_op = 'INSERT' then
    insert into public.appointment_history (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, change_source, reason)
    values (new.id, null, new.status, null, new.start_time, coalesce(new.created_by, auth.uid()), coalesce(new.source, v_source), nullif(current_setting('app.change_reason', true), ''));
    return new;
  end if;

  if new.status is distinct from old.status or new.start_time is distinct from old.start_time then
    insert into public.appointment_history (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, change_source, reason)
    values (new.id, old.status, new.status, old.start_time, new.start_time, auth.uid(), v_source,
            coalesce(nullif(current_setting('app.change_reason', true), ''),
                     case when new.status = 'cancelled' then new.cancellation_reason end));
  end if;
  return new;
end;
$$;

create trigger appointments_history
  after insert or update on public.appointments
  for each row execute function public.log_appointment_history();

-- ---------------------------------------------------------------------------
-- Turnos: guarda para pacientes (solo confirmar / cancelar / nota, dentro de ventana)
-- ---------------------------------------------------------------------------
create or replace function public.guard_patient_appointment_update()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_scheduling jsonb := coalesce(public.setting_value('scheduling'), '{}'::jsonb);
  v_cancel_min_hours numeric := coalesce((v_scheduling ->> 'cancel_min_hours')::numeric, 12);
  v_allow_cancel boolean := coalesce((v_scheduling ->> 'allow_patient_cancel')::boolean, true);
begin
  if public.is_privileged() then
    return new;
  end if;

  -- Cambios hechos por reschedule_appointment_tx: la RPC ya validó propiedad, ventana,
  -- grilla de disponibilidad y superposición. El flag es local a la transacción y solo
  -- puede fijarse desde funciones SECURITY DEFINER (PostgREST no expone set_config).
  if coalesce(current_setting('app.trusted_rpc', true), '') = 'reschedule' then
    return new;
  end if;

  -- Campos que el paciente jamás puede tocar directamente.
  if new.patient_id is distinct from old.patient_id
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.modality is distinct from old.modality
     or new.plan_id is distinct from old.plan_id
     or new.video_link is distinct from old.video_link
     or new.location is distinct from old.location
     or new.source is distinct from old.source
     or new.reminder_24h_sent_at is distinct from old.reminder_24h_sent_at
     or new.reminder_2h_sent_at is distinct from old.reminder_2h_sent_at
     or new.google_event_id is distinct from old.google_event_id
     or new.completed_at is distinct from old.completed_at then
    raise exception 'No tenés permiso para modificar este turno' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status in ('pending', 'rescheduled', 'confirmed') then
      new.confirmed_at := coalesce(new.confirmed_at, now());
    elsif new.status = 'cancelled' and old.status in ('requested', 'pending', 'confirmed', 'rescheduled') then
      if not v_allow_cancel then
        raise exception 'La cancelación desde la aplicación no está habilitada. Escribinos para coordinar.' using errcode = 'P0001';
      end if;
      if old.start_time - (v_cancel_min_hours * interval '1 hour') < now() then
        raise exception 'Este turno ya no puede cancelarse desde la aplicación. Escribinos para coordinar.' using errcode = 'P0001';
      end if;
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    else
      raise exception 'Transición de estado no permitida' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger appointments_guard_patient_update
  before update on public.appointments
  for each row execute function public.guard_patient_appointment_update();

-- ---------------------------------------------------------------------------
-- Turnos: validación de la grilla de disponibilidad (espejo de src/lib/scheduling/slots.ts)
-- Un rango es reservable por un paciente si coincide EXACTAMENTE con un turno generado por
-- alguna regla activa: mismo día de semana, dentro de la franja, duración de la regla y
-- alineado a pasos de (duración + intervalo) desde el inicio de la franja.
-- ---------------------------------------------------------------------------
create or replace function public.is_bookable_slot(
  p_start    timestamptz,
  p_end      timestamptz,
  p_modality public.appointment_modality
)
returns boolean
language sql stable security definer set search_path = public as $$
  with tz as (
    select coalesce(public.setting_value('scheduling') ->> 'timezone', 'America/Asuncion') as name
  ), l as (
    select (p_start at time zone tz.name) as ls, (p_end at time zone tz.name) as le from tz
  )
  select exists (
    select 1
    from public.availability_rules r, l
    where r.is_active
      and r.weekday = extract(dow from l.ls)::int
      and l.ls::date = l.le::date
      and (r.modality = 'mixta' or r.modality::text = p_modality::text)
      and (r.valid_from is null or l.ls::date >= r.valid_from)
      and (r.valid_until is null or l.ls::date <= r.valid_until)
      and l.ls::time >= r.start_time
      and l.le::time <= r.end_time
      and p_end - p_start = make_interval(mins => r.slot_duration_minutes)
      and mod(
            extract(epoch from (l.ls::time - r.start_time))::bigint,
            ((r.slot_duration_minutes + r.buffer_minutes) * 60)::bigint
          ) = 0
  );
$$;

-- Reglas de reserva comunes para pacientes (anticipación mínima, máximo de días y grilla).
create or replace function public.assert_patient_bookable(
  p_start    timestamptz,
  p_end      timestamptz,
  p_modality public.appointment_modality
)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_scheduling jsonb := coalesce(public.setting_value('scheduling'), '{}'::jsonb);
  v_min_hours  numeric := coalesce((v_scheduling ->> 'min_hours_before_booking')::numeric, 12);
  v_max_days   integer := coalesce((v_scheduling ->> 'max_days_in_advance')::integer, 45);
begin
  if p_start < now() + (v_min_hours * interval '1 hour') then
    raise exception 'Ese horario ya no admite reservas desde la aplicación. Elegí otro o escribinos.' using errcode = '22023';
  end if;
  if p_start > now() + (v_max_days * interval '1 day') then
    raise exception 'Ese horario supera la anticipación máxima permitida.' using errcode = '22023';
  end if;
  if not public.is_bookable_slot(p_start, p_end, p_modality) then
    raise exception 'Ese horario está fuera de la disponibilidad del profesional.' using errcode = '22023';
  end if;
end;
$$;

-- Estado inicial de una reserva hecha por el paciente: lo decide la configuración, nunca el cliente.
create or replace function public.patient_booking_status()
returns public.appointment_status
language sql stable security definer set search_path = public as $$
  select case
    when coalesce(public.setting_value('scheduling') ->> 'booking_mode', 'approval') = 'auto' then 'confirmed'::public.appointment_status
    else 'requested'::public.appointment_status
  end;
$$;

-- ---------------------------------------------------------------------------
-- Turnos: creación transaccional (anti double booking)
-- ---------------------------------------------------------------------------
create or replace function public.create_appointment_tx(
  p_patient_id   uuid,
  p_start        timestamptz,
  p_end          timestamptz,
  p_modality     public.appointment_modality,
  p_status       public.appointment_status default 'requested',
  p_source       public.appointment_source default 'app',
  p_patient_note text default null,
  p_plan_id      uuid default null,
  p_video_link   text default null,
  p_location     text default null,
  p_admin_notes  text default null
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_appt       public.appointments;
  v_privileged boolean := public.is_privileged();
begin
  if not v_privileged then
    if p_patient_id is distinct from public.current_patient_id() then
      raise exception 'No podés reservar turnos para otra persona' using errcode = '42501';
    end if;
    -- El paciente no elige el estado, el origen ni los datos administrativos.
    p_status      := public.patient_booking_status();
    p_source      := 'app';
    p_video_link  := null;
    p_location    := null;
    p_admin_notes := null;
    perform public.assert_patient_bookable(p_start, p_end, p_modality);
  end if;

  if p_end <= p_start then
    raise exception 'Rango horario inválido' using errcode = '22023';
  end if;

  -- Serializa las reservas: evita condiciones de carrera entre dos solicitudes simultáneas.
  perform pg_advisory_xact_lock(hashtext('appointments_booking'));

  if exists (
    select 1 from public.appointments a
    where a.status <> 'cancelled'
      and tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'El horario ya no está disponible' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.blocked_slots b
    where tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'El horario está bloqueado' using errcode = '23P01';
  end if;

  insert into public.appointments (
    patient_id, plan_id, start_time, end_time, modality, status, source,
    patient_note, video_link, location, confirmed_at, created_by
  ) values (
    p_patient_id, p_plan_id, p_start, p_end, p_modality, p_status, p_source,
    nullif(btrim(coalesce(p_patient_note, '')), ''), p_video_link, p_location,
    case when p_status = 'confirmed' then now() end, auth.uid()
  )
  returning * into v_appt;

  -- Las notas administrativas viven en una tabla aparte, invisible para el paciente.
  if nullif(btrim(coalesce(p_admin_notes, '')), '') is not null then
    insert into public.appointment_admin_notes (appointment_id, notes, updated_by)
    values (v_appt.id, btrim(p_admin_notes), auth.uid());
  end if;

  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turnos: reprogramación transaccional
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment_tx(
  p_appointment_id uuid,
  p_new_start      timestamptz,
  p_new_end        timestamptz,
  p_new_status     public.appointment_status default 'rescheduled',
  p_reason         text default null,
  p_source         public.appointment_source default 'app'
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_appt            public.appointments;
  v_privileged      boolean := public.is_privileged();
  v_scheduling      jsonb := coalesce(public.setting_value('scheduling'), '{}'::jsonb);
  v_min_hours       numeric := coalesce((v_scheduling ->> 'reschedule_min_hours')::numeric, 12);
  v_allow           boolean := coalesce((v_scheduling ->> 'allow_patient_reschedule')::boolean, true);
begin
  perform pg_advisory_xact_lock(hashtext('appointments_booking'));

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Turno no encontrado' using errcode = 'P0002';
  end if;

  if not v_privileged then
    if v_appt.patient_id is distinct from public.current_patient_id() then
      raise exception 'No podés modificar este turno' using errcode = '42501';
    end if;
    if not v_allow then
      raise exception 'La reprogramación desde la aplicación no está habilitada. Escribinos para coordinar.' using errcode = 'P0001';
    end if;
    if v_appt.status not in ('requested', 'pending', 'confirmed', 'rescheduled') then
      raise exception 'Este turno no puede reprogramarse' using errcode = 'P0001';
    end if;
    if v_appt.start_time - (v_min_hours * interval '1 hour') < now() then
      raise exception 'Este turno ya no puede reprogramarse desde la aplicación. Escribinos para coordinar.' using errcode = 'P0001';
    end if;
    -- El nuevo horario debe ser un turno válido de la grilla, con la misma modalidad.
    perform public.assert_patient_bookable(p_new_start, p_new_end, v_appt.modality);
    p_new_status := public.patient_booking_status();
    p_source := 'app';
  end if;

  if p_new_end <= p_new_start then
    raise exception 'Rango horario inválido' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.id <> p_appointment_id
      and a.status <> 'cancelled'
      and tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_new_start, p_new_end, '[)')
  ) then
    raise exception 'El horario ya no está disponible' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.blocked_slots b
    where tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_new_start, p_new_end, '[)')
  ) then
    raise exception 'El horario está bloqueado' using errcode = '23P01';
  end if;

  perform set_config('app.change_source', p_source::text, true);
  perform set_config('app.change_reason', coalesce(p_reason, ''), true);
  perform set_config('app.trusted_rpc', 'reschedule', true);

  update public.appointments
     set start_time            = p_new_start,
         end_time              = p_new_end,
         status                = p_new_status,
         confirmed_at          = case when p_new_status = 'confirmed' then now() else null end,
         reminder_24h_sent_at  = null,
         reminder_2h_sent_at   = null,
         change_notice_sent_at = null,
         google_sync_status    = 'pending'
   where id = p_appointment_id
   returning * into v_appt;

  perform set_config('app.trusted_rpc', '', true);

  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turnos: cancelar y confirmar (RPC con validación centralizada)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_appointment_tx(
  p_appointment_id uuid,
  p_reason         text default null,
  p_source         public.appointment_source default 'app'
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_appt       public.appointments;
  v_privileged boolean := public.is_privileged();
  v_scheduling jsonb := coalesce(public.setting_value('scheduling'), '{}'::jsonb);
  v_min_hours  numeric := coalesce((v_scheduling ->> 'cancel_min_hours')::numeric, 12);
  v_allow      boolean := coalesce((v_scheduling ->> 'allow_patient_cancel')::boolean, true);
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Turno no encontrado' using errcode = 'P0002';
  end if;
  if v_appt.status = 'cancelled' then
    return v_appt;
  end if;
  if v_appt.status in ('completed', 'no_show') then
    raise exception 'Este turno ya finalizó' using errcode = 'P0001';
  end if;

  if not v_privileged then
    if v_appt.patient_id is distinct from public.current_patient_id() then
      raise exception 'No podés cancelar este turno' using errcode = '42501';
    end if;
    if not v_allow then
      raise exception 'La cancelación desde la aplicación no está habilitada. Escribinos para coordinar.' using errcode = 'P0001';
    end if;
    if v_appt.start_time - (v_min_hours * interval '1 hour') < now() then
      raise exception 'Este turno ya no puede cancelarse desde la aplicación. Escribinos para coordinar.' using errcode = 'P0001';
    end if;
    p_source := 'app';
  end if;

  perform set_config('app.change_source', p_source::text, true);
  perform set_config('app.change_reason', coalesce(p_reason, ''), true);

  update public.appointments
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancelled_by        = auth.uid(),
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         google_sync_status  = 'pending'
   where id = p_appointment_id
   returning * into v_appt;

  return v_appt;
end;
$$;

create or replace function public.confirm_appointment_tx(
  p_appointment_id uuid,
  p_source         public.appointment_source default 'app'
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_appt       public.appointments;
  v_privileged boolean := public.is_privileged();
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Turno no encontrado' using errcode = 'P0002';
  end if;
  if not v_privileged and v_appt.patient_id is distinct from public.current_patient_id() then
    raise exception 'No podés confirmar este turno' using errcode = '42501';
  end if;
  if v_appt.status not in ('pending', 'rescheduled', 'confirmed', 'requested') then
    raise exception 'Este turno no puede confirmarse' using errcode = 'P0001';
  end if;
  if v_appt.status = 'requested' and not v_privileged then
    raise exception 'Este turno todavía está pendiente de aprobación' using errcode = 'P0001';
  end if;

  perform set_config('app.change_source', (case when v_privileged then p_source else 'app' end)::text, true);

  update public.appointments
     set status       = 'confirmed',
         confirmed_at = coalesce(confirmed_at, now())
   where id = p_appointment_id
   returning * into v_appt;

  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notificaciones in-app automáticas (consistentes sin importar el canal de origen)
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins(p_type public.notification_type, p_title text, p_body text, p_data jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, data)
  select p.id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.role in ('admin', 'professional') and p.is_active;
$$;

create or replace function public.format_appointment_datetime(p_ts timestamptz)
returns text
language sql stable as $$
  select to_char(p_ts at time zone coalesce(public.setting_value('scheduling') ->> 'timezone', 'America/Asuncion'), 'DD/MM/YYYY "a las" HH24:MI');
$$;

create or replace function public.notify_appointment_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_name       text;
  v_when       text := public.format_appointment_datetime(new.start_time);
  -- Origen real del cambio (lo fijan las RPC): 'app'/'whatsapp' = lo pidió el propio paciente.
  v_source     text := coalesce(nullif(current_setting('app.change_source', true), ''), 'system');
  v_by_patient boolean;
  -- Lo canceló el propio paciente: desde la app (cancelled_by = su perfil) o por WhatsApp (la RPC
  -- corre con service_role, sin usuario, y marca el origen 'whatsapp').
  v_cancelled_by_patient boolean;
begin
  select p.profile_id, p.first_name || ' ' || p.last_name into v_profile_id, v_name
  from public.patients p where p.id = new.patient_id;
  v_by_patient := v_source in ('app', 'whatsapp');
  v_cancelled_by_patient := (v_profile_id is not null and new.cancelled_by = v_profile_id)
                         or (new.cancelled_by is null and v_by_patient);

  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      perform public.notify_admins('appointment_requested', 'Nueva solicitud de turno',
        coalesce(v_name, 'Un paciente') || ' solicitó un turno para el ' || v_when || '.',
        jsonb_build_object('appointment_id', new.id, 'patient_id', new.patient_id));
    elsif v_profile_id is not null and new.status in ('pending', 'confirmed') then
      insert into public.notifications (user_id, type, title, body, data)
      values (v_profile_id, 'appointment_confirmed',
        case when new.status = 'confirmed' then 'Turno confirmado' else 'Turno registrado' end,
        'Tu sesión quedó agendada para el ' || v_when || '.',
        jsonb_build_object('appointment_id', new.id));
    end if;
    return new;
  end if;

  if v_profile_id is not null then
    if new.start_time is distinct from old.start_time and v_by_patient then
      -- El paciente eligió el nuevo horario: aviso neutro, sin pedirle que confirme su propio cambio.
      insert into public.notifications (user_id, type, title, body, data)
      values (v_profile_id, 'appointment_updated',
        case when new.status = 'requested' then 'Pedido de cambio registrado' else 'Turno reprogramado' end,
        case when new.status = 'requested'
          then 'Pediste pasar tu sesión al ' || v_when || '. Te avisamos cuando el profesional lo apruebe.'
          else 'Tu sesión quedó para el ' || v_when || '.' end,
        jsonb_build_object('appointment_id', new.id));
    elsif new.start_time is distinct from old.start_time then
      insert into public.notifications (user_id, type, title, body, data)
      values (v_profile_id, 'appointment_updated', 'Tu turno cambió de horario',
        'Nuevo horario: ' || v_when || '. Por favor, confirmá si te queda bien.',
        jsonb_build_object('appointment_id', new.id));
    elsif new.status is distinct from old.status then
      if new.status = 'confirmed' and old.status = 'requested' then
        insert into public.notifications (user_id, type, title, body, data)
        values (v_profile_id, 'appointment_confirmed', 'Tu solicitud fue aprobada',
          'Tu sesión quedó confirmada para el ' || v_when || '.',
          jsonb_build_object('appointment_id', new.id));
      elsif new.status = 'cancelled' and not v_cancelled_by_patient then
        insert into public.notifications (user_id, type, title, body, data)
        values (v_profile_id, 'appointment_cancelled', 'Turno cancelado',
          'La sesión del ' || v_when || ' fue cancelada. Podés solicitar un nuevo horario cuando quieras.',
          jsonb_build_object('appointment_id', new.id));
      end if;
    end if;
  end if;

  if new.start_time is distinct from old.start_time and v_by_patient then
    perform public.notify_admins(
      case when new.status = 'requested' then 'appointment_requested'::public.notification_type else 'appointment_updated'::public.notification_type end,
      case when new.status = 'requested' then 'Solicitud de reprogramación' else 'Un paciente reprogramó su turno' end,
      coalesce(v_name, 'Un paciente') || case when new.status = 'requested' then ' pidió pasar su sesión al ' else ' pasó su sesión al ' end || v_when || '.',
      jsonb_build_object('appointment_id', new.id, 'patient_id', new.patient_id));
  end if;
  if new.status is distinct from old.status and new.status = 'cancelled' and v_cancelled_by_patient then
    perform public.notify_admins('appointment_cancelled', 'Un paciente canceló su turno',
      coalesce(v_name, 'Un paciente') || ' canceló la sesión del ' || v_when || '.',
      jsonb_build_object('appointment_id', new.id, 'patient_id', new.patient_id));
  end if;
  if new.status is distinct from old.status and new.status = 'confirmed' and old.status in ('pending', 'rescheduled') then
    perform public.notify_admins('appointment_confirmed', 'Asistencia confirmada',
      coalesce(v_name, 'Un paciente') || ' confirmó la sesión del ' || v_when || '.',
      jsonb_build_object('appointment_id', new.id, 'patient_id', new.patient_id));
  end if;

  return new;
end;
$$;

create trigger appointments_notify
  after insert or update on public.appointments
  for each row execute function public.notify_appointment_change();

create or replace function public.notify_material_assigned()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_title      text;
begin
  if new.assigned_by is null then
    return new; -- registro de visualización de material público; no es una asignación.
  end if;
  select p.profile_id into v_profile_id from public.patients p where p.id = new.patient_id;
  select m.title into v_title from public.materials m where m.id = new.material_id;
  if v_profile_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_profile_id, 'new_material', 'Nuevo material para vos',
      coalesce(v_title, 'Tenés un nuevo material recomendado.'),
      jsonb_build_object('material_id', new.material_id));
  end if;
  return new;
end;
$$;

create trigger patient_materials_notify
  after insert on public.patient_materials
  for each row execute function public.notify_material_assigned();

create or replace function public.notify_exercise_assigned()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_title      text;
begin
  select p.profile_id into v_profile_id from public.patients p where p.id = new.patient_id;
  select t.title into v_title from public.exercise_templates t where t.id = new.template_id;
  if v_profile_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_profile_id, 'exercise_assigned', 'Nuevo ejercicio sugerido',
      coalesce(v_title, 'Tenés un nuevo ejercicio para practicar.'),
      jsonb_build_object('assignment_id', new.id, 'template_id', new.template_id));
  end if;
  return new;
end;
$$;

create trigger exercise_assignments_notify
  after insert on public.exercise_assignments
  for each row execute function public.notify_exercise_assigned();

-- ---------------------------------------------------------------------------
-- Rate limiting (ventanas fijas) y auditoría
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limit_hits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Registro de auditoría. El actor SIEMPRE es el usuario autenticado (no se puede suplantar);
-- las llamadas sin usuario solo se aceptan desde service_role. Tamaños acotados contra abuso.
create or replace function public.audit_log(
  p_action      text,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and auth.jwt() is not null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(coalesce(p_action, '')) not between 1 and 100
     or length(coalesce(p_entity_type, '')) > 60
     or length(coalesce(p_entity_id, '')) > 100
     or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 4096 then
    raise exception 'Registro de auditoría inválido' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), public.current_user_role(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Métricas administrativas (sin contenido clínico)
-- ---------------------------------------------------------------------------
create or replace function public.admin_monthly_stats(p_from timestamptz, p_to timestamptz)
returns table (
  total        bigint,
  confirmed    bigint,
  completed    bigint,
  cancelled    bigint,
  no_show      bigint,
  requested    bigint,
  virtual      bigint,
  presencial   bigint
)
language sql stable security definer set search_path = public as $$
  select
    count(*)                                                 as total,
    count(*) filter (where status = 'confirmed')             as confirmed,
    count(*) filter (where status = 'completed')             as completed,
    count(*) filter (where status = 'cancelled')             as cancelled,
    count(*) filter (where status = 'no_show')               as no_show,
    count(*) filter (where status in ('requested','pending')) as requested,
    count(*) filter (where modality = 'virtual')             as virtual,
    count(*) filter (where modality = 'presencial')          as presencial
  from public.appointments
  where start_time >= p_from and start_time < p_to
    and public.is_admin();
$$;

create or replace function public.admin_popular_hours(p_from timestamptz, p_to timestamptz)
returns table (hour_label text, bookings bigint)
language sql stable security definer set search_path = public as $$
  select to_char(start_time at time zone coalesce(public.setting_value('scheduling') ->> 'timezone', 'America/Asuncion'), 'HH24:00') as hour_label,
         count(*) as bookings
  from public.appointments
  where start_time >= p_from and start_time < p_to
    and status not in ('cancelled')
    and public.is_admin()
  group by 1
  order by bookings desc, hour_label
  limit 8;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución (mínimo privilegio)
-- PostgreSQL otorga EXECUTE a PUBLIC por defecto y Supabase además a anon/authenticated.
-- Se revoca todo y se otorga explícitamente solo lo que cada rol necesita. Las funciones
-- SECURITY DEFINER (triggers, RPCs) siguen pudiendo invocar helpers internos porque se
-- ejecutan con los permisos de su dueño.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
-- El EXECUTE para PUBLIC es un default GLOBAL: solo se revoca con la forma sin "in schema"
-- (aplica a las funciones que cree el rol que corre las migraciones). Los grants por esquema
-- que agrega Supabase a anon/authenticated sí se revocan por esquema.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Helpers usados por las políticas RLS: deben poder evaluarse para cualquier rol.
grant execute on function
  public.current_user_role(),
  public.is_admin(),
  public.is_staff(),
  public.is_privileged(),
  public.current_patient_id()
to anon, authenticated, service_role;

-- RPCs de agenda (validan propiedad, ventanas y grilla internamente).
grant execute on function
  public.create_appointment_tx(uuid, timestamptz, timestamptz, public.appointment_modality, public.appointment_status, public.appointment_source, text, uuid, text, text, text),
  public.reschedule_appointment_tx(uuid, timestamptz, timestamptz, public.appointment_status, text, public.appointment_source),
  public.cancel_appointment_tx(uuid, text, public.appointment_source),
  public.confirm_appointment_tx(uuid, public.appointment_source)
to authenticated, service_role;

-- Auditoría (actor forzado = usuario autenticado) y métricas administrativas (devuelven 0 si no es admin).
grant execute on function
  public.audit_log(text, text, text, jsonb),
  public.admin_monthly_stats(timestamptz, timestamptz),
  public.admin_popular_hours(timestamptz, timestamptz)
to authenticated, service_role;

-- Solo servidor: rate limiting (una clave arbitraria permitiría bloquear cuentas ajenas),
-- limpieza y lectura de configuración privada.
grant execute on function
  public.check_rate_limit(text, integer, integer),
  public.cleanup_rate_limits(),
  public.setting_value(text),
  public.is_bookable_slot(timestamptz, timestamptz, public.appointment_modality),
  public.patient_booking_status()
to service_role;
-- notify_admins, assert_patient_bookable, format_appointment_datetime y las funciones de trigger
-- quedan sin EXECUTE para roles de cliente: solo se invocan desde otras funciones SECURITY DEFINER.

-- >>> supabase/migrations/20261005000004_rls_policies.sql

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

-- >>> supabase/migrations/20261005000005_storage.sql

-- ============================================================================
-- 0005 · Storage: buckets y políticas
--   materials → privado (PDF, audio, video, imágenes). Acceso por URL firmada.
--   avatars   → público (fotos de perfil, carpeta por usuario).
--   branding  → público (foto profesional, logo) administrado por el admin.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('materials', 'materials', false, 52428800, array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm'
  ]),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('branding', 'branding', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- materials: admin gestiona; el paciente solo lee objetos de materiales a los que tiene acceso.
create policy "materials: admin gestiona objetos" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());

create policy "materials: paciente lee accesibles" on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.materials m
      where m.storage_path = storage.objects.name
        and m.is_published
        and (
          m.visibility = 'public'
          or exists (
            select 1 from public.patient_materials pm
            where pm.material_id = m.id and pm.patient_id = public.current_patient_id() and pm.assigned_by is not null
          )
        )
    )
  );

-- avatars: lectura pública; cada usuario escribe solo en su carpeta.
create policy "avatars: lectura pública" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: subir propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: actualizar propio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: borrar propio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- branding: lectura pública; escritura solo admin.
create policy "branding: lectura pública" on storage.objects for select to anon, authenticated using (bucket_id = 'branding');
create policy "branding: admin gestiona" on storage.objects for all to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

-- >>> supabase/migrations/20261005000006_reference_data.sql

-- ============================================================================
-- 0006 · Datos de referencia (necesarios para que la app funcione)
-- Sin datos personales. Los datos de demostración viven en supabase/seed.sql.
-- ============================================================================

-- Roles ---------------------------------------------------------------------
insert into public.roles (key, name, description, permissions) values
  ('admin', 'Administrador / Psicólogo', 'Acceso completo a la plataforma.', array['*']),
  ('professional', 'Profesional', 'Segundo profesional (preparado para el futuro).', array['agenda:*', 'patients:*', 'materials:*']),
  ('receptionist', 'Recepcionista', 'Gestión de agenda y datos administrativos (preparado para el futuro).', array['agenda:*', 'patients:read']),
  ('guardian', 'Padre / Tutor', 'Acceso acotado para tutores de menores (preparado para el futuro).', array['appointments:read']),
  ('patient', 'Paciente', 'Acceso exclusivo a sus propios datos.', array['self:*'])
on conflict (key) do nothing;

-- Configuración -------------------------------------------------------------
insert into public.settings (key, value, description, is_public) values
  ('site.identity', jsonb_build_object(
    'platform_name', 'Psicología Matías Sánchez',
    'professional_name', 'Lic. Matías Sánchez',
    'professional_title', 'Psicólogo',
    'license', 'RP 14394-LP',
    'country', 'Paraguay',
    'tagline', 'Un espacio para comprender lo que te pasa y trabajar en lo que necesitás.',
    'bio', 'Soy psicólogo y acompaño procesos de adolescentes y adultos desde un enfoque integrador basado en la terapia cognitivo-conductual, la terapia de aceptación y compromiso y las habilidades de la terapia dialéctico-conductual. Trabajo con cercanía, claridad y respeto por el ritmo de cada persona.',
    'photo_url', null,
    'email', null,
    'phone', null,
    'whatsapp', null,
    'location_name', null,
    'location_address', null,
    'location_map_url', null,
    'links', jsonb_build_object('instagram', null, 'linkedin', null, 'website', null)
  ), 'Identidad profesional y datos de contacto públicos.', true),

  ('scheduling', jsonb_build_object(
    'timezone', 'America/Asuncion',
    'default_duration_minutes', 60,
    'default_buffer_minutes', 0,
    'booking_mode', 'approval',
    'min_hours_before_booking', 12,
    'max_days_in_advance', 45,
    'allow_patient_reschedule', true,
    'allow_patient_cancel', true,
    'reschedule_min_hours', 12,
    'cancel_min_hours', 12,
    'session_prep_enabled', true,
    'session_prep_hours_before', 24,
    'default_location', null,
    'default_video_provider', 'google_meet',
    'modalities_enabled', jsonb_build_array('presencial', 'virtual')
  ), 'Reglas de agenda y reservas.', true),

  ('reminders', jsonb_build_object(
    'enabled', true,
    'reminder_24h_enabled', true,
    'reminder_24h_hours_before', 24,
    'additional_reminder_enabled', false,
    'additional_reminder_hours_before', 2,
    'send_window_minutes', 90,
    'channels', jsonb_build_array('whatsapp', 'in_app'),
    'quiet_hours_start', '22:00',
    'quiet_hours_end', '08:00'
  ), 'Recordatorios automáticos.', false),

  ('whatsapp', jsonb_build_object(
    'enabled', false,
    'assistant_name', 'Asistente virtual',
    'greeting', 'Hola. Soy la asistente virtual del Lic. Matías Sánchez. Puedo ayudarte a consultar horarios, agendar o reprogramar una sesión, conocer los planes de atención o resolver dudas administrativas.',
    'handoff_message', 'Perfecto. Le aviso al Lic. Matías para que te escriba personalmente. Tené en cuenta que por este medio la respuesta puede demorar.',
    'out_of_scope_message', 'Gracias por contarlo. Por este medio puedo ayudarte principalmente con cuestiones administrativas y de agenda. Si querés, puedo ayudarte a reservar una sesión con el Lic. Matías.',
    'ai_enabled', true,
    'ai_confidence_threshold', 0.6,
    'max_slots_to_offer', 6
  ), 'Secretaria virtual por WhatsApp.', false),

  ('emergency', jsonb_build_object(
    'message', 'Si existe riesgo inmediato para vos o para otra persona, buscá atención de urgencia presencial o comunicate con los servicios de emergencia de tu zona.',
    'contact_note', 'Podés escribirle al profesional, pero tené en cuenta que WhatsApp no garantiza una respuesta inmediata.',
    'show_contact_professional', true
  ), 'Protocolo de emergencia mostrado por la app y el chatbot.', true),

  ('gamification', jsonb_build_object('enabled', true, 'weekly_summary', true), 'Elementos neutrales de progreso.', false),

  ('theme', jsonb_build_object('primary', '#1f4e5f', 'accent', '#a8dccb', 'background', '#faf8f5'), 'Colores básicos de la interfaz.', true),

  ('legal', jsonb_build_object(
    'privacy_version', '2026-10-draft',
    'terms_version', '2026-10-draft',
    'consent_version', '2026-10-draft',
    'reviewed_by_professional', false
  ), 'Versiones de textos legales (requieren revisión profesional antes de producción).', true),

  ('landing', jsonb_build_object(
    'hero_title', 'Un espacio para comprender lo que te pasa y trabajar en lo que necesitás.',
    'hero_subtitle', 'Acompañamiento psicológico para adolescentes y adultos, de manera presencial o virtual.',
    'how_it_works', jsonb_build_array(
      jsonb_build_object('title', 'Solicitás un turno', 'text', 'Elegís modalidad, día y horario disponible desde la web o por WhatsApp.'),
      jsonb_build_object('title', 'Confirmamos juntos', 'text', 'Recibís la confirmación y un recordatorio antes de cada sesión.'),
      jsonb_build_object('title', 'Trabajamos en tu proceso', 'text', 'Entre sesiones tenés ejercicios, materiales y un espacio privado para registrar cómo te sentís.')
    )
  ), 'Textos de la página pública.', true)
on conflict (key) do nothing;

-- Categorías de materiales --------------------------------------------------
insert into public.material_categories (slug, name, sort_order) values
  ('ansiedad', 'Ansiedad', 1), ('depresion', 'Depresión', 2), ('autoestima', 'Autoestima', 3),
  ('tdah', 'TDAH', 4), ('regulacion-emocional', 'Regulación emocional', 5), ('relaciones', 'Relaciones', 6),
  ('comunicacion', 'Comunicación', 7), ('sueno', 'Sueño', 8), ('estres', 'Estrés', 9), ('habitos', 'Hábitos', 10),
  ('duelo', 'Duelo', 11), ('adicciones', 'Adicciones', 12), ('padres', 'Padres', 13),
  ('adolescentes', 'Adolescentes', 14), ('psicoeducacion', 'Psicoeducación', 15)
on conflict (slug) do nothing;

-- Planes de atención (solo precios definidos expresamente) --------------------
insert into public.therapy_plans (slug, name, short_description, price_amount, currency, duration_minutes, sessions_included, features, cta_label, cta_type, is_active, is_featured, sort_order) values
  ('consulta-individual', 'Consulta individual', 'Una sesión de 60 minutos.', 150000, 'PYG', 60, 1,
    array['Sesión individual', 'Presencial o virtual según disponibilidad'], 'Solicitar turno', 'book', true, false, 1),
  ('plan-mensual', 'Plan mensual', 'Cuatro sesiones con seguimiento del proceso.', 400000, 'PYG', 60, 4,
    array['4 sesiones', 'Seguimiento del proceso', 'Acceso a materiales de la plataforma'], 'Solicitar turno', 'book', true, true, 2),
  ('evaluacion-psicologica', 'Evaluación psicológica', 'Proceso de evaluación con informe.', null, 'PYG', null, null,
    array['Entrevistas y aplicación de instrumentos', 'Devolución e informe'], 'Consultar', 'consult', false, false, 3),
  ('evaluacion-tdah', 'Evaluación TDAH', 'Evaluación orientada a TDAH en adolescentes y adultos.', null, 'PYG', null, null,
    array['Entrevista clínica', 'Instrumentos específicos', 'Devolución'], 'Consultar', 'consult', false, false, 4),
  ('orientacion-padres', 'Orientación a padres', 'Encuentros de orientación para madres, padres y tutores.', null, 'PYG', 60, null,
    array['Encuentro de orientación', 'Pautas para el hogar'], 'Consultar', 'consult', false, false, 5),
  ('terapia-pareja', 'Terapia de pareja', 'Espacio para trabajar la relación.', null, 'PYG', null, null,
    array['Sesiones conjuntas'], 'Consultar', 'consult', false, false, 6)
on conflict (slug) do nothing;

-- Disponibilidad inicial (editable desde Configuración): lunes a viernes 14:00–20:00 -----
insert into public.availability_rules (weekday, start_time, end_time, slot_duration_minutes, buffer_minutes, modality)
select d, '14:00'::time, '20:00'::time, 60, 0, 'mixta' from generate_series(1, 5) as d;

-- Recursos de emergencia (INACTIVOS hasta que el profesional los verifique) ----------
insert into public.emergency_resources (name, description, phone, country, sort_order, is_active) values
  ('Emergencias (Policía Nacional)', 'Línea nacional de emergencias. Verificar vigencia antes de activar.', '911', 'PY', 1, false),
  ('SEME – Emergencias médicas', 'Servicio de Emergencias Médicas Extrahospitalarias. Verificar vigencia antes de activar.', '141', 'PY', 2, false),
  ('Centro de salud u hospital más cercano', 'Acudir de manera presencial ante riesgo inmediato.', null, 'PY', 3, true);

-- FAQs ----------------------------------------------------------------------
insert into public.faqs (question, answer, sort_order) values
  ('¿Cómo agendo una sesión?', 'Podés solicitar un turno desde la web eligiendo modalidad, día y horario, o escribiendo por WhatsApp. Recibirás la confirmación y un recordatorio antes de la sesión.', 1),
  ('¿Atendés de forma virtual?', 'Sí. Las sesiones pueden ser presenciales o por videollamada, según disponibilidad y lo que acordemos.', 2),
  ('¿Cuánto dura una sesión?', 'Las sesiones individuales duran 60 minutos.', 3),
  ('¿Puedo cancelar o reprogramar?', 'Sí, desde la aplicación o por WhatsApp, respetando el plazo de anticipación indicado al reservar.', 4),
  ('¿Atendés adolescentes?', 'Sí. En el caso de menores de edad se requiere el consentimiento de madre, padre o tutor.', 5),
  ('¿Qué pasa con mis datos?', 'La plataforma usa cifrado en tránsito, control de acceso por usuario y solo guarda la información necesaria para el servicio. Podés leer la política de privacidad en el sitio.', 6);

-- Plantillas de mensajes ----------------------------------------------------
insert into public.notification_templates (key, channel, title, body, variables, wa_template_name) values
  ('booking_registered', 'whatsapp', null,
   'Hola, {{first_name}}. Tu turno fue registrado para el {{date}} a las {{time}} ({{modality}}). Te vamos a recordar un día antes.',
   array['first_name', 'date', 'time', 'modality'], 'turno_registrado'),
  ('booking_requested', 'whatsapp', null,
   'Hola, {{first_name}}. Recibimos tu solicitud de turno para el {{date}} a las {{time}}. Te confirmamos a la brevedad.',
   array['first_name', 'date', 'time'], 'solicitud_recibida'),
  ('reminder_24h', 'whatsapp', null,
   'Hola, {{first_name}}. Te recordamos tu sesión con el {{professional_name}} mañana a las {{time}}. ¿Confirmás tu asistencia?',
   array['first_name', 'professional_name', 'time'], 'recordatorio_sesion_24h'),
  ('reminder_2h', 'whatsapp', null,
   'Hola, {{first_name}}. Tu sesión con el {{professional_name}} es hoy a las {{time}}. {{access_info}}',
   array['first_name', 'professional_name', 'time', 'access_info'], 'recordatorio_sesion_2h'),
  ('confirmation_thanks', 'whatsapp', null, 'Gracias. Tu turno quedó confirmado.', '{}', null),
  ('cancellation_done', 'whatsapp', null,
   'Listo, {{first_name}}. Tu turno del {{date}} a las {{time}} fue cancelado. Cuando quieras podés pedir un nuevo horario.',
   array['first_name', 'date', 'time'], 'turno_cancelado'),
  ('appointment_changed', 'whatsapp', null,
   'Hola, {{first_name}}. Hubo una modificación en tu turno con el {{professional_name}}. Nuevo horario: {{date}} a las {{time}}. ¿Podés confirmarme si te queda bien?',
   array['first_name', 'professional_name', 'date', 'time'], 'cambio_de_turno'),
  ('request_approved', 'whatsapp', null,
   'Hola, {{first_name}}. Tu solicitud fue aprobada: nos vemos el {{date}} a las {{time}} ({{modality}}).',
   array['first_name', 'date', 'time', 'modality'], 'turno_aprobado'),
  ('login_help', 'whatsapp', null,
   'Para ingresar a la aplicación entrá a {{app_url}}/login con tu email. Si no recordás tu contraseña, usá "Olvidé mi contraseña" y te llegará un enlace para crear una nueva.',
   array['app_url'], null)
on conflict (key) do nothing;

-- Intents del chatbot --------------------------------------------------------
insert into public.chatbot_intents (key, name, description, examples, keywords, requires_identified_patient, sort_order) values
  ('BOOK_APPOINTMENT', 'Agendar turno', 'La persona quiere reservar una sesión.',
   array['quiero sacar un turno', 'necesito una cita', 'puedo agendar una sesión'], array['turno', 'cita', 'agendar', 'reservar', 'sesión', 'sacar hora'], false, 1),
  ('RESCHEDULE_APPOINTMENT', 'Reprogramar turno', 'La persona quiere cambiar el horario de un turno existente.',
   array['puedo cambiar mi turno', 'necesito mover la sesión'], array['cambiar', 'mover', 'reprogramar', 'pasar para otro día', 'otro horario'], true, 2),
  ('CANCEL_APPOINTMENT', 'Cancelar turno', 'La persona quiere cancelar un turno.',
   array['quiero cancelar mi turno', 'no voy a poder ir'], array['cancelar', 'no voy a poder', 'anular', 'suspender'], true, 3),
  ('CONFIRM_APPOINTMENT', 'Confirmar asistencia', 'La persona confirma que asistirá.',
   array['confirmo', 'sí, voy', 'ahí estaré'], array['confirmo', 'confirmar', 'sí voy', 'ahí estaré', 'dale'], true, 4),
  ('CHECK_AVAILABILITY', 'Consultar disponibilidad', 'Pregunta por horarios libres.',
   array['tenés algo para el martes de tarde', 'qué horarios tenés'], array['disponible', 'horarios', 'tenés algo', 'hay lugar', 'libre'], false, 5),
  ('PRICING', 'Precios', 'Pregunta por el costo de la consulta.',
   array['cuánto sale la consulta', 'cuál es el precio'], array['precio', 'cuánto sale', 'cuánto cuesta', 'valor', 'honorarios', 'costo'], false, 6),
  ('PLANS', 'Planes', 'Pregunta por los planes de atención.',
   array['qué planes tenés', 'hay plan mensual'], array['plan', 'planes', 'paquete', 'mensual'], false, 7),
  ('LOCATION', 'Ubicación', 'Pregunta dónde queda el consultorio.',
   array['dónde atendés', 'cuál es la dirección'], array['dónde', 'dirección', 'ubicación', 'consultorio', 'queda'], false, 8),
  ('ONLINE_SESSION', 'Sesión virtual', 'Pregunta por atención online o el enlace de videollamada.',
   array['atendés online', 'me pasás el link de la videollamada'], array['online', 'virtual', 'videollamada', 'meet', 'zoom', 'link', 'enlace'], false, 9),
  ('LOGIN_HELP', 'Ayuda para ingresar', 'No puede entrar a la aplicación o recuperar la contraseña.',
   array['no puedo entrar a la app', 'olvidé mi contraseña'], array['contraseña', 'ingresar', 'entrar', 'app', 'aplicación', 'usuario', 'clave'], false, 10),
  ('SPEAK_TO_HUMAN', 'Hablar con el profesional', 'Pide hablar directamente con el psicólogo o una persona.',
   array['quiero hablar con matías', 'me puede llamar'], array['hablar con', 'persona', 'humano', 'matías', 'licenciado', 'llamar'], false, 11),
  ('OTHER', 'Otro', 'No corresponde a ninguna intención administrativa.', '{}', '{}', false, 99)
on conflict (key) do nothing;

-- Plantillas de ejercicios -----------------------------------------------------
insert into public.exercise_templates (slug, title, description, kind, approach, estimated_minutes, sort_order, steps) values
  ('respiracion-diafragmatica', 'Respiración guiada', 'Inhalá y exhalá siguiendo el círculo. Un ritmo lento ayuda al cuerpo a bajar la activación.', 'breathing', 'regulacion', 3, 1,
   '{"pattern": {"inhale": 4, "hold": 0, "exhale": 6, "hold_after": 0}, "durations": [1, 3, 5]}'::jsonb),
  ('respiracion-cuadrada', 'Respiración cuadrada', 'Cuatro tiempos iguales: inhalar, sostener, exhalar, sostener.', 'breathing', 'regulacion', 3, 2,
   '{"pattern": {"inhale": 4, "hold": 4, "exhale": 4, "hold_after": 4}, "durations": [1, 3, 5]}'::jsonb),
  ('grounding-54321', 'Grounding 5-4-3-2-1', 'Volver al presente usando los sentidos, de a un paso por vez.', 'grounding', 'regulacion', 4, 3,
   '[{"id":"see","type":"list","count":5,"prompt":"Nombrá 5 cosas que podés ver","help":"Mirá a tu alrededor con calma. Pueden ser detalles pequeños."},
     {"id":"touch","type":"list","count":4,"prompt":"Nombrá 4 cosas que podés tocar","help":"La textura de la ropa, la silla, la temperatura del aire."},
     {"id":"hear","type":"list","count":3,"prompt":"Nombrá 3 cosas que podés oír"},
     {"id":"smell","type":"list","count":2,"prompt":"Nombrá 2 cosas que podés oler"},
     {"id":"taste","type":"list","count":1,"prompt":"Nombrá 1 cosa que podés saborear"},
     {"id":"after","type":"scale","prompt":"¿Cómo te sentís ahora?","min":0,"max":10,"min_label":"Muy mal","max_label":"Muy bien"}]'::jsonb),
  ('pausa-consciente', 'Pausa consciente', 'Dos minutos para notar qué pasa en vos, sin cambiar nada todavía.', 'mindful_pause', 'regulacion', 2, 4,
   '[{"id":"intro","type":"info","title":"Pausa","content":"Vamos a detenernos dos minutos. No hace falta que te sientas distinto al terminar. Solo observar."},
     {"id":"body","type":"timed_info","seconds":40,"title":"Cuerpo","content":"Notá cómo está tu cuerpo ahora: los pies apoyados, la postura, zonas de tensión. Solo observá."},
     {"id":"breath","type":"timed_info","seconds":40,"title":"Respiración","content":"Llevá la atención a la respiración. No la cambies. Sentí el aire entrar y salir."},
     {"id":"mind","type":"timed_info","seconds":40,"title":"Mente","content":"¿Qué pensamientos y emociones están presentes? Nombralos en voz baja: “preocupación”, “cansancio”. Dejá que estén."},
     {"id":"next","type":"text","prompt":"¿Qué necesitás en los próximos minutos?","optional":true}]'::jsonb),

  ('registro-pensamientos', 'Ordenar mis pensamientos', 'Un registro cognitivo guiado, una pregunta por vez.', 'thought_record', 'tcc', 10, 10,
   '[{"id":"situation","type":"text","prompt":"¿Qué ocurrió?","help":"Describí la situación como si fuera una foto: dónde, cuándo, con quién."},
     {"id":"thought","type":"text","prompt":"¿Qué pensamiento apareció automáticamente?","help":"La primera frase que pasó por tu cabeza."},
     {"id":"emotion","type":"emotion","prompt":"¿Qué emoción sentiste?"},
     {"id":"intensity","type":"scale","prompt":"¿Qué intensidad tuvo?","min":0,"max":10,"min_label":"Nada","max_label":"Máxima","maps_to":"emotion_before"},
     {"id":"evidence_for","type":"text","prompt":"¿Qué evidencia parece apoyar ese pensamiento?","help":"Hechos, no interpretaciones."},
     {"id":"evidence_against","type":"text","prompt":"¿Qué evidencia muestra otra perspectiva?","help":"¿Hubo veces en que no fue así? ¿Qué no estás teniendo en cuenta?"},
     {"id":"friend","type":"text","prompt":"¿Qué le dirías a una persona que querés si estuviera pasando por lo mismo?"},
     {"id":"alternative","type":"text","prompt":"Creá un pensamiento alternativo","help":"Más equilibrado, no necesariamente positivo. Que puedas creerlo."},
     {"id":"intensity_after","type":"scale","prompt":"Volvé a puntuar la emoción","min":0,"max":10,"min_label":"Nada","max_label":"Máxima","maps_to":"emotion_after"}]'::jsonb),

  ('valores', 'Mis valores', 'Diferenciar objetivos de valores y elegir una dirección.', 'values', 'act', 8, 20,
   '[{"id":"intro","type":"info","title":"Objetivos y valores","content":"Un objetivo se alcanza y se tacha (“aprobar el examen”). Un valor es una dirección que elegís una y otra vez (“ser alguien que aprende con curiosidad”). Los valores no se terminan: se viven."},
     {"id":"area","type":"choice","prompt":"¿Qué área querés mirar hoy?","options":["Familia","Pareja","Amistades","Estudio","Trabajo","Salud","Crecimiento personal"]},
     {"id":"person","type":"text","prompt":"¿Qué tipo de persona querés ser en esta área?","help":"Pensá en cualidades, no en resultados: presente, honesto, paciente, valiente…"},
     {"id":"goal_vs_value","type":"text","prompt":"¿Qué objetivo concreto se relaciona con ese valor?","help":"Algo que se pueda tachar de una lista."},
     {"id":"obstacle","type":"text","prompt":"¿Qué suele interponerse entre vos y ese valor?","optional":true}]'::jsonb),

  ('accion-comprometida', 'Acción comprometida', 'Una pequeña acción esta semana en dirección a lo que te importa.', 'committed_action', 'act', 5, 21,
   '[{"id":"value","type":"text","prompt":"¿Qué valor querés honrar esta semana?","help":"Por ejemplo: cuidar mis vínculos, cuidar mi salud, aprender."},
     {"id":"action","type":"text","prompt":"¿Qué pequeña acción podrías realizar esta semana que vaya en dirección a ese valor?","help":"Tan pequeña que sea casi imposible no hacerla."},
     {"id":"when","type":"text","prompt":"¿Cuándo y dónde la vas a hacer?"},
     {"id":"barrier","type":"text","prompt":"Si aparece una dificultad, ¿qué vas a hacer?","optional":true},
     {"id":"willing","type":"scale","prompt":"¿Qué tan dispuesto/a estás a hacerla aunque aparezcan pensamientos o emociones incómodas?","min":0,"max":10,"min_label":"Nada","max_label":"Totalmente"}]'::jsonb),

  ('defusion', 'Tomar distancia de un pensamiento', 'Notar un pensamiento como lo que es: un pensamiento.', 'defusion', 'act', 4, 22,
   '[{"id":"thought","type":"text","prompt":"Escribí un pensamiento que te esté molestando","help":"Tal cual aparece en tu cabeza. Por ejemplo: “Soy un fracaso”."},
     {"id":"reframe1","type":"reflect","title":"Primer paso","template":"Estoy teniendo el pensamiento de que {{thought}}.","content":"Leelo despacio. ¿Cambia algo la distancia?"},
     {"id":"reframe2","type":"reflect","title":"Segundo paso","template":"Noto que estoy teniendo el pensamiento de que {{thought}}.","content":"No se trata de discutir con el pensamiento ni de convencerte de lo contrario. Solo de verlo pasar."},
     {"id":"workability","type":"choice","prompt":"Si le hacés caso a ese pensamiento, ¿te acerca o te aleja de lo que te importa?","options":["Me acerca","Me aleja","No estoy seguro/a"]},
     {"id":"after","type":"scale","prompt":"¿Cuánto te enganchás con ese pensamiento ahora?","min":0,"max":10,"min_label":"Nada","max_label":"Totalmente"}]'::jsonb),

  ('dbt-stop', 'STOP', 'Una habilidad para frenar antes de actuar por impulso.', 'dbt_skill', 'dbt', 3, 30,
   '[{"id":"s","type":"info","title":"S — Frená","content":"No hagas nada todavía. Quedate quieto/a un segundo. Las emociones pueden empujarte a actuar antes de pensar."},
     {"id":"t","type":"info","title":"T — Tomá distancia","content":"Respirá una vez, lento. Si podés, alejate físicamente un paso de la situación."},
     {"id":"o","type":"info","title":"O — Observá","content":"¿Qué está pasando afuera? ¿Qué está pasando adentro (cuerpo, emociones, pensamientos)? Solo mirá."},
     {"id":"p","type":"info","title":"P — Procedé con cuidado","content":"Preguntate: ¿qué quiero que pase después de esto? Elegí la acción que te acerque a eso."},
     {"id":"situation","type":"text","prompt":"¿En qué situación te gustaría usar STOP esta semana?","optional":true}]'::jsonb),

  ('dbt-accion-opuesta', 'Actuar de manera opuesta', 'Cuando una emoción no encaja con los hechos o no ayuda, hacer lo contrario de lo que pide.', 'dbt_skill', 'dbt', 6, 31,
   '[{"id":"emotion","type":"emotion","prompt":"¿Qué emoción estás sintiendo?"},
     {"id":"urge","type":"text","prompt":"¿Qué te empuja a hacer esa emoción?","help":"Por ejemplo: aislarme, gritar, evitar, no responder."},
     {"id":"fits","type":"choice","prompt":"¿La emoción encaja con los hechos y actuar así te ayuda?","options":["Sí, encaja y ayuda","No encaja con los hechos","Encaja, pero actuar así no me ayuda"]},
     {"id":"opposite","type":"text","prompt":"¿Cuál sería la acción opuesta?","help":"Si el miedo pide evitar, acercarse de a poco. Si la tristeza pide aislarse, hacer una actividad y contactar a alguien. Si el enojo pide atacar, alejarse amablemente."},
     {"id":"plan","type":"text","prompt":"¿Cómo la harías, con todo el cuerpo (postura, tono de voz, expresión)?","optional":true}]'::jsonb),

  ('dbt-tolerar-malestar', 'Tolerar el malestar (TIPP)', 'Herramientas rápidas para bajar la intensidad cuando la emoción es muy alta.', 'dbt_skill', 'dbt', 4, 32,
   '[{"id":"intro","type":"info","title":"Para momentos muy intensos","content":"Estas herramientas no resuelven el problema. Sirven para pasar el pico de la emoción sin hacer algo que después lamentes."},
     {"id":"t","type":"info","title":"Temperatura","content":"Mojate la cara con agua fría o sostené algo frío unos segundos. Ayuda al cuerpo a bajar la activación."},
     {"id":"i","type":"info","title":"Intensidad física","content":"Movete fuerte un rato corto: subir escaleras, saltar, caminar rápido."},
     {"id":"p","type":"info","title":"Respiración pausada","content":"Exhalá más largo de lo que inhalás. Podés usar el ejercicio de respiración de la app."},
     {"id":"pp","type":"info","title":"Relajación muscular","content":"Tensá un grupo de músculos cinco segundos y soltá. Recorré el cuerpo de a partes."},
     {"id":"choice","type":"choice","prompt":"¿Cuál de estas podrías usar la próxima vez?","options":["Temperatura","Intensidad física","Respiración pausada","Relajación muscular"]}]'::jsonb),

  ('dbt-identificar-impulsos', 'Identificar impulsos', 'Notar el impulso antes de que se convierta en acción.', 'dbt_skill', 'dbt', 5, 33,
   '[{"id":"situation","type":"text","prompt":"¿Qué estaba pasando cuando apareció el impulso?"},
     {"id":"urge","type":"text","prompt":"¿Qué impulso apareció?","help":"Qué tuviste ganas de hacer."},
     {"id":"strength","type":"scale","prompt":"¿Qué tan fuerte fue?","min":0,"max":10,"min_label":"Débil","max_label":"Muy fuerte"},
     {"id":"body","type":"text","prompt":"¿Dónde lo sentiste en el cuerpo?","optional":true},
     {"id":"acted","type":"choice","prompt":"¿Actuaste según el impulso?","options":["Sí","No","En parte"]},
     {"id":"alternative","type":"text","prompt":"¿Qué otra cosa podrías hacer la próxima vez mientras el impulso pasa?","help":"Los impulsos suben y bajan como una ola. Suelen durar menos de lo que parece."}]'::jsonb),

  ('dbt-mindfulness', 'Observar y describir', 'Dos habilidades básicas de atención plena.', 'dbt_skill', 'dbt', 4, 34,
   '[{"id":"intro","type":"info","title":"Observar y describir","content":"Observar es notar lo que pasa sin reaccionar. Describir es ponerle palabras a lo que observás, sin juicios: “tensión en el pecho”, no “esto es terrible”."},
     {"id":"observe","type":"timed_info","seconds":45,"title":"Observá","content":"Durante unos segundos, notá sensaciones, sonidos y pensamientos. Cuando te distraigas, volvé. Eso también es practicar."},
     {"id":"describe","type":"text","prompt":"Describí lo que observaste, solo con hechos","help":"Ejemplo: “ruido de autos, hombros tensos, pensamiento sobre mañana”."},
     {"id":"judgment","type":"text","prompt":"¿Apareció algún juicio? Reescribilo como una descripción","optional":true}]'::jsonb),

  ('dbt-comunicacion', 'Pedir algo con claridad (DEAR MAN)', 'Una guía simple para pedir lo que necesitás o decir que no.', 'dbt_skill', 'dbt', 8, 35,
   '[{"id":"goal","type":"text","prompt":"¿Qué querés pedir o decir?"},
     {"id":"describe","type":"text","prompt":"Describí la situación con hechos","help":"Sin interpretar ni acusar. “Ayer quedamos a las 8 y llegaste a las 9.”"},
     {"id":"express","type":"text","prompt":"Expresá cómo te hace sentir","help":"Usá “me siento…” en lugar de “vos sos…”."},
     {"id":"assert","type":"text","prompt":"Pedí lo que necesitás, de forma concreta","help":"“Me gustaría que me avises si vas a llegar tarde.”"},
     {"id":"reinforce","type":"text","prompt":"¿Qué gana la otra persona si acepta?","optional":true},
     {"id":"mindful","type":"info","title":"Al conversar","content":"Mantené el foco en tu pedido aunque la otra persona cambie de tema. Hablá con tono calmo y seguro. Estar dispuesto/a a negociar no es ceder en lo importante."}]'::jsonb),

  ('dbt-regulacion', 'Cuidar las bases (PLEASE)', 'Las emociones se desregulan más fácil cuando el cuerpo está descuidado.', 'dbt_skill', 'dbt', 4, 36,
   '[{"id":"intro","type":"info","title":"Las bases","content":"Dormir, comer, moverse y evitar sustancias no arreglan todo, pero cuando fallan, cualquier emoción se siente más grande."},
     {"id":"sleep","type":"scale","prompt":"Sueño: ¿cómo estuviste durmiendo esta semana?","min":0,"max":10,"min_label":"Muy mal","max_label":"Muy bien"},
     {"id":"food","type":"scale","prompt":"Alimentación: ¿comiste de forma regular?","min":0,"max":10,"min_label":"Nada regular","max_label":"Muy regular"},
     {"id":"move","type":"scale","prompt":"Movimiento: ¿te moviste o hiciste actividad física?","min":0,"max":10,"min_label":"Nada","max_label":"Mucho"},
     {"id":"substances","type":"choice","prompt":"¿Usaste alcohol u otras sustancias para manejar emociones?","options":["No","Alguna vez","Varias veces"]},
     {"id":"one_thing","type":"text","prompt":"¿Qué base podrías cuidar un poco más esta semana?"}]'::jsonb)
on conflict (slug) do nothing;

-- >>> supabase/migrations/20261009000001_brand_identity.sql

-- =============================================================================
-- Identidad visual del Lic. Matías Sánchez: paleta petróleo + verde menta,
-- título del inicio y áreas de trabajo.
-- Solo reemplaza valores que siguen siendo los predeterminados anteriores: lo que
-- ya se personalizó desde Administración › Configuración no se toca.
-- =============================================================================

update public.settings
set value = jsonb_build_object('primary', '#2f6468', 'accent', '#27b088', 'background', '#fbfdfc'),
    updated_at = now()
where key = 'theme'
  and lower(value->>'primary') = '#1f4e5f'
  and lower(value->>'accent') = '#a8dccb'
  and lower(value->>'background') = '#faf8f5';

-- Áreas de trabajo y enfoque diferencial: se agregan solo si todavía no existen
-- (en "nuevo || actual" ganan las claves que ya estaban guardadas).
update public.settings
set value = jsonb_build_object(
      'specialties_title', 'Terapia basada en neurociencia aplicada',
      'specialties', jsonb_build_array(
        jsonb_build_object('title', 'Trastornos de ansiedad', 'text', 'Ansiedad generalizada, pánico, fobias y ansiedad social.'),
        jsonb_build_object('title', 'Depresión', 'text', 'Depresión mayor, distimia y episodios del estado de ánimo.'),
        jsonb_build_object('title', 'Estrés y burnout', 'text', 'Estrés crónico, agotamiento laboral e insomnio.'),
        jsonb_build_object('title', 'Trauma y duelo', 'text', 'Estrés postraumático, duelos y procesos de cambio vital.')
      ),
      'approach_label', 'Enfoque diferencial',
      'approach_text', 'Integración de psicoterapia clínica y neurociencia aplicada, con intervenciones respaldadas por evidencia actualizada.'
    ) || value,
    updated_at = now()
where key = 'landing'
  and not (value ? 'specialties');

-- Título y bajada nuevos, solo si seguían los textos originales de la plataforma.
-- Las palabras entre asteriscos se destacan en cursiva y en el color de acento.
update public.settings
set value = value || jsonb_build_object(
      'hero_title', 'Terapia desde *donde estés*, con el rigor de una consulta clínica.',
      'hero_subtitle', 'Acompañamiento psicológico profesional en modalidad virtual, con el mismo marco clínico, ético y basado en evidencia que en consultorio.'
    ),
    updated_at = now()
where key = 'landing'
  and value->>'hero_title' = 'Un espacio para comprender lo que te pasa y trabajar en lo que necesitás.'
  and value->>'hero_subtitle' = 'Acompañamiento psicológico para adolescentes y adultos, de manera presencial o virtual.';

-- >>> supabase/migrations/20261009000002_exercise_audience.sql

-- =============================================================================
-- Público y colección de cada ejercicio.
-- audience: a quién se le ofrece en la lista del paciente (los asignados se ven siempre).
--   todos · adolescentes (13 a 18 años) · adultos
-- collection: cuadernillo al que pertenece, para mostrarlo como un recorrido en orden
--   ('brujula' = cuadernillo para adolescentes, 'tcc' = Cuadernillo de TCC).
-- =============================================================================

alter table public.exercise_templates
  add column audience text not null default 'todos',
  add column collection text;

alter table public.exercise_templates
  add constraint exercise_templates_audience_check check (audience in ('todos', 'adolescentes', 'adultos'));

create index exercise_templates_collection_idx on public.exercise_templates (collection, sort_order);

comment on column public.exercise_templates.audience is 'todos | adolescentes | adultos. Filtra la lista del paciente según su edad; lo asignado se ve siempre.';
comment on column public.exercise_templates.collection is 'Cuadernillo al que pertenece (brujula, tcc); null = ejercicio suelto.';

-- >>> supabase/migrations/20261009000003_cuadernillos.sql

-- =============================================================================
-- Ejercicios y materiales de los cuadernillos del Lic. Matías Sánchez
-- (Brújula · Cuadernillo de TCC).
--
-- Archivo generado con `pnpm db:contenido` a partir de supabase/content/ejercicios/*.json.
-- No lo edites a mano: cambiá los JSON y volvé a generarlo.
-- Solo agrega lo que falta: no pisa ejercicios ni materiales editados desde el panel.
-- =============================================================================

insert into public.exercise_templates (slug, title, description, kind, approach, audience, collection, estimated_minutes, sort_order, steps) values
  ('brujula-punto-de-partida', 'Mi punto de partida', 'Mirá desde dónde arrancás y elegí lo que hoy pesa más. No es un test ni un diagnóstico.', 'custom', 'general', 'adolescentes', 'brujula', 8, 101,
   $steps$[ { "id": "bienvenida", "type": "info", "title": "Este cuadernillo es tuyo", "content": "Lo vamos a usar entre sesión y sesión, de a poco. No hay respuestas correctas ni incorrectas, no se ponen notas y podés escribir como te salga. Cada tarea lleva entre 5 y 15 minutos. Si un ejercicio no tiene que ver con lo que te pasa, lo salteamos. Traé a cada sesión lo que anotes: nos ayuda a ver qué te sirve.\n\n**Cómo vamos a trabajar:** Entender → Observar → Practicar → Probar → Repetir." }, { "id": "momento_dificil", "type": "info", "title": "Si estás pasando un momento muy difícil", "content": "Andá directo a «Mi plan para momentos muy difíciles». Lo encontrás en **Calmarme**.\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En **Calmarme** está el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "privacidad", "type": "info", "title": "Lo que escribís es tuyo", "content": "Vos elegís qué compartir y qué no. No hace falta contar nada que no quieras.\n\nCuando tocás «Terminar», tus respuestas quedan guardadas en «Mis respuestas». Tu psicólogo/a las puede leer si está activado **«Compartir mis registros con mi psicólogo»** en tu perfil (viene activado). Si lo desactivás, ve si hiciste los ejercicios que te sugirió, pero no lo que escribiste.\n\n**Hay un límite:** si aparece algo que pone en riesgo tu seguridad o la de otra persona, tu psicólogo o psicóloga va a buscar ayuda con un adulto responsable o con un servicio de protección. Siempre que se pueda, lo va a hablar antes con vos.\n\nSi te preocupa que alguien lea lo que escribís (por ejemplo, si compartís el celular), acordá con tu psicólogo/a cómo cuidarlo." }, { "id": "como_me_dicen", "type": "text", "prompt": "¿Cómo me gusta que me digan?", "help": "Tu nombre, un apodo o como prefieras que te llamen.", "placeholder": "Por ejemplo: Cami, Tobi…", "optional": true }, { "id": "punto_intro", "type": "info", "title": "Mi punto de partida", "content": "**No hace falta trabajar todo. Elegí lo que hoy pesa más.**\n\nEsto sirve para saber desde dónde arrancás. No es un test ni un diagnóstico. Podés dejar en blanco lo que no quieras contestar.\n\nEste cuadernillo acompaña tu tratamiento psicológico y no reemplaza una evaluación profesional." }, { "id": "me_pasa", "type": "checklist", "prompt": "¿Qué me pasa o me preocupa?", "help": "Marcá las que quieras.", "optional": true, "options": [ "Discusiones o tensión en casa", "Me siento solo/a o fuera del grupo", "Burlas, bullying o cyberbullying", "Nervios o ansiedad", "Tristeza o desgano", "El colegio", "POD, vape o cigarrillo", "Enojo que explota", "Me cuesta decir lo que necesito", "Me cuesta pedir ayuda", "Cómo me veo a mí mismo/a", "Otra" ] }, { "id": "me_pasa_otra", "type": "text", "prompt": "Si marcaste «Otra»: ¿qué otra cosa te pasa o te preocupa?", "help": "Si no marcaste «Otra», salteá esta pregunta.", "optional": true }, { "id": "diferente", "type": "text", "prompt": "¿Qué me gustaría que fuera diferente dentro de 2 o 3 meses?", "help": "**Una idea:** un buen objetivo se puede ver desde afuera. En vez de «estar bien», Lucas escribió: «volver a entrenar una vez por semana».", "placeholder": "Algo que se pueda ver desde afuera…", "optional": true }, { "id": "tres_cosas", "type": "list", "prompt": "Las 3 cosas que quiero trabajar", "help": "No hace falta trabajar todo: elegí lo que hoy pesa más.", "count": 3, "min": 1, "optional": true }, { "id": "hoy_animo", "type": "scale", "prompt": "¿Cómo estoy hoy de ánimo?", "help": "Ahora, siete preguntas rápidas sobre cómo estás hoy. Elegí un número: 0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "hoy_nervios", "type": "scale", "prompt": "¿Cómo estoy hoy con los nervios o la ansiedad?", "help": "Acá el 0 es «me desbordan» y el 10 es «los manejo bien».", "min": 0, "max": 10, "min_label": "Me desbordan", "max_label": "Los manejo bien", "optional": true }, { "id": "hoy_relaciones", "type": "scale", "prompt": "¿Cómo estoy hoy en mis relaciones?", "help": "Amigos, compañeros. 0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "hoy_familia", "type": "scale", "prompt": "¿Cómo estoy hoy con mi familia?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "hoy_colegio", "type": "scale", "prompt": "¿Cómo estoy hoy en el colegio?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "hoy_confianza", "type": "scale", "prompt": "¿Cómo estoy hoy con la confianza en mí?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "hoy_emociones", "type": "scale", "prompt": "¿Cómo estoy hoy con el manejo de mis emociones?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Desde acá arranco", "template": "Lo que hoy me pasa o me preocupa: {{me_pasa}}. Lo que me gustaría que fuera diferente dentro de 2 o 3 meses: «{{diferente}}». Lo que quiero trabajar: {{tres_cosas}}", "content": "Cuando toques «Terminar», lo vas a poder volver a ver cuando quieras en este ejercicio, en «Mis respuestas»." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 5 minutos.** Observá una situación que te movió algo por dentro y anotá:\n\n- ¿Qué pasó?\n- ¿Qué sentiste?\n- ¿Cuánto? (de 0 a 10)\n\nSi querés, lo podés anotar en **«Registrar cómo me siento»**. Después seguimos con «Entender lo que me pasa»." } ]$steps$::jsonb),
  ('brujula-entender-lo-que-me-pasa', 'Entender lo que me pasa', 'Descubrí tu cadena: situación, pensamiento, emoción, cuerpo, conducta y consecuencia.', 'thought_record', 'tcc', 'adolescentes', 'brujula', 8, 102,
   $steps$[ { "id": "cadena", "type": "info", "title": "Lo que te pasa no viene solo: es una cadena", "content": "No reaccionamos solo a lo que pasa, sino también a lo que pensamos sobre lo que pasa. Ese pensamiento mueve una emoción, la emoción se siente en el cuerpo y nos empuja a hacer algo. Y lo que hacemos tiene consecuencias.\n\n**Situación → Pensamiento → Emoción → Cuerpo → Conducta → Consecuencia**\n\nSi conocés tu cadena, podés cortarla en algún eslabón." }, { "id": "ejemplo_cami", "type": "info", "title": "Así le pasó a Cami (13 años)", "content": "- **Situación** (lo que vería una cámara): le escribió a una amiga y hace 3 horas que no le contesta.\n- **Pensamiento** (lo que se le cruzó por la cabeza): «Está enojada conmigo».\n- **Emoción** (qué sintió y cuánto, de 0 a 10): tristeza y nervios, 7.\n- **Cuerpo** (dónde lo sintió): nudo en el estómago.\n- **Conducta** (qué hizo): revisa el celular a cada rato. Al otro día no le habla.\n- **Consecuencia** (qué pasó después): se alejan un poco más y Cami se siente peor." }, { "id": "situacion", "type": "text", "prompt": "Situación: ¿qué pasó?", "help": "Ahora probalo con algo que te pasó esta semana. Escribí lo que vería una cámara.\n\nAsí le pasó a Cami: le escribió a una amiga y hace 3 horas que no le contesta.", "placeholder": "Qué pasó, dónde, con quién…" }, { "id": "pensamiento", "type": "text", "prompt": "Pensamiento: ¿qué se te cruzó por la cabeza?", "help": "Escribilo tal cual apareció.\n\nCami pensó: «Está enojada conmigo»." }, { "id": "emocion", "type": "checklist", "prompt": "Emoción: ¿qué sentiste?", "help": "Elegí hasta 3 palabras.\n\nCami sintió tristeza y nervios.", "options": [ "Bronca", "Tristeza", "Miedo", "Vergüenza", "Culpa", "Nervios", "Soledad", "Frustración", "Celos", "Alegría", "Calma", "Orgullo" ], "max": 3 }, { "id": "intensidad", "type": "scale", "prompt": "¿Cuánto lo sentiste?", "help": "De 0 a 10. Si marcaste más de una, puntuá la más fuerte. Cami: 7.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimo", "maps_to": "emotion_before" }, { "id": "cuerpo", "type": "checklist", "prompt": "Cuerpo: ¿dónde lo sentiste?", "help": "Marcá las señales que notaste.\n\nCami lo sintió como un nudo en el estómago.", "options": [ "Corazón rápido", "Nudo en la garganta", "Panza revuelta", "Calor en la cara", "Hombros tensos", "Ganas de llorar", "Cansancio", "Otra señal" ] }, { "id": "cuerpo_otra", "type": "text", "prompt": "¿Querés contar dónde y cómo lo sentiste?", "help": "Sobre todo si marcaste «Otra señal».", "placeholder": "Por ejemplo: nudo en el estómago.", "optional": true }, { "id": "conducta", "type": "text", "prompt": "Conducta: ¿qué hiciste?", "help": "Cami revisa el celular a cada rato. Al otro día no le habla." }, { "id": "consecuencia", "type": "text", "prompt": "Consecuencia: ¿qué pasó después?", "help": "En el caso de Cami: se alejan un poco más y ella se siente peor." }, { "id": "mi_cadena", "type": "reflect", "title": "Tu cadena", "template": "Situación: {{situacion}} → Pensamiento: «{{pensamiento}}» → Emoción: {{emocion}} → Cuerpo: {{cuerpo}} → Conducta: {{conducta}} → Consecuencia: {{consecuencia}}", "content": "Mirala entera, eslabón por eslabón. Si conocés tu cadena, podés cortarla en algún eslabón." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 10 minutos.** Anotá 3 momentos en un registro rápido. De cada uno:\n\n- Situación\n- Pensamiento\n- Emoción (de 0 a 10)\n- Qué hice\n\nPara anotarlos rápido podés usar **«Registrar cómo me siento»**, que pregunta justo eso. También podés volver a hacer este ejercicio con cada momento. Esos momentos los vas a usar en «Mi detector de pensamientos»." } ]$steps$::jsonb),
  ('brujula-detector-de-pensamientos', 'Mi detector de pensamientos', 'Separá hechos de pensamientos y reconocé ocho trampas frecuentes de la mente.', 'custom', 'tcc', 'adolescentes', 'brujula', 9, 103,
   $steps$[ { "id": "intro", "type": "info", "title": "Tu mente cuenta historias", "content": "Algunas son ciertas y otras, no tanto.\n\nLos pensamientos automáticos aparecen solos, rápido, y suenan a verdad. Para cazarlos, preguntate: **«¿Qué se me pasó por la cabeza justo antes?»**" }, { "id": "camara", "type": "info", "title": "La prueba de la cámara", "content": "Si una cámara lo podría grabar, es un **hecho**. Si no, es un **pensamiento**: una forma de interpretar lo que pasó.\n\n- Hecho: «Mi amiga no me saludó».\n- Pensamiento: «Está enojada conmigo».\n\n**Ojo:** que algo sea un pensamiento no quiere decir que sea falso. Y si alguien te trata mal, eso es un hecho, no un invento de tu mente." }, { "id": "quiz_1", "type": "choice", "prompt": "¿Hecho o pensamiento? «Desaprobé Matemática»", "help": "Usá la prueba de la cámara. Frase 1 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**¡Bien! Es un hecho.** Una cámara lo podría grabar: la nota está en la prueba.", "Pensamiento": "**Es un hecho.** Una cámara lo podría grabar: la nota está en la prueba. Lo que pienses después sobre esa nota ya sería un pensamiento." } }, { "id": "quiz_2", "type": "choice", "prompt": "¿Hecho o pensamiento? «Soy un burro»", "help": "Frase 2 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**Es un pensamiento.** Ninguna cámara puede grabar que alguien «es un burro». Lo que se puede grabar es, por ejemplo, una nota; «soy un burro» es una forma de interpretarla.", "Pensamiento": "**¡Bien! Es un pensamiento.** Ninguna cámara puede grabar que alguien «es un burro»: es una forma de interpretar lo que pasó." } }, { "id": "quiz_3", "type": "choice", "prompt": "¿Hecho o pensamiento? «Subieron una foto mía sin permiso»", "help": "Frase 3 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**¡Bien! Es un hecho.** Una cámara lo podría grabar: la foto está subida.\n\nSi alguien te trata mal, eso es un hecho, no un invento de tu mente, y no es tu culpa. De esto hablamos en «Cuando otros me hacen sentir menos».", "Pensamiento": "**Es un hecho.** Una cámara lo podría grabar: la foto está subida.\n\nSi alguien te trata mal, eso es un hecho, no un invento de tu mente, y no es tu culpa. De esto hablamos en «Cuando otros me hacen sentir menos»." } }, { "id": "quiz_4", "type": "choice", "prompt": "¿Hecho o pensamiento? «Nadie me va a querer nunca»", "help": "Frase 4 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**Es un pensamiento.** Ninguna cámara puede grabar el futuro. Suena a verdad, pero es una historia que cuenta tu mente.", "Pensamiento": "**¡Bien! Es un pensamiento.** Ninguna cámara puede grabar el futuro. Aunque suene a verdad, es una historia que cuenta tu mente." } }, { "id": "quiz_5", "type": "choice", "prompt": "¿Hecho o pensamiento? «La profe me pidió que me quede después de clase»", "help": "Frase 5 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**¡Bien! Es un hecho.** Una cámara lo podría grabar: la profe lo dijo. Lo que imagines sobre para qué te lo pidió ya sería un pensamiento.", "Pensamiento": "**Es un hecho.** Una cámara lo podría grabar: la profe lo dijo. Lo que imagines sobre para qué te lo pidió ya sería un pensamiento (mirá la frase que sigue)." } }, { "id": "quiz_6", "type": "choice", "prompt": "¿Hecho o pensamiento? «Me van a retar»", "help": "Frase 6 de 6.", "options": [ "Hecho", "Pensamiento" ], "feedback": { "Hecho": "**Es un pensamiento.** Es lo que tu mente imagina que va a pasar después de que la profe te pidió que te quedes. Ninguna cámara lo puede grabar todavía: puede pasar o no.", "Pensamiento": "**¡Bien! Es un pensamiento.** Es lo que tu mente imagina que va a pasar después de que la profe te pidió que te quedes. Ninguna cámara lo puede grabar todavía: puede pasar o no." } }, { "id": "trampas_1", "type": "info", "title": "Ocho trampas frecuentes de la mente (1 de 3)", "content": "Fijate si alguna te suena.\n\n**1. Todo o nada.** Si no es perfecto, es un desastre.\n«No me saqué 5: soy un desastre».\n\n**2. Leer la mente.** Creés saber lo que piensa el otro.\n«Papá llegó callado. Seguro está enojado conmigo».\n\n**3. Película de terror.** Imaginás lo peor como si ya hubiera pasado.\n«Si me va mal en la prueba, se me arruina el año»." }, { "id": "trampas_2", "type": "info", "title": "Ocho trampas frecuentes de la mente (2 de 3)", "content": "**4. Ponerse etiquetas.** Un error se vuelve lo que sos.\n«Soy un fracasado».\n\n**5. Siempre o nunca.** Una vez se vuelve todas las veces.\n«Nunca me sale nada bien».\n\n**6. Lente oscuro.** Solo ves lo malo.\n«Me dijeron cinco cosas buenas y una mala. Solo pienso en la mala»." }, { "id": "trampas_3", "type": "info", "title": "Ocho trampas frecuentes de la mente (3 de 3)", "content": "**7. Bola de cristal.** Das por seguro el futuro.\n«En el colegio nuevo no voy a tener amigos».\n\n**8. Lo siento, entonces es así.** Confundís lo que sentís con lo que pasó.\n«Me dio vergüenza, así que hice el ridículo»." }, { "id": "caigo_mas", "type": "checklist", "prompt": "¿En cuáles caigo más?", "help": "Marcá las tuyas.", "options": [ "Todo o nada", "Leer la mente", "Película de terror", "Ponerse etiquetas", "Siempre o nunca", "Lente oscuro", "Bola de cristal", "Lo siento, entonces es así" ] }, { "id": "la_que_mas", "type": "choice", "prompt": "¿Cuál es la que más me pasa?", "options": [ "Todo o nada", "Leer la mente", "Película de terror", "Ponerse etiquetas", "Siempre o nunca", "Lente oscuro", "Bola de cristal", "Lo siento, entonces es así" ] }, { "id": "historia_intro", "type": "info", "title": "¿Qué historia me contó mi mente?", "content": "Ahora elegí un momento tuyo. Puede ser uno que anotaste esta semana (con «Registrar cómo me siento» o en «Entender lo que me pasa») o algo que te pasó hace poco.\n\nVas a separar lo que pasó de la historia que te contó tu mente." }, { "id": "camara_vio", "type": "text", "prompt": "Lo que pasó: ¿qué vería una cámara?", "help": "Solo lo que se podría grabar. Por ejemplo: «Mi amiga no me saludó»." }, { "id": "historia", "type": "text", "prompt": "¿Qué historia me contó mi mente?", "help": "Por ejemplo: «Está enojada conmigo»." }, { "id": "trampa", "type": "choice", "prompt": "¿En qué trampa caí?", "help": "Si caíste en más de una, elegí la que más se nota.", "options": [ "Todo o nada (si no es perfecto, es un desastre)", "Leer la mente (creés saber lo que piensa el otro)", "Película de terror (imaginás lo peor como si ya hubiera pasado)", "Ponerse etiquetas (un error se vuelve lo que sos)", "Siempre o nunca (una vez se vuelve todas las veces)", "Lente oscuro (solo ves lo malo)", "Bola de cristal (das por seguro el futuro)", "Lo siento, entonces es así (confundís lo que sentís con lo que pasó)", "No estoy seguro/a" ] }, { "id": "cuanto_creo", "type": "scale", "prompt": "¿Cuánto me creo esa historia?", "help": "De 0 a 100 %.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "resumen", "type": "reflect", "title": "Lo que pasó y la historia", "template": "Una cámara vería: «{{camara_vio}}». Mi mente me contó: «{{historia}}». Trampa: {{trampa}}. En general caigo en: {{caigo_mas}}. La que más me pasa: {{la_que_mas}}.", "content": "Que algo sea un pensamiento no quiere decir que sea falso. Lo que sigue es ponerlo a prueba." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "La tarea de esta semana está en el próximo ejercicio, **«Poner a prueba lo que pienso»** (10 a 15 minutos): vas a tomar un pensamiento que te haya pesado y ponerlo a prueba como un detective. Puede ser la historia que anotaste hoy.\n\nSi querés, antes repetí este ejercicio con otros momentos de tu registro." } ]$steps$::jsonb),
  ('brujula-poner-a-prueba', 'Poner a prueba lo que pienso', 'Revisá un pensamiento como un detective: datos a favor, en contra y una forma más justa de verlo.', 'thought_record', 'tcc', 'adolescentes', 'brujula', 12, 104,
   $steps$[ { "id": "intro", "type": "info", "title": "Pensar más completo", "content": "**No se trata de pensar lindo, sino de pensar más completo.**\n\nUn pensamiento no es verdad solo porque se siente fuerte. Ponelo a prueba como haría un detective: juntá datos a favor y en contra, y buscá una forma de verlo más realista.\n\nNo hace falta que sea positiva: alcanza con que sea más justa." }, { "id": "detective", "type": "info", "title": "Preguntas de detective", "content": "Estas preguntas te van a ayudar en cada paso:\n\n- ¿Qué pruebas tengo de que es así?\n- ¿Hay algo que no encaja?\n- ¿Hay otra explicación posible?\n- ¿Qué es lo peor, lo mejor y lo más probable?\n- ¿Qué le diría a alguien que quiero?\n- ¿Pensar así me ayuda con lo que quiero?" }, { "id": "lucas_1", "type": "info", "title": "Así lo hizo Lucas (15 años)", "content": "- **Situación:** desaprobó Matemática. Fue el día después de una pelea fuerte en casa.\n- **Pensamiento:** «Soy un burro, no sirvo para estudiar.»\n- **¿Cuánto lo creo?** 85 %.\n- **Emoción:** tristeza, 8 de 10.\n- **Lo que apoya el pensamiento:** «Desaprobé este examen.»\n- **Lo que no encaja:** «Aprobé Lengua y Sociales. Esa noche casi no dormí. Nunca pedí ayuda en Matemática.»" }, { "id": "lucas_2", "type": "info", "title": "Lucas sigue", "content": "- **Otra forma de verlo:** «Me fue mal en un día muy difícil, y Matemática me cuesta.»\n- **¿Qué le diría a alguien que quiero?** «Un examen no dice cuánto valés.»\n- **Pensamiento nuevo:** «Me fue mal en este examen y todavía no pedí ayuda. Puedo pedirla.»\n- **¿Cuánto creo ahora el pensamiento del principio?** 40 %.\n- **¿Cómo me siento ahora?** Tristeza, 5 de 10." }, { "id": "mi_turno", "type": "info", "title": "Mi turno", "content": "Ahora te toca a vos. Elegí un pensamiento que te haya pesado y seguí los mismos pasos que Lucas, una pregunta por vez.\n\n**Ojo:** esta hoja es para pensamientos, no para discutir si te trataron mal. Si alguien te lastimó o te hizo sentir menos, eso no se «corrige»: se cuenta. Para eso están «Cuando otros me hacen sentir menos» y «Mi red de apoyo»." }, { "id": "situation", "type": "text", "prompt": "Situación: ¿qué pasó?", "help": "Contalo con pocas palabras: qué pasó, cuándo, con quién.\n\nAsí lo hizo Lucas: desaprobó Matemática. Fue el día después de una pelea fuerte en casa." }, { "id": "thought", "type": "text", "prompt": "Pensamiento: ¿qué pensaste?", "help": "La frase que apareció en tu cabeza, tal cual.\n\nAsí lo hizo Lucas: «Soy un burro, no sirvo para estudiar.»" }, { "id": "belief_before", "type": "scale", "prompt": "¿Cuánto lo creés? (de 0 a 100 %)", "help": "Lucas: 85 %.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "emotion", "type": "checklist", "prompt": "Emoción: ¿qué sentiste?", "help": "Elegí hasta 3 palabras. Lucas sintió tristeza.", "options": [ "Bronca", "Tristeza", "Miedo", "Vergüenza", "Culpa", "Nervios", "Soledad", "Frustración", "Celos", "Alegría", "Calma", "Orgullo" ], "max": 3 }, { "id": "emotion_intensity", "type": "scale", "prompt": "¿Qué tan fuerte fue la emoción? (de 0 a 10)", "help": "Si marcaste más de una, puntuá la más fuerte. Lucas: tristeza, 8.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimo", "maps_to": "emotion_before" }, { "id": "evidence_for", "type": "text", "prompt": "¿Qué apoya el pensamiento?", "help": "Datos, como un detective: ¿qué pruebas tenés de que es así?\n\nAsí lo hizo Lucas: «Desaprobé este examen.»" }, { "id": "evidence_against", "type": "text", "prompt": "¿Qué no encaja con el pensamiento?", "help": "Preguntate: ¿hay algo que no encaja?\n\nAsí lo hizo Lucas: «Aprobé Lengua y Sociales. Esa noche casi no dormí. Nunca pedí ayuda en Matemática.»" }, { "id": "other_view", "type": "text", "prompt": "¿Hay otra forma de verlo?", "help": "Preguntate: ¿hay otra explicación posible? ¿Qué es lo peor, lo mejor y lo más probable?\n\nAsí lo hizo Lucas: «Me fue mal en un día muy difícil, y Matemática me cuesta.»" }, { "id": "friend", "type": "text", "prompt": "¿Qué le dirías a alguien que querés si pensara lo mismo?", "help": "Así lo hizo Lucas: «Un examen no dice cuánto valés.»" }, { "id": "new_thought", "type": "text", "prompt": "¿Cuál es tu pensamiento nuevo?", "help": "No hace falta que sea positivo: alcanza con que sea más justo. Preguntate también: ¿pensar así me ayuda con lo que quiero?\n\nAsí lo hizo Lucas: «Me fue mal en este examen y todavía no pedí ayuda. Puedo pedirla.»" }, { "id": "belief_after", "type": "scale", "prompt": "¿Cuánto creés ahora el pensamiento del principio? (de 0 a 100 %)", "help": "Lucas: 40 %.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "emotion_after", "type": "scale", "prompt": "¿Cómo te sentís ahora? (de 0 a 10)", "help": "Puntuá la misma emoción de antes. Lucas: tristeza, 5.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimo", "maps_to": "emotion_after" }, { "id": "summary", "type": "reflect", "title": "Tu hoja de detective", "template": "Pensamiento del principio: «{{thought}}». Lo que no encaja: «{{evidence_against}}». Otra forma de verlo: «{{other_view}}». Pensamiento nuevo: «{{new_thought}}».", "content": "Cuando toques «Terminar», tus respuestas quedan guardadas: las podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo/a también las puede ver." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**10 a 15 minutos.** Hacé «Mi turno» otra vez con un pensamiento que te haya pesado esta semana: volvé a este ejercicio y ponelo a prueba con las preguntas de detective.\n\nAcordate: no se trata de pensar lindo, sino de pensar más completo." } ]$steps$::jsonb),
  ('brujula-cuando-me-quiero-aislar', 'Cuando me quiero aislar', 'Salí del aislamiento con pasos chicos: ideas que no cuestan plata, tu escalera y un plan de 7 días.', 'custom', 'tcc', 'adolescentes', 'brujula', 10, 105,
   $steps$[ { "id": "intro", "type": "info", "title": "Encerrarse da alivio", "content": "**No esperes a tener ganas: da un paso chico y fijate qué pasa.**\n\nCuando estamos mal, encerrarnos da alivio. A veces es una forma de protegerse, y está bien.\n\nEl problema es cuando se vuelve lo único: hacemos cada vez menos y las ganas no vuelven solas." }, { "id": "circle", "type": "info", "title": "El círculo", "content": "Funciona como un círculo:\n\n1. **Evito, me aíslo.**\n2. **Alivio corto.**\n3. **Más aislamiento.**\n4. **Menos cosas buenas.**\n…y vuelve a empezar.\n\nPor eso, con el ánimo bajo, muchas veces primero viene la acción y después, de a poco, las ganas." }, { "id": "lucas", "type": "info", "title": "Lucas, 15 años", "content": "Después de las discusiones en casa, se encierra en la pieza. Dejó el fútbol.\n\nUn rato se siente mejor, pero los fines de semana se le hacen eternos." }, { "id": "ideas", "type": "checklist", "prompt": "Ideas que no cuestan plata: ¿cuáles te gustaría probar?", "help": "Cada idea tiene su letra:\n\n- **P: placer**, algo que disfrutás.\n- **L: logro**, algo que cuesta un poco y te deja conforme.\n- **C: conexión**, algo con otra persona.\n\nMarcá todas las que quieras.", "options": [ "Caminar o andar en bici (P)", "Escuchar música (P)", "Dibujar o escribir (P)", "Jugar al fútbol o al vóley (P, C)", "Tomar tereré con alguien (C)", "Ayudar en una tarea de la casa (L)", "Ordenar mi espacio (L)", "Estudiar 15 minutos (L)", "Salir al patio un rato (P)", "Jugar con una mascota (P)", "Escribirle a alguien (C)", "Retomar un hobby (P, L)" ] }, { "id": "escalera", "type": "info", "title": "Mi escalera", "content": "Una escalera va del paso más fácil al más difícil, hacia una meta tuya. Cada escalón es un paso chico.\n\nLa escalera de Lucas:\n\n- **1. Muy fácil:** mirar un entrenamiento desde afuera.\n- **2. Fácil:** escribirle al técnico.\n- **3. Medio:** ir a un entrenamiento.\n- **4. Difícil:** ir dos veces por semana." }, { "id": "goal", "type": "text", "prompt": "Mi escalera: ¿cuál es tu meta?", "help": "Algo tuyo a lo que te gustaría llegar, de a poco." }, { "id": "ladder", "type": "list", "prompt": "Escribí 4 escalones, del más fácil al más difícil", "help": "Uno por renglón, en orden: 1. Muy fácil · 2. Fácil · 3. Medio · 4. Difícil.\n\nLucas empezó por «mirar un entrenamiento desde afuera».", "count": 4 }, { "id": "plan_intro", "type": "info", "title": "Mi plan de 7 días", "content": "Ahora armá tu plan para esta semana: una actividad por día. Pueden ser ideas de la lista o escalones de tu escalera.\n\nDurante la semana vas a anotar tu ánimo antes y después de cada actividad, y cuánto logro sentiste, de 0 a 10." }, { "id": "plan", "type": "list", "prompt": "¿Qué actividad vas a hacer cada día?", "help": "Un renglón por día: el día, la actividad y su letra (P, L o C). Por ejemplo: «Lunes: escuchar música (P)».", "count": 7, "min": 3 }, { "id": "summary", "type": "reflect", "title": "Tu plan", "template": "Mi meta: «{{goal}}». Mi escalera, del paso más fácil al más difícil: {{ladder}}.", "content": "Cuando toques «Terminar», tu plan de 7 días queda guardado junto con tu escalera: lo podés volver a ver en este ejercicio, en «Mis respuestas»." }, { "id": "discovered", "type": "text", "prompt": "Lo que descubrí: ¿qué notaste en tu ánimo?", "help": "Si ya hiciste alguna actividad del plan, anotá qué pasó con tu ánimo antes y después. Si todavía no, tocá «Saltar»: la completás cuando vuelvas a este ejercicio al final de la semana.", "optional": true }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**5 minutos por día.** Hacé al menos 3 actividades del plan. Después de cada una, anotá en «Registro de actividad» qué hiciste, tu ánimo antes y después (de 0 a 10) y cuánto logro sentiste.\n\nAl final de la semana, hacé este ejercicio de nuevo: armá el plan de la semana siguiente y anotá lo que descubriste.\n\nSi en estos días te sentís muy mal o pensás en hacerte daño, contáselo a tu psicólogo/a o a un adulto de confianza, y abrí «Mi plan para momentos muy difíciles», en **Calmarme**.\n\nNo esperes a tener ganas: da un paso chico y fijate qué pasa." } ]$steps$::jsonb),
  ('brujula-no-todo-lo-que-pienso', 'No todo lo que pienso es una orden', 'Mirá tus pensamientos desde afuera: una frase que da distancia, «Hojas en el río» y nombrar la historia.', 'defusion', 'act', 'adolescentes', 'brujula', 10, 106,
   $steps$[ { "id": "intro", "type": "info", "title": "Una radio que no se apaga", "content": "**Tu mente habla todo el tiempo. No tenés que obedecer todo lo que dice.**\n\nLos pensamientos son como una radio que no se apaga. No los podés callar a la fuerza, pero podés escucharlos sin que te manejen.\n\nEn «Poner a prueba lo que pienso» discutías con el pensamiento; acá probás otra cosa: mirarlo desde afuera. Las dos herramientas sirven." }, { "id": "not_equal", "type": "info", "title": "Un pensamiento no es…", "content": "- **Pensamiento ≠ hecho.** Que lo pienses no lo vuelve verdad.\n- **Pensamiento ≠ orden.** Podés pensar «no vayas» e ir igual.\n- **Pensamiento ≠ quién sos.** Pensar «soy un fracaso» no te convierte en uno." }, { "id": "phrase", "type": "info", "title": "La frase que da distancia", "content": "Probá agregarle una frase adelante al pensamiento:\n\n- «Soy un fracaso.» → **«Estoy teniendo el pensamiento de que soy un fracaso.»**\n- «Todos se ríen de mí.» → **«Mi mente me está diciendo que todos se ríen de mí.»**\n\n**Ojo:** esto sirve para lo que pensás sobre vos, no para negar lo que pasó. Si se rieron de vos, eso pasó: contalo. Para eso están «Cuando otros me hacen sentir menos» y «Mi red de apoyo»." }, { "id": "thought", "type": "text", "prompt": "Probalo: escribí un pensamiento que te enganche", "help": "Escribilo tal cual aparece en tu cabeza. Por ejemplo: «soy un fracaso». En la pantalla siguiente le vas a agregar la frase adelante.", "placeholder": "Mi pensamiento…" }, { "id": "hook_before", "type": "scale", "prompt": "¿Cuánto te engancha ese pensamiento? (de 0 a 10)", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "with_phrase", "type": "reflect", "title": "Ahora con la frase", "template": "«Estoy teniendo el pensamiento de que {{thought}}»", "content": "Leela despacio, una o dos veces. También podés probar con «Mi mente me está diciendo que…»." }, { "id": "hook_after", "type": "scale", "prompt": "¿Y ahora, con la frase, cuánto te engancha? (de 0 a 10)", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "river", "type": "timed_info", "title": "Hojas en el río", "content": "**3 minutos.** Si preferís, imaginá nubes que cruzan el cielo.\n\n1. Imaginá un río tranquilo con hojas que pasan flotando.\n2. Cada vez que aparezca un pensamiento, ponelo en una hoja y dejá que el agua se lo lleve.\n3. Si te enganchás con uno, está bien: date cuenta y volvé al río.\n\nNo es para que los pensamientos desaparezcan ni para relajarte: es para practicar mirarlos desde afuera.\n\nCuando estés listo/a, tocá «Iniciar». Al terminar, la app pasa sola a la pantalla siguiente.", "seconds": 180 }, { "id": "leaves", "type": "list", "prompt": "¿Qué pensamientos aparecieron en las hojas?", "help": "Escribí uno por renglón, como si los pusieras en cada hoja.", "count": 5, "optional": true }, { "id": "story_name", "type": "text", "prompt": "¿Hay un pensamiento que vuelve siempre? Ponele nombre", "help": "Completá la frase «Ahí viene la historia de…» con un nombre corto.", "placeholder": "El nombre de la historia…", "optional": true }, { "id": "summary", "type": "reflect", "title": "Para mirar desde afuera", "template": "«Estoy teniendo el pensamiento de que {{thought}}». Y cuando vuelva el pensamiento de siempre: «Ahí viene la historia de {{story_name}}».", "content": "La próxima vez que aparezcan, probá decírtelo así. Podés volver a este ejercicio cuando quieras para probarlo con otros pensamientos.\n\nCuando toques «Terminar», tus respuestas quedan guardadas en este ejercicio, en «Mis respuestas»." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "La tarea de esta semana está en el próximo ejercicio: **«Lo que realmente me importa»**.\n\nTu mente va a seguir hablando. No tenés que obedecer todo lo que dice." } ]$steps$::jsonb),
  ('brujula-lo-que-me-importa', 'Lo que realmente me importa', 'Diferenciá un valor de una meta, elegí tus 3 valores y una acción chiquita para cada uno esta semana.', 'values', 'act', 'adolescentes', 'brujula', 8, 107,
   $steps$[ { "id": "intro", "type": "info", "title": "Lo que realmente me importa", "content": "**Tus valores son como una brújula: no te dicen adónde llegar, te dicen hacia dónde ir.**\n\nUn valor es una dirección: algo que te importa y que podés vivir todos los días. Una meta es un punto concreto que se puede tachar.\n\nTus valores son tuyos, no los que otros esperan de vos. Y podés actuar según un valor aunque tengas miedo o pocas ganas." }, { "id": "quiz_value", "type": "choice", "prompt": "Vale dice: «Ser buena amiga». ¿Es un valor o una meta?", "options": [ "Un valor", "Una meta" ], "feedback": { "Un valor": "¡Sí! Es una dirección: no se termina nunca. Vale puede seguir siendo buena amiga todos los días.", "Una meta": "Mirá de nuevo: «ser buena amiga» no se hace una vez y se tacha. Es una dirección que no se termina nunca, así que es un valor." } }, { "id": "quiz_goal", "type": "choice", "prompt": "«Escribirle hoy a alguien que me importa». ¿Es un valor o una meta?", "options": [ "Un valor", "Una meta" ], "feedback": { "Una meta": "¡Exacto! Es un punto concreto: se hace y se tacha. Y va en la dirección del valor de Vale: ser buena amiga.", "Un valor": "Casi: es algo concreto que se hace hoy y se tacha, así que es una meta. El valor es la dirección (ser buena amiga) y la meta es un paso hacia ese lado." } }, { "id": "values_check", "type": "checklist", "prompt": "¿Qué te importa a vos?", "help": "Marcá los que más te importan.", "options": [ "Amigos", "Familia", "Estudio", "Salud", "Respeto", "Confianza", "Futuro", "Diversión", "Responsabilidad", "Ayudar", "Independencia", "Otro" ] }, { "id": "other_value", "type": "text", "prompt": "Si marcaste «Otro», ¿cuál es?", "placeholder": "Otro valor que me importa…", "optional": true }, { "id": "top_values", "type": "list", "prompt": "Mi brújula: elegí tus 3 valores más importantes", "help": "Pueden ser de los que marcaste recién. Uno por renglón.", "count": 3, "min": 3 }, { "id": "actions", "type": "list", "prompt": "Una acción chiquita para cada valor, esta semana", "help": "Una por renglón, en el mismo orden que tus valores. Que sea concreta y se pueda tachar, como «Escribirle hoy a alguien que me importa».", "count": 3, "min": 3 }, { "id": "brake", "type": "info", "title": "Si aparece un pensamiento que te frena", "content": "Cuando vayas a hacer la acción, puede aparecer un pensamiento que te frene. Acordate: podés actuar según un valor aunque tengas miedo o pocas ganas.\n\nUsá la frase de «No todo lo que pienso es una orden»:\n\n**«Estoy teniendo el pensamiento de que…»**\n\nY hacé la acción igual." }, { "id": "brake_thought", "type": "text", "prompt": "¿Qué pensamiento creés que podría frenarte?", "help": "Escribilo tal cual aparecería en tu cabeza. En la próxima pantalla lo vas a ver con la frase adelante.", "placeholder": "El pensamiento que me frena…", "optional": true }, { "id": "compass", "type": "reflect", "title": "Mi brújula", "template": "Mis valores: {{top_values}}. Mis acciones chiquitas para esta semana: {{actions}}. Si aparece un pensamiento que me frena, me digo: «Estoy teniendo el pensamiento de que {{brake_thought}}». Y hago la acción igual.", "content": "No te dice adónde llegar: te dice hacia dónde ir. Cuando termines, tu brújula queda guardada en «Mis respuestas» de este ejercicio, para que la mires durante la semana." }, { "id": "did_it", "type": "choice", "prompt": "¿Ya hiciste alguna de las tres acciones?", "help": "Si recién armaste tu brújula, es normal que todavía no.", "options": [ "Sí", "Todavía no" ], "feedback": { "Sí": "¡Bien! En la próxima pantalla contá qué pensamiento apareció y qué hiciste con él.", "Todavía no": "Está bien: son para esta semana. En la próxima pantalla tocá «Saltar»." } }, { "id": "what_happened", "type": "text", "prompt": "¿Qué pensamiento apareció y qué hiciste con él?", "help": "Si todavía no hiciste ninguna acción, tocá «Saltar».", "optional": true }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 10 minutos.** Hacé al menos una de las tres acciones.\n\nSi aparece un pensamiento que te frena, usá la frase de «No todo lo que pienso es una orden» («Estoy teniendo el pensamiento de que…») y hacé la acción igual.\n\nDespués podés anotar qué pensamiento apareció y qué hiciste con él en «Registrar cómo me siento», o contarlo la próxima vez que hagas este ejercicio." } ]$steps$::jsonb),
  ('brujula-emocion-sube-a-100', 'Cuando la emoción sube a 100', 'Conocé tu termómetro emocional, aprendé STOP y armá tu caja de herramientas para cuando la emoción sube.', 'dbt_skill', 'dbt', 'adolescentes', 'brujula', 10, 108,
   $steps$[ { "id": "intro", "type": "info", "title": "Cuando la emoción sube a 100", "content": "**La emoción no es el enemigo: es información. Lo que importa es qué hacés cuando sube.**\n\nEn este ejercicio vas a conocer tu termómetro y una habilidad para frenar (STOP), y vas a armar tu caja de herramientas para los momentos en que la emoción sube mucho." }, { "id": "thermometer", "type": "info", "title": "Mi termómetro", "content": "Tu emoción puede ir de 0 a 10, como un termómetro. Según en qué número estés, te conviene hacer algo distinto:\n\n- **9–10: Seguridad y ayuda.** Buscá a una persona segura. Si pensás en hacerte daño, andá a «Mi plan para momentos muy difíciles» (lo encontrás en **Calmarme**).\n- **7–8: Primero, bajar la intensidad.** Usá STOP y algo de tu caja de herramientas.\n- **4–6: Necesito regular.** Ponele nombre a lo que sentís, respirá, hacé una pausa.\n- **0–3: Puedo pensar.** Es buen momento para usar «Poner a prueba lo que pienso», «No todo lo que pienso es una orden» o «Decir lo que necesito sin explotar ni callarme»." }, { "id": "now_band", "type": "choice", "prompt": "¿En qué número está tu termómetro ahora?", "options": [ "9–10", "7–8", "4–6", "0–3" ], "feedback": { "9–10": "**Seguridad y ayuda.** Buscá ya a una persona segura. Si pensás en hacerte daño, abrí «Mi plan para momentos muy difíciles»: lo encontrás en **Calmarme**.\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos.\n\nEste ejercicio puede esperar.", "7–8": "**Primero, bajar la intensidad.** Usá STOP y algo de tu caja de herramientas: los vas a ver en las próximas pantallas. En **Calmarme** tenés la «Respiración guiada» y el «Grounding 5-4-3-2-1». Podés volver a este ejercicio después.", "4–6": "**Necesitás regular.** Ponele nombre a lo que sentís, respirá, hacé una pausa. Después seguí con el ejercicio.", "0–3": "**Podés pensar.** Es un buen momento para seguir con este ejercicio y armar tu caja de herramientas." } }, { "id": "regulate", "type": "info", "title": "Regular no es reprimir", "content": "**Reprimir** es hacer como que no pasa y tragarse todo. Suele explotar después.\n\n**Regular** es notar la emoción, ponerle nombre, bajarle la intensidad y decidir qué hacer." }, { "id": "stop", "type": "info", "title": "STOP", "content": "Para cuando estás en 7 u 8, una letra por vez:\n\n- **S: Frená.** No hagas ni digas nada todavía.\n- **T: Tomá distancia.** Un paso atrás. Salí un momento si podés.\n- **O: Observá.** ¿Qué siento? ¿Qué pienso? ¿Qué está pasando?\n- **P: Procedé con conciencia.** ¿Qué me conviene hacer ahora?" }, { "id": "tobi", "type": "info", "title": "Tobi, 14 años", "content": "Vio que subieron una foto suya para burlarse. **Bronca: 9.** Quería ir a pegarle al que la subió.\n\nFrenó, salió del aula, respiró y se lo contó a la orientadora. **La bronca bajó a 6** y pudo pensar qué hacer.\n\nSi te pasa algo parecido, mirá también «Cuando otros me hacen sentir menos»." }, { "id": "toolbox", "type": "checklist", "prompt": "Mi caja de herramientas para cuando estoy en 8", "help": "Marcá las que te sirven. En la próxima pantalla agregás las tuyas.\n\n- **Respiración lenta:** inhalá contando 4 y exhalá contando 6, durante 1 o 2 minutos. Sirve para bajar un cambio y poder pensar.\n- **5-4-3-2-1:** nombrá 5 cosas que ves, 4 que podés tocar, 3 que escuchás, 2 que olés y 1 que saboreás.\n\nLas dos están en **Calmarme**, paso a paso: «Respiración guiada» y «Grounding 5-4-3-2-1».", "options": [ "Respiración lenta", "5-4-3-2-1", "Tomar agua despacio", "Cambiar de lugar (salir de la pieza, ir al patio)", "Hablar o escribirle a una persona segura", "Moverte un rato (caminar, subir escaleras)" ] }, { "id": "my_tools", "type": "text", "prompt": "Lo que a mí me sirve: ¿qué agregarías a tu caja?", "help": "Algo tuyo que te ayude a bajar cuando estás en 8, o la herramienta de la lista que más te sirve.", "placeholder": "Lo que a mí me sirve…" }, { "id": "signals", "type": "text", "prompt": "Mis señales de que estoy subiendo", "help": "¿Qué notás en tu **cuerpo**, en tus **pensamientos** y en **lo que hacés** cuando la emoción empieza a subir?", "placeholder": "En el cuerpo… En lo que pienso… En lo que hago…" }, { "id": "last_what", "type": "text", "prompt": "La última vez que llegué a 8: ¿qué pasó?", "help": "Contalo en pocas palabras. Si no te acordás de una vez en 8, pensá en la última vez que la emoción subió mucho." }, { "id": "last_did", "type": "text", "prompt": "¿Qué hiciste en ese momento?", "help": "Tal cual pasó. Es para entender, no para juzgarte." }, { "id": "last_try", "type": "text", "prompt": "¿Qué probarías la próxima vez?", "help": "Puede ser STOP o algo de tu caja de herramientas." }, { "id": "summary", "type": "reflect", "title": "Mi caja de herramientas", "template": "Mis señales de que estoy subiendo: {{signals}}. Mi caja para cuando estoy en 8: {{toolbox}}. Lo que a mí me sirve: {{my_tools}}. La próxima vez voy a probar: {{last_try}}.", "content": "Cuando notes esas señales, frená con STOP y abrí tu caja. Si llegás a 9 o 10, primero la seguridad: buscá a una persona segura y abrí tu plan para momentos muy difíciles.\n\nCuando termines, todo queda guardado en «Mis respuestas» de este ejercicio." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 5 minutos.** Usá STOP o una herramienta de tu caja una vez.\n\n- **Antes:** ¿en qué número de tu termómetro estás, de 0 a 10?\n- **Después:** ¿y ahora?\n\nPodés anotarlo en «Registrar cómo me siento»: un registro antes y otro después.\n\nLa emoción no es el enemigo: es información." } ]$steps$::jsonb),
  ('brujula-decir-lo-que-necesito', 'Decir lo que necesito sin explotar ni callarme', 'Decí lo que necesitás de forma clara y respetuosa: la fórmula, cómo poner un límite y tu propia frase.', 'dbt_skill', 'dbt', 'adolescentes', 'brujula', 12, 109,
   $steps$[ { "id": "intro", "type": "info", "title": "Sin explotar ni callarme", "content": "**Ser asertivo no es ser agresivo: es decir lo que necesitás de forma clara y respetuosa.**\n\nCuando algo te molesta con otra persona, hay tres caminos:\n\n- **Callarme:** «No pasa nada», y por dentro sí pasa.\n- **Decirlo claro:** lo que pasa, lo que siento y lo que necesito.\n- **Explotar:** gritos, portazos, insultos." }, { "id": "formula", "type": "info", "title": "La fórmula", "content": "Para decirlo claro, usá estas cuatro partes:\n\n- **Cuando…** lo que pasa, sin insultos.\n- **me siento…** la emoción.\n- **necesito…** lo que me hace falta.\n- **te pido… o me ayudaría que…** algo concreto." }, { "id": "lucas", "type": "info", "title": "Así lo dijo Lucas (15 años)", "content": "«Cuando discutimos y todos empiezan a gritar, me siento muy tenso. Necesito poder terminar de explicar lo que pasó. Me ayudaría que podamos hablar de a uno.»\n\nParte por parte:\n\n- **Cuando** discutimos y todos empiezan a gritar,\n- **me siento** muy tenso.\n- **Necesito** poder terminar de explicar lo que pasó.\n- **Me ayudaría que** podamos hablar de a uno." }, { "id": "tips", "type": "info", "title": "Para que funcione mejor", "content": "- **Elegí el momento:** no en plena pelea.\n- **Sostené el tema sin subir el tono.** Si te cambian de tema, volvé con calma.\n- **Estate dispuesto/a a negociar:** buscá algo que sirva a los dos.\n- **Vos podés cuidar cómo lo decís.** Cómo reacciona el otro no depende de vos." }, { "id": "limit_info", "type": "info", "title": "Poner un límite", "content": "Poner un límite es decir hasta dónde sí y hasta dónde no.\n\n- **Con amigos:** «No quiero vapear. Si van a hacerlo, me voy un rato y después vuelvo».\n- **En casa:** «No quiero que me griten. Si pasa, me voy a mi pieza y hablamos cuando estemos más tranquilos»." }, { "id": "safety", "type": "info", "title": "Comunicar no siempre es la primera opción", "content": "Si en esa situación hay miedo, amenazas o violencia, **primero está tu seguridad**: buscá a un adulto seguro de «Mi red de apoyo» o pedí ayuda con «Mi plan para momentos muy difíciles» (lo abrís rápido desde **Calmarme**).\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "avoided", "type": "text", "prompt": "Tu turno: ¿qué conversación estás evitando?", "help": "Con quién y sobre qué, en pocas palabras.", "placeholder": "Una conversación que estoy evitando…" }, { "id": "usual", "type": "choice", "prompt": "En esa situación, ¿qué solés hacer?", "options": [ "Me callo", "Exploto", "Otra cosa" ], "feedback": { "Me callo": "Callarte es decir «no pasa nada» cuando por dentro sí pasa. La fórmula te ayuda a decirlo claro.", "Exploto": "Explotar es gritos, portazos, insultos. La fórmula te ayuda a decirlo claro, sin explotar.", "Otra cosa": "Si querés, contá en la próxima pantalla qué hacés." } }, { "id": "usual_other", "type": "text", "prompt": "Si elegiste «Otra cosa», ¿qué hacés?", "placeholder": "Lo que suelo hacer…", "optional": true }, { "id": "f_when", "type": "text", "prompt": "Armá tu frase: «Cuando…», ¿qué pasa?", "help": "Cómo podrías decirlo, parte por parte. Primero, lo que pasa, sin insultos. Seguí la frase sin volver a escribir «cuando».\n\nLucas: «Cuando **discutimos y todos empiezan a gritar**…»", "placeholder": "Lo que pasa, sin insultos…" }, { "id": "f_feel", "type": "text", "prompt": "«Me siento…»: ¿qué emoción?", "help": "Seguí la frase sin volver a escribir «me siento».\n\nLucas: «…me siento **muy tenso**.»", "placeholder": "La emoción…" }, { "id": "f_need", "type": "text", "prompt": "«Necesito…»: ¿qué te hace falta?", "help": "Seguí la frase sin volver a escribir «necesito».\n\nLucas: «Necesito **poder terminar de explicar lo que pasó**.»", "placeholder": "Lo que me hace falta…" }, { "id": "f_ask_start", "type": "choice", "prompt": "Para pedirlo, ¿qué te sale más natural?", "help": "Las dos sirven. Lucas eligió «Me ayudaría que…».", "options": [ "Te pido que", "Me ayudaría que" ] }, { "id": "f_ask", "type": "text", "prompt": "¿Qué cosa concreta pedís?", "help": "Seguí la frase sin volver a escribir el comienzo.\n\nLucas: «Me ayudaría que **podamos hablar de a uno**.»", "placeholder": "Algo concreto…" }, { "id": "phrase", "type": "reflect", "title": "Tu frase", "template": "«Cuando {{f_when}}, me siento {{f_feel}}. Necesito {{f_need}}. {{f_ask_start}} {{f_ask}}.»", "content": "Así podrías decirlo. Si algo no te suena a vos, volvé atrás y cambialo. Y acordate: elegí el momento, no en plena pelea." }, { "id": "my_limit", "type": "text", "prompt": "¿Qué límite necesitás?", "help": "Hasta dónde sí y hasta dónde no. Por ejemplo, en casa: «No quiero que me griten. Si pasa, me voy a mi pieza y hablamos cuando estemos más tranquilos».", "placeholder": "No quiero que… Si pasa, voy a…", "optional": true }, { "id": "is_safe", "type": "choice", "prompt": "¿Es seguro tener esta conversación?", "options": [ "Sí", "No sé", "No: primero lo hablo con mi psicólogo/a" ], "feedback": { "Sí": "Bien. Elegí un buen momento, no en plena pelea. Vos podés cuidar cómo lo decís; cómo reacciona el otro no depende de vos.", "No sé": "Está bien no estar seguro/a. Si hay miedo, amenazas o violencia, primero está tu seguridad: antes de hablar, contáselo a tu psicólogo/a o a un adulto seguro de «Mi red de apoyo».", "No: primero lo hablo con mi psicólogo/a": "Bien pensado: comunicar no siempre es la primera opción, y primero está tu seguridad. Cuando termines, tu frase queda guardada en «Mis respuestas» para hablarla en la próxima sesión. Si te sentís en peligro, buscá a un adulto seguro de «Mi red de apoyo» o abrí «Mi plan para momentos muy difíciles» desde **Calmarme**." } }, { "id": "how_it_went", "type": "text", "prompt": "¿Cómo te fue?", "help": "Si ya probaste la fórmula con algo chico, contá cómo te fue. Si todavía no, tocá «Saltar»: es la tarea para esta semana.", "optional": true }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 5 minutos.** Probá la fórmula una vez con algo chico, no con la conversación más difícil.\n\nDespués anotá cómo te fue: podés hacerlo en «Registrar cómo me siento» o la próxima vez que hagas este ejercicio.\n\nSer asertivo no es ser agresivo: es decir lo que necesitás de forma clara y respetuosa." } ]$steps$::jsonb),
  ('brujula-cuando-me-hacen-sentir-menos', 'Cuando otros me hacen sentir menos', 'Distinguí conflicto, broma y bullying, ubicá lo que te pasa en el semáforo y armá tu plan anti-bullying.', 'custom', 'general', 'adolescentes', 'brujula', 15, 110,
   $steps$[ { "id": "intro", "type": "info", "title": "Cuando otros me hacen sentir menos", "content": "**El bullying no es culpa de quien lo sufre.**\n\nPrimero vas a ver la diferencia entre conflicto, broma, bullying y cyberbullying. Después, dónde está lo que te pasa y qué podés hacer.\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "tipos", "type": "info", "title": "Conflicto, broma o bullying", "content": "- **Conflicto.** Un desacuerdo entre personas que están a la par. Pasa a veces y se puede hablar.\n- **Broma.** Se ríen todos, también vos. Si pedís que pare, para.\n- **Bullying.** Se repite, es a propósito y el otro tiene más poder: es más fuerte, más popular o son varios.\n- **Cyberbullying.** Lo mismo, por celular o redes: mensajes, fotos, memes, grupos. Llega a cualquier hora y lo ve mucha gente." }, { "id": "semaforo", "type": "choice", "prompt": "El semáforo: ¿dónde está lo que te pasa?", "help": "- **Verde.** Un conflicto o una broma que no lastima. Se puede hablar o resolver.\n- **Amarillo.** Algo te molesta, se repite o no para cuando lo pedís. Contáselo a alguien y anotá qué pasa.\n- **Rojo.** Amenazas, golpes, te dejan afuera a propósito una y otra vez, publican cosas tuyas, o te presionan para mandar fotos o hacer algo que no querés. **Contáselo ya a un adulto seguro. No lo enfrentes solo/a.**\n\nSi hoy no te pasa nada de esto, podés saltear esta pregunta.", "options": [ "Verde", "Amarillo", "Rojo" ], "feedback": { "Verde": "**Verde: se puede hablar o resolver.** Un conflicto o una broma que no lastima pasa a veces. Si empieza a repetirse o no para cuando lo pedís, ya es amarillo.", "Amarillo": "**Amarillo: contáselo a alguien y anotá qué pasa.** En unos pasos vas a armar tu plan anti-bullying: a quién le vas a contar y qué.", "Rojo": "**Rojo: contáselo ya a un adulto seguro. No lo enfrentes solo/a.** Lo que te pasa no es culpa tuya.\n\nNo esperes a terminar este ejercicio para contarlo. El plan anti-bullying de las próximas pantallas te puede ayudar a ordenar a quién y qué.\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, "optional": true }, { "id": "redes", "type": "info", "title": "En redes", "content": "Si pasa por celular o redes:\n\n- Guardá capturas con la fecha.\n- No contestes en caliente.\n- Bloqueá y reportá.\n- Contáselo a un adulto.\n\n**No borres las pruebas.**" }, { "id": "tobi", "type": "info", "title": "Lo que pasó y lo que pensé sobre mí", "content": "**El hecho no se discute: se trabaja lo que te quedó pensando de vos.**\n\nAsí lo hizo Tobi, 14 años:\n\n- **Lo que pasó:** Se burlaron de mi cuerpo. Pasó, y estuvo mal.\n- **Lo que pensé sobre mí después:** «Entonces soy horrible.»\n- **Lo que me diría alguien que me quiere:** «Que se burlen habla de cómo tratan ellos, no de lo que valés.»\n- **Lo que elijo creer sobre mí:** «Me dolió. No me define.»\n\nAhora te toca a vos: pensá en alguna vez que alguien te hizo sentir menos." }, { "id": "que_paso", "type": "text", "prompt": "¿Qué pasó?", "help": "Contá el hecho. No hace falta discutirlo: si te trataron mal, estuvo mal.\n\nTobi escribió: «Se burlaron de mi cuerpo. Pasó, y estuvo mal.»" }, { "id": "pense", "type": "text", "prompt": "¿Qué pensaste sobre vos después?", "help": "Tobi pensó: «Entonces soy horrible.»" }, { "id": "alguien_quiere", "type": "text", "prompt": "¿Qué te diría alguien que te quiere?", "help": "A Tobi le dirían: «Que se burlen habla de cómo tratan ellos, no de lo que valés.»" }, { "id": "elijo_creer", "type": "text", "prompt": "¿Qué elegís creer sobre vos?", "help": "Tobi eligió: «Me dolió. No me define.»" }, { "id": "resumen_pense", "type": "reflect", "title": "Lo que pasó y lo que pensé sobre mí", "template": "Pasó esto: «{{que_paso}}». Después pensé: «{{pense}}». Alguien que me quiere me diría: «{{alguien_quiere}}». Elijo creer: «{{elijo_creer}}».", "content": "**El bullying no es culpa de quien lo sufre.**" }, { "id": "plan_intro", "type": "info", "title": "Mi plan anti-bullying", "content": "Ahora armá tu plan: a quién le vas a contar, qué le vas a contar y cómo cuidarte mientras tanto.\n\nSon seis preguntas cortas. Si hoy no te pasa nada de esto, armalo igual, pensando a quién recurrirías." }, { "id": "adulto_colegio", "type": "text", "prompt": "¿A qué adulto del colegio le vas a contar?", "help": "Puede ser un profe, el orientador o la orientadora, o alguien del colegio en quien confíes." }, { "id": "adulto_fuera", "type": "text", "prompt": "¿Y a qué adulto fuera del colegio?", "help": "Alguien de tu familia en quien confíes, tu psicólogo/a, tu entrenador/a, alguien del club o del barrio." }, { "id": "que_contar", "type": "text", "prompt": "¿Qué le vas a contar?", "help": "Si te sirve, usá lo que anotaste en «¿Qué pasó?».\n\nSi hoy no te pasa nada de esto, anotá qué le contarías si pasara." }, { "id": "pruebas", "type": "text", "prompt": "¿Dónde guardás las pruebas?", "help": "Capturas con la fecha, mensajes, fotos. No las borres.\n\nSi no hay pruebas que guardar, podés saltear esta pregunta.", "optional": true }, { "id": "acompanado", "type": "text", "prompt": "¿Dónde y cuándo estás más acompañado/a?", "help": "Pensá en lugares y momentos del día." }, { "id": "companeros", "type": "text", "prompt": "¿Qué compañeros/as te hacen bien?", "help": "Si ahora no se te ocurre nadie, podés saltear esta pregunta.", "optional": true }, { "id": "resumen_plan", "type": "reflect", "title": "Mi plan anti-bullying", "template": "Adulto del colegio: {{adulto_colegio}}. Adulto fuera del colegio: {{adulto_fuera}}. Les voy a contar: «{{que_contar}}». Pruebas guardadas en: {{pruebas}}; compañeros/as que me hacen bien: {{companeros}}; dónde y cuándo estoy más acompañado/a: {{acompanado}}.", "content": "Cuando toques «Terminar», tu plan queda guardado y lo vas a poder volver a ver en este ejercicio, en «Mis respuestas»." }, { "id": "otra_persona", "type": "info", "title": "¿Le pasa a otra persona?", "content": "Si ves que a alguien le pasa:\n\n- No te sumes.\n- Acompañala.\n- Avisá a un adulto." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "La tarea de esta semana está en el ejercicio «Mi red de apoyo», donde armás tu mapa de personas seguras.\n\n**Unos 10 minutos.** Hablá con uno de los adultos de tu mapa, del tema que vos elijas. Si te está pasando algo de lo que viste acá, ese es el tema.\n\n**El bullying no es culpa de quien lo sufre.**" } ]$steps$::jsonb),
  ('brujula-red-de-apoyo', 'Mi red de apoyo', 'Armá tu mapa de personas seguras y anotá a quién podés recurrir según lo que te pase.', 'custom', 'general', 'adolescentes', 'brujula', 12, 111,
   $steps$[ { "id": "intro", "type": "info", "title": "Mi red de apoyo", "content": "**No todas las personas tienen que poder ayudarte con todo.**\n\nUna **persona segura** te escucha sin burlarse, no te lastima, te cree y puede ayudarte o buscar a alguien que pueda." }, { "id": "afuera", "type": "info", "title": "Si en tu casa no hay alguien así", "content": "Se puede buscar afuera:\n\n- Un profe.\n- El orientador o la orientadora.\n- Tu psicólogo/a.\n- Un médico o una médica.\n- Tu entrenador/a.\n- Un vecino o una vecina de confianza.\n- Alguien del club, de la iglesia o del barrio." }, { "id": "mapa_info", "type": "info", "title": "Tu mapa", "content": "Vas a armar un mapa con vos en el centro y tres zonas alrededor, de la más cercana a la más lejana:\n\n- **A quién le puedo contar algo.**\n- **A quién le puedo pedir ayuda.**\n- **Profesionales y adultos responsables.**\n\nEscribí nombres en cada zona. **Meta: al menos 2 adultos.**" }, { "id": "tus_reglas", "type": "info", "title": "Tu mapa, tus reglas", "content": "**Tobi, 14:** en su mapa están su abuelo, el entrenador de básquet y la orientadora del colegio.\n\n**Tu mapa, tus reglas.** Si alguien te lastima o te da miedo, no tiene que estar en tu mapa." }, { "id": "zona_contar", "type": "list", "prompt": "¿A quién le puedo contar algo?", "help": "La zona más cercana a vos. Un nombre por renglón.", "count": 3, "min": 1 }, { "id": "zona_ayuda", "type": "list", "prompt": "¿A quién le puedo pedir ayuda?", "help": "La zona del medio. Un nombre por renglón.", "count": 3, "min": 1 }, { "id": "zona_profesionales", "type": "list", "prompt": "Profesionales y adultos responsables: ¿quiénes son?", "help": "La zona de afuera. Por ejemplo, tu psicólogo/a, un profe, el orientador o la orientadora, un médico o una médica, tu entrenador/a.\n\nRecordá la meta: al menos 2 adultos en todo tu mapa.", "count": 3, "min": 1 }, { "id": "meta", "type": "choice", "prompt": "¿Llegaste a la meta de al menos 2 adultos en tu mapa?", "options": [ "Sí", "Todavía no" ], "feedback": { "Sí": "**¡Bien!** Tenés más de un adulto a quien recurrir. No todas las personas tienen que poder ayudarte con todo.", "Todavía no": "**Está bien: es un punto de partida.** Pensá quiénes pueden ser personas seguras fuera de tu casa: un profe, el orientador o la orientadora, tu entrenador/a, un vecino o una vecina de confianza, alguien del club, de la iglesia o del barrio. Si se te ocurre alguien, tocá «Atrás» y sumalo.\n\nSi querés, pensalo con tu psicólogo/a." } }, { "id": "temas_intro", "type": "info", "title": "¿Quién puede ayudarme con…?", "content": "Ahora pensá en temas concretos. Para cada uno, anotá una persona y cómo la contactás (en persona, por mensaje, en el colegio…).\n\nSi un tema no tiene que ver con vos, podés saltearlo." }, { "id": "tema_tristeza", "type": "text", "prompt": "Tristeza: ¿quién te puede ayudar y cómo la contactás?", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "tema_bullying", "type": "text", "prompt": "Bullying: ¿quién te puede ayudar y cómo la contactás?", "help": "Si ya armaste tu plan anti-bullying en «Cuando otros me hacen sentir menos», podés usar lo que anotaste ahí.", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "tema_casa", "type": "text", "prompt": "Problemas en casa: ¿quién te puede ayudar y cómo la contactás?", "help": "Si en tu casa no hay alguien así, o alguien te lastima o te da miedo, pensá en un adulto seguro de afuera.", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "tema_colegio", "type": "text", "prompt": "El colegio: ¿quién te puede ayudar y cómo la contactás?", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "tema_consumo", "type": "text", "prompt": "Consumo (POD, alcohol u otras): ¿quién te puede ayudar y cómo la contactás?", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "tema_crisis", "type": "text", "prompt": "Una crisis: ¿quién te puede ayudar y cómo la contactás?", "help": "Para los momentos muy difíciles está también «Mi plan para momentos muy difíciles», en **Calmarme**: si ya lo armaste, lo abrís con «Ver mi plan»; si no, lo armás con «Armar mi plan».\n\nSi estás en peligro ahora, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos.", "placeholder": "Persona y cómo la contacto", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Mi red de apoyo", "template": "Le puedo contar algo a: {{zona_contar}}. Le puedo pedir ayuda a: {{zona_ayuda}}. Profesionales y adultos responsables: {{zona_profesionales}}.", "content": "**Tu mapa, tus reglas.** Cuando toques «Terminar», queda guardado junto con a quién recurrir en cada tema, y lo vas a poder volver a ver en este ejercicio, en «Mis respuestas»." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 10 minutos.** Hablá con uno de los adultos de tu mapa, del tema que vos elijas.\n\nSi te está pasando algo de lo que viste en «Cuando otros me hacen sentir menos», ese es el tema." } ]$steps$::jsonb),
  ('brujula-pod-vape-presion', 'POD, vape y presión de grupo', 'Entendé cómo funcionan las ganas, surfeá la ola con un plan de 10 minutos y practicá cómo decir que no.', 'custom', 'general', 'adolescentes', 'brujula', 18, 112,
   $steps$[ { "id": "intro", "type": "info", "title": "POD, vape y presión de grupo", "content": "**Tener ganas no es ser débil: es la forma en que aprende el cerebro.**\n\nSi no usás POD, este ejercicio igual te sirve: practicá cómo decir que no, o usalo con otra costumbre que te cueste frenar, como el celular." }, { "id": "nicotina", "type": "info", "title": "Cómo aprende el cerebro", "content": "Los POD suelen tener nicotina. La nicotina da un alivio rápido porque activa el sistema de recompensa del cerebro, y el cerebro aprende: «cuando me siento así, uso el POD».\n\nCon el tiempo, las ganas pueden aparecer más seguido y puede hacer falta más para sentir lo mismo. **Eso es la dependencia.**" }, { "id": "cadena", "type": "info", "title": "La cadena", "content": "**Disparador**\n↓\n**Pensamiento o emoción**\n↓\n**Ganas de vapear**\n↓\n**Uso el POD**\n↓\n**Alivio breve**\n\n…y la próxima vez es más probable que se repita." }, { "id": "vale_quiz", "type": "choice", "prompt": "En la cadena de Vale, ¿qué es «me relaja, me lo merezco»?", "help": "**Vale, 17:** vapea en la previa con sus amigas y antes de los exámenes. Piensa: «me relaja, me lo merezco». Ganas: 8 de 10.", "options": [ "Un disparador", "Un pensamiento", "Las ganas" ], "feedback": { "Un disparador": "**No: es un pensamiento.** Los disparadores de Vale son la previa con sus amigas y los momentos antes de los exámenes. Después aparece lo que piensa, «me relaja, me lo merezco», y las ganas llegan a 8 de 10.", "Un pensamiento": "**¡Bien! Es un pensamiento.** Los disparadores de Vale son la previa con sus amigas y los momentos antes de los exámenes. Después aparece lo que piensa, «me relaja, me lo merezco», y las ganas llegan a 8 de 10.", "Las ganas": "**No: es un pensamiento.** Las ganas son lo que Vale mide de 0 a 10, y llegan a 8. «Me relaja, me lo merezco» es lo que piensa entre el disparador (la previa o los exámenes) y las ganas." } }, { "id": "ola", "type": "info", "title": "Surfear la ola", "content": "Las ganas son como una ola: suben, llegan a un pico y bajan, aunque no hagas nada.\n\n**Aparecen → Suben → Llegan a un pico → Bajan → Pasan**\n\nNo hace falta que desaparezcan: alcanza con no seguirlas. Mientras tanto, observalas: ¿dónde las sentís? ¿Cuánto miden, de 0 a 10?" }, { "id": "plan_10", "type": "checklist", "prompt": "Mi plan de 10 minutos: ¿qué vas a hacer cuando aparezcan las ganas?", "help": "Marcá todo lo que pienses usar mientras pasa la ola.\n\nPara respirar lento podés usar «Respiración guiada», en **Calmarme**.", "options": [ "Espero 10 minutos (miro la hora)", "Me cambio de lugar", "Respiro lento", "Hago otra cosa con las manos o con el cuerpo", "Le escribo o hablo con alguien" ], "min": 1 }, { "id": "ganas_antes", "type": "scale", "prompt": "Ganas antes: ¿cuánto miden, de 0 a 10?", "help": "Completalo si tenés ganas ahora y vas a probar el plan. Si no, tocá «Saltar»: lo podés completar la próxima vez que hagas este ejercicio.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimas", "optional": true }, { "id": "espera", "type": "timed_info", "title": "Espero 10 minutos", "content": "Si tenés ganas ahora, mirá la hora e iniciá el temporizador de 10 minutos. Mientras tanto, hacé lo que marcaste en tu plan. Si dejás el celular o salís de la app, guiate por la hora.\n\nObservá la ola: sube, llega a un pico y baja.\n\nSi ahora no tenés ganas, tocá «Continuar».", "seconds": 600 }, { "id": "ganas_despues", "type": "scale", "prompt": "A los 10 minutos: ¿cuánto miden las ganas?", "help": "Comparalo con lo que marcaste antes. Si no probaste el plan todavía, tocá «Saltar».", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimas", "optional": true }, { "id": "disparadores_intro", "type": "info", "title": "Mis disparadores", "content": "Ahora pensá en **una** vez que tuviste ganas y anotala paso a paso, como en la cadena.\n\nSi no usás POD, pensá en una vez que te ofrecieron, o en esa otra costumbre que te cuesta frenar." }, { "id": "disp_situacion", "type": "text", "prompt": "¿Cuál fue la situación?", "help": "Dónde estabas y qué estaba pasando. Para Vale: la previa, o antes de un examen." }, { "id": "disp_con_quien", "type": "text", "prompt": "¿Con quién estabas?", "help": "Vale, en la previa: con sus amigas." }, { "id": "disp_sentia", "type": "checklist", "prompt": "¿Qué sentías?", "help": "Elegí hasta 3 palabras.", "options": [ "Bronca", "Tristeza", "Miedo", "Vergüenza", "Culpa", "Nervios", "Soledad", "Frustración", "Celos", "Alegría", "Calma", "Orgullo" ], "min": 1, "max": 3 }, { "id": "disp_pense", "type": "text", "prompt": "¿Qué pensaste?", "help": "Vale pensó: «me relaja, me lo merezco»." }, { "id": "disp_ganas", "type": "scale", "prompt": "¿Cuántas ganas tenías, de 0 a 10?", "help": "Vale: 8 de 10.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Muchísimas" }, { "id": "disp_hice", "type": "text", "prompt": "¿Qué hiciste?", "help": "Sin juzgarte: solo anotá qué pasó." }, { "id": "decir_no", "type": "checklist", "prompt": "Decir que no sin quedar afuera: ¿qué frases te sirven?", "help": "Marcá las que te salgan más naturales. Si ninguna te sirve, seguí: en la próxima pantalla escribís la tuya.", "options": [ "«No, gracias, estoy bien así.»", "«Hoy paso, mañana tengo partido.»", "«No me pinta, pero me quedo un rato.»", "Cambiar de tema o proponer otra cosa: «¿Salimos a caminar?»" ], "optional": true }, { "id": "mi_frase", "type": "text", "prompt": "Mi frase: ¿qué vas a decir la próxima vez?", "help": "Puede ser una de estas con tus palabras, o una tuya." }, { "id": "me_da", "type": "text", "prompt": "¿Qué te da el POD?", "help": "Si no usás POD, pensalo con esa costumbre que te cuesta frenar, o salteá esta pregunta.", "optional": true }, { "id": "me_cuesta", "type": "text", "prompt": "¿Y qué te cuesta el POD?", "optional": true, "help": "Lo que te quita o te complica. Si no usás POD, pensalo con esa otra costumbre, o salteá esta pregunta." }, { "id": "desliz_intro", "type": "info", "title": "Si vuelvo a hacerlo", "content": "**Un desliz no borra todo lo que avanzaste.** Usalo para aprender.\n\nSi tuviste un desliz, respondé estas tres preguntas. Si no, podés saltearlas y volver cuando lo necesites." }, { "id": "desliz_antes", "type": "text", "prompt": "¿Qué pasó antes?", "optional": true }, { "id": "desliz_aprendi", "type": "text", "prompt": "¿Qué aprendiste?", "optional": true }, { "id": "desliz_proxima", "type": "text", "prompt": "¿Qué vas a probar la próxima vez?", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Lo que armaste", "template": "Mi plan de 10 minutos: {{plan_10}}. Un disparador: «{{disp_situacion}}», y pensé: «{{disp_pense}}». Mi frase para decir que no: «{{mi_frase}}».", "content": "**Tener ganas no es ser débil: es la forma en que aprende el cerebro.**\n\nCuando toques «Terminar», todo queda guardado y lo vas a poder volver a ver en este ejercicio, en «Mis respuestas»." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 10 minutos.** Anotá tus ganas 3 veces y probá el plan de 10 minutos una vez. Si no usás POD, practicá tu frase.\n\nCada vez, anotá lo mismo que en «Mis disparadores»: la situación, con quién estabas, qué sentías, qué pensaste, las ganas de 0 a 10 y qué hiciste.\n\nPodés anotarlo en «Registrar cómo me siento»: la situación, con quién estabas y las ganas van en «¿Qué estaba pasando?». También podés volver a hacer este ejercicio.\n\nSi el consumo te preocupa o te sentís muy mal, hablalo con tu psicólogo/a o con un adulto de «Mi red de apoyo». Para los momentos muy difíciles está «Mi plan para momentos muy difíciles», en **Calmarme**." } ]$steps$::jsonb),
  ('brujula-plan-momentos-dificiles', 'Mi plan para momentos muy difíciles', 'Armá con tu psicólogo/a un plan para ganar tiempo y conectar con ayuda en los momentos más difíciles.', 'custom', 'general', 'adolescentes', 'brujula', 15, 113,
   $steps$[ { "id": "para_que", "type": "info", "title": "Mi plan para momentos muy difíciles", "content": "**Un plan para ganar tiempo y conectar con ayuda.**\n\nEste plan lo armás con tu psicólogo/a y, si se puede, con un adulto de confianza. No reemplaza una evaluación profesional.\n\nTiene seis partes. Si alguna te cuesta, la completás en la sesión con tu psicólogo/a." }, { "id": "pedi_ayuda_ya", "type": "info", "title": "Pedí ayuda ya si…", "content": "**Pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano, si:**\n\n- pensás en quitarte la vida y tenés intención o un plan;\n- te hiciste daño o tomaste algo para hacerte daño;\n- estás intoxicado/a o tenés una lesión importante;\n- sentís que no podés mantenerte a salvo.\n\n**Para hablar con alguien ahora**, en el recuadro «Si necesitás ayuda urgente» de **Calmarme** están las líneas de ayuda que dejó cargadas tu psicólogo/a.\n\nEn la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "senales", "type": "list", "prompt": "Señales de que estoy empezando a estar mal", "help": "**Parte 1 de 6.** Una señal por renglón: algo que notás en tu cuerpo, en lo que pensás o en lo que hacés.\n\nPodés usar tus señales de «Cuando la emoción sube a 100».", "count": 4, "min": 1 }, { "id": "cosas_solo", "type": "list", "prompt": "Cosas que puedo hacer solo/a para ganar tiempo", "help": "**Parte 2 de 6.** Una por renglón. Por ejemplo, algo de tu caja de herramientas de «Cuando la emoción sube a 100» o de **Calmarme**.", "count": 4, "min": 1 }, { "id": "lugares_personas", "type": "list", "prompt": "Lugares y personas que me ayudan a distraerme o calmarme", "help": "**Parte 3 de 6.** Uno por renglón.", "count": 4, "min": 1 }, { "id": "adultos", "type": "list", "prompt": "Adultos a quienes les puedo pedir ayuda", "help": "**Parte 4 de 6.** En cada renglón, el **nombre** y el **teléfono** de un adulto.\n\nPodés usar los adultos de tu mapa de «Mi red de apoyo».", "count": 4, "min": 1 }, { "id": "psicologo", "type": "text", "prompt": "Profesionales y servicios: mi psicólogo/a", "help": "**Parte 5 de 6.** Su nombre y su teléfono.\n\nLos teléfonos de emergencia y de las líneas de ayuda están en **Calmarme**, en el recuadro «Si necesitás ayuda urgente»: copialos también en tu papel.", "placeholder": "Nombre y teléfono…", "optional": true }, { "id": "guardia", "type": "text", "prompt": "Profesionales y servicios: guardia del hospital más cercano", "help": "**Parte 5 de 6.** Cuál es y su teléfono.", "placeholder": "Hospital y teléfono…", "optional": true }, { "id": "otro_servicio", "type": "text", "prompt": "Profesionales y servicios: otro servicio", "help": "**Parte 5 de 6.** Si hay otro servicio que te pueda ayudar, su nombre y su teléfono.", "placeholder": "Servicio y teléfono…", "optional": true }, { "id": "entorno", "type": "text", "prompt": "Cómo hacer mi entorno más seguro: lo acordé con…", "help": "**Parte 6 de 6.** Acordá con un adulto de confianza que guarde lo que podría usarse para hacerte daño. Escribí con quién lo acordaste.\n\nSi todavía no lo acordaste con nadie, hablalo con tu psicólogo/a.", "placeholder": "Lo acordé con…", "optional": true }, { "id": "importa", "type": "text", "prompt": "Algo que me importa y me ayuda a seguir", "help": "Podés mirar tu brújula de «Lo que realmente me importa».", "optional": true }, { "id": "si_peligro", "type": "info", "title": "Algo importante", "content": "Si tu psicólogo/a cree que estás en peligro, va a buscar ayuda con un adulto responsable. Siempre que se pueda, lo va a hablar antes con vos." }, { "id": "mi_plan", "type": "reflect", "title": "Mi plan", "template": "Mis señales de que estoy empezando a estar mal: {{senales}} — Lo que puedo hacer solo/a para ganar tiempo: {{cosas_solo}} — Lugares y personas que me ayudan a distraerme o calmarme: {{lugares_personas}} — Adultos a quienes les puedo pedir ayuda: {{adultos}}", "content": "Acá ves las primeras cuatro partes. Cuando toques «Terminar», en la próxima pantalla, el plan completo queda guardado en este ejercicio, en «Mis respuestas».\n\nTu psicólogo/a lo puede ver en la app si tenés activado **«Compartir mis registros con mi psicólogo»** en tu perfil." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "**Unos 10 minutos.** Copiá este plan en un papel que tengas siempre a mano. Sumale los teléfonos del recuadro «Si necesitás ayuda urgente», en **Calmarme**.\n\nAl tocar «Terminar», el plan queda guardado en la app y lo abrís rápido desde **Calmarme**, con «Ver mi plan». Si cambia algo, como una persona o un teléfono, tocá «Actualizarlo» ahí mismo y armalo de nuevo.\n\n**Si estás en peligro ahora**, pedí ayuda ya a un adulto, a emergencias o en la guardia del hospital más cercano." } ]$steps$::jsonb),
  ('brujula-lo-que-aprendi', 'Lo que aprendí y mi plan para seguir', 'Mirá cuánto recorriste, elegí tus herramientas y armá tu plan para seguir.', 'custom', 'general', 'adolescentes', 'brujula', 15, 114,
   $steps$[ { "id": "intro", "type": "info", "title": "Lo que aprendí y mi plan para seguir", "content": "**Mirá cuánto recorriste.**\n\nPrimero vas a comparar cómo estás ahora con cómo estabas al empezar. Después vas a pensar qué aprendiste, elegir tus herramientas y armar tu plan para seguir." }, { "id": "antes_ahora", "type": "info", "title": "Antes y ahora", "content": "Son las mismas siete preguntas de «Mi punto de partida», de 0 a 10.\n\nSi hiciste ese ejercicio en la app, lo que contestaste está ahí, en «Mis respuestas». Miralo cuando termines para comparar.\n\n**Si algo no cambió o empeoró, no es un fracaso: es información para seguir.**" }, { "id": "ahora_animo", "type": "scale", "prompt": "¿Cómo estoy ahora de ánimo?", "help": "Elegí un número: 0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "ahora_nervios", "type": "scale", "prompt": "¿Cómo estoy ahora con los nervios o la ansiedad?", "help": "Acá el 0 es «me desbordan» y el 10 es «los manejo bien».", "min": 0, "max": 10, "min_label": "Me desbordan", "max_label": "Los manejo bien", "optional": true }, { "id": "ahora_relaciones", "type": "scale", "prompt": "¿Cómo estoy ahora en mis relaciones?", "help": "Amigos, compañeros. 0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "ahora_familia", "type": "scale", "prompt": "¿Cómo estoy ahora con mi familia?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "ahora_colegio", "type": "scale", "prompt": "¿Cómo estoy ahora en el colegio?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "ahora_confianza", "type": "scale", "prompt": "¿Cómo estoy ahora con la confianza en mí?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "ahora_emociones", "type": "scale", "prompt": "¿Cómo estoy ahora con el manejo de mis emociones?", "help": "0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien", "optional": true }, { "id": "entendi", "type": "text", "prompt": "¿Qué entendí sobre mí?", "help": "Ahora, cinco preguntas para mirar lo que aprendiste. Escribí como te salga." }, { "id": "funciona_mejor", "type": "text", "prompt": "¿Qué herramienta me funciona mejor?", "help": "Puede ser de cualquier ejercicio de Brújula o de **Calmarme**." }, { "id": "siguen_dificiles", "type": "text", "prompt": "¿Qué situaciones siguen siendo difíciles?" }, { "id": "pedir_ayuda", "type": "text", "prompt": "¿Cuándo sé que necesito pedir ayuda?", "help": "Podés mirar tus señales en «Mi plan para momentos muy difíciles»." }, { "id": "seguir_practicando", "type": "text", "prompt": "¿Qué quiero seguir practicando?" }, { "id": "herramientas", "type": "list", "prompt": "Mis 5 herramientas", "help": "Una por renglón, con el nombre del ejercicio donde está. Por ejemplo: STOP, de «Cuando la emoción sube a 100».", "count": 5, "min": 1 }, { "id": "sentir_mal_intro", "type": "info", "title": "Si me empiezo a sentir mal otra vez", "content": "Vas a armar una frase en tres partes:\n\n- **Si noto…**\n- **voy a…**\n- **y voy a hablar con…**" }, { "id": "si_noto", "type": "text", "prompt": "Si noto…", "help": "Completá la frase con una señal de que estás empezando a estar mal: en tu cuerpo, en lo que pensás o en lo que hacés.", "placeholder": "Por ejemplo: que me encierro en la pieza…" }, { "id": "voy_a", "type": "text", "prompt": "voy a…", "help": "Algo que vas a hacer: por ejemplo, una de tus herramientas.", "placeholder": "Por ejemplo: usar STOP…" }, { "id": "hablar_con", "type": "text", "prompt": "y voy a hablar con…", "help": "Una persona de confianza. Podés mirar tu mapa de «Mi red de apoyo».", "placeholder": "Por ejemplo: la orientadora…" }, { "id": "frase", "type": "reflect", "title": "Si me empiezo a sentir mal otra vez", "template": "Si noto {{si_noto}}, voy a {{voy_a}} y voy a hablar con {{hablar_con}}." }, { "id": "proximo_paso", "type": "text", "prompt": "Mi próximo paso", "help": "Algo concreto, que se pueda ver desde afuera.", "placeholder": "Mi próximo paso es…" }, { "id": "resumen", "type": "reflect", "title": "Mirá cuánto recorriste", "template": "Lo que entendí sobre mí: «{{entendi}}» — Lo que quiero seguir practicando: «{{seguir_practicando}}» — Mis herramientas: {{herramientas}} — Mi próximo paso: «{{proximo_paso}}»", "content": "Cuando toques «Terminar», en la próxima pantalla, todo queda guardado en este ejercicio, en «Mis respuestas». Para comparar, mirá también tus respuestas de «Mi punto de partida»." }, { "id": "recorda", "type": "info", "title": "Recordá", "content": "**Pedir ayuda también es una habilidad.**\n\nSi un día lo necesitás, en **Calmarme** están «Mi plan para momentos muy difíciles» y el recuadro «Si necesitás ayuda urgente»." } ]$steps$::jsonb),
  ('brujula-registro-actividad', 'Registro de actividad', 'Anotá una actividad de tu plan: tu ánimo antes y después, y cuánto logro sentiste.', 'custom', 'tcc', 'adolescentes', 'brujula', 3, 150,
   $steps$[ { "id": "intro", "type": "info", "title": "Mi plan de 7 días", "content": "Usá este registro cada vez que hagas una actividad de tu plan de «Cuando me quiero aislar». Lleva unos 3 minutos.\n\n**La meta de la semana:** al menos 3 actividades del plan, anotando tu ánimo antes y después.\n\nCon el ánimo bajo, muchas veces primero viene la acción y después, de a poco, las ganas." }, { "id": "activity", "type": "text", "prompt": "¿Qué actividad hiciste?", "help": "Por ejemplo: caminar o andar en bici, tomar tereré con alguien, ordenar tu espacio o estudiar 15 minutos.", "placeholder": "Lo que hice" }, { "id": "type", "type": "checklist", "prompt": "¿Qué tipo de actividad fue?", "help": "Puede ser más de uno.", "options": [ "P: placer, algo que disfrutás", "L: logro, algo que cuesta un poco y te deja conforme", "C: conexión, algo con otra persona" ] }, { "id": "mood_before", "type": "scale", "prompt": "¿Cómo estaba tu ánimo antes?", "help": "De 0 a 10: 0 es muy mal y 10 es muy bien.", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien" }, { "id": "mood_after", "type": "scale", "prompt": "¿Y cómo quedó tu ánimo después?", "min": 0, "max": 10, "min_label": "Muy mal", "max_label": "Muy bien" }, { "id": "achievement", "type": "scale", "prompt": "¿Cuánto logro sentiste?", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Mucho" }, { "id": "discovered", "type": "text", "prompt": "¿Qué descubriste?", "help": "¿Cambió algo en tu ánimo? ¿Te costó empezar? Si no cambió nada, también es información.", "optional": true }, { "id": "summary", "type": "reflect", "title": "Tu registro", "template": "Hice: {{activity}}", "content": "Cuando toques «Terminar», queda guardado en «Mis respuestas», con tu ánimo de antes y de después.\n\nTraelo a la sesión: nos ayuda a ver qué te sirve." } ]$steps$::jsonb),
  ('tcc-antes-de-empezar', 'Antes de empezar', 'Conocé qué vas a aprender, por qué funciona la TCC, qué dice la evidencia y cómo usar el cuadernillo.', 'custom', 'tcc', 'adultos', 'tcc', 6, 200,
   $steps$[ { "id": "bienvenida", "type": "info", "title": "Antes de empezar", "content": "Este cuadernillo es una guía práctica para entender cómo pensamos, cómo eso influye en lo que sentimos y hacemos, y cómo podemos aprender a intervenir sobre ese proceso.\n\nEstá escrito en dos niveles al mismo tiempo: uno cercano, para cualquier persona que quiera empezar a trabajar sobre su bienestar, y otro más técnico, para estudiantes y colegas en formación. En la app, la parte técnica aparece en pantallas tituladas **«Para profundizar»**." }, { "id": "que_vas_a_aprender", "type": "info", "title": "¿Qué vas a aprender?", "content": "A lo largo de estos capítulos vas a recorrer, paso a paso, las herramientas centrales de la Terapia Cognitivo-Conductual (TCC).\n\nCada capítulo combina:\n\n- una explicación simple;\n- una explicación clínica;\n- señales para reconocer el fenómeno en la vida diaria;\n- ejemplos;\n- un caso desarrollado;\n- un ejercicio guiado;\n- hojas de trabajo para completar." }, { "id": "temas", "type": "info", "title": "Los siete temas", "content": "- **El modelo cognitivo:** cómo la interpretación de una situación —y no la situación en sí— moldea la emoción y la conducta.\n- **Los pensamientos automáticos:** esas ideas rápidas que aparecen sin que las llamemos y tiñen nuestro estado de ánimo.\n- **Las distorsiones cognitivas:** los errores sistemáticos con los que la mente deforma la información.\n- **Las creencias intermedias y nucleares:** las reglas profundas desde las que interpretamos el mundo.\n- **El cuestionamiento socrático y la reestructuración cognitiva:** cómo poner a prueba un pensamiento y construir alternativas más útiles y ajustadas.\n- **El modelo ABC de Ellis:** una forma complementaria de mirar el mismo proceso.\n- **La tríada cognitiva y la activación conductual:** cómo entender la depresión y cómo salir del círculo de la inactividad." }, { "id": "por_que", "type": "info", "title": "¿Por qué funcionan estas herramientas?", "content": "La idea central de la TCC es sencilla de enunciar y poderosa en la práctica: entre lo que nos pasa y lo que sentimos hay siempre un paso intermedio, **la interpretación**.\n\nNo reaccionamos a los hechos en bruto, sino al significado que les damos. Como ese significado puede aprenderse, examinarse y modificarse, también puede cambiar la forma en que nos sentimos y actuamos." }, { "id": "como_usar", "type": "info", "title": "Cómo usar este cuadernillo", "content": "Cada capítulo es un ejercicio de esta colección y termina con preguntas para completar, tareas para casa y preguntas de reflexión. El material rinde cuando lo completás, no solo cuando lo leés.\n\nAvanzá a tu ritmo: podés dedicar una semana a cada capítulo.\n\nDespués de los capítulos vienen los **registros** (las hojas de los anexos del cuadernillo): podés repetirlos las veces que quieras.\n\n**Si sos terapeuta en formación:** podés usar las hojas y los casos como recursos para sesión y como plantillas para tus pacientes." }, { "id": "tus_respuestas", "type": "info", "title": "Tus respuestas", "content": "Lo que escribís en un ejercicio se guarda cuando tocás **«Terminar»**, en la última pantalla. Si lo dejás por la mitad, no se guarda.\n\nPara volver a verlo, entrá al ejercicio y abrí **«Mis respuestas»**. Cada vez que repetís un ejercicio, empieza en blanco y se guarda aparte.\n\nSi en tu perfil está activado **«Compartir mis registros con mi psicólogo»** (viene activado), tu psicólogo también puede ver tus respuestas. Si lo desactivás, solo vos las ves. Podés cambiarlo cuando quieras." }, { "id": "evidencia", "type": "info", "title": "La evidencia detrás de la TCC", "content": "La Terapia Cognitivo-Conductual es uno de los enfoques psicoterapéuticos más estudiados.\n\nNació del trabajo de Aaron T. Beck en la depresión durante los años sesenta y setenta, y del modelo racional-emotivo de Albert Ellis, desarrollado en paralelo desde mediados de los cincuenta. Desde entonces se ha investigado y refinado para un amplio rango de problemas." }, { "id": "evidencia_estudios", "type": "info", "title": "Para profundizar: qué dicen los estudios", "content": "Revisiones y metaanálisis han mostrado que la TCC produce beneficios clínicamente relevantes en depresión y en los trastornos de ansiedad, con tamaños de efecto que suelen ubicarse en el rango moderado a grande según el problema y la comparación empleada.\n\nGuías de práctica como las del National Institute for Health and Care Excellence (NICE) del Reino Unido la recomiendan como tratamiento de primera línea para varios cuadros, y organismos como la American Psychological Association (APA) la incluyen entre los tratamientos con apoyo empírico." }, { "id": "aclaracion", "type": "info", "title": "Una aclaración honesta sobre la evidencia", "content": "La TCC es eficaz para muchas personas, pero **no es mágica ni universal**. Su efecto varía según el problema, la calidad del vínculo terapéutico y el compromiso con la práctica.\n\nEste cuadernillo es un recurso psicoeducativo y de autoayuda guiada; no reemplaza una evaluación ni un tratamiento profesional. Si atravesás un malestar intenso o persistente, buscá acompañamiento.\n\nEn caso de crisis, pedí ayuda ya a una línea de ayuda, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "faq_1", "type": "info", "title": "Preguntas frecuentes (1 de 2)", "content": "**¿Esto reemplaza a la terapia?**\n\nNo. Es un recurso de psicoeducación y autoayuda guiada. Puede acompañar un proceso terapéutico o ayudarte a empezar a observar tu funcionamiento, pero no sustituye una evaluación ni un tratamiento profesional.\n\n**¿Tengo que hacer todos los ejercicios?**\n\nCuantos más hagas, más vas a notar el cambio. Si tenés poco tiempo, priorizá el «Registro de pensamientos (RPD)», el «Registro ABC» y la hoja de reestructuración de «Cuestionamiento socrático y reestructuración»: son el corazón del método." }, { "id": "faq_2", "type": "info", "title": "Preguntas frecuentes (2 de 2)", "content": "**¿Y si un pensamiento no cambia por más que lo cuestiono?**\n\nEs normal. Algunos pensamientos se sostienen en creencias profundas (lo vas a ver en «Creencias intermedias y nucleares») o necesitan un experimento en la vida real, no solo un debate mental. La constancia y, si hace falta, el acompañamiento profesional marcan la diferencia.\n\n**¿Esto es «pensar en positivo»?**\n\nNo. Buscamos pensamientos ajustados y creíbles, no optimistas a la fuerza. La meta es ver la realidad completa —lo bueno y lo malo— en lugar de solo la mitad negativa." }, { "id": "mapa", "type": "info", "title": "Un mapa del recorrido", "content": "- **1. El modelo cognitivo:** entender la relación situación–pensamiento–emoción–conducta–fisiología.\n- **2. Los pensamientos automáticos:** detectar y registrar las ideas rápidas que disparan el malestar.\n- **3. Las distorsiones cognitivas:** reconocer los errores típicos del pensamiento.\n- **4. Creencias intermedias y nucleares:** llegar a las reglas y creencias de fondo.\n- **5. Cuestionamiento socrático y reestructuración:** poner a prueba pensamientos y construir alternativas.\n- **6. El modelo ABC de Ellis:** una mirada complementaria del mismo proceso.\n- **7. Tríada cognitiva y activación conductual:** comprender la depresión y volver a la acción.\n\nDespués vienen los registros para repetir y, para consultar, «50 preguntas socráticas» y el «Glosario de TCC»." }, { "id": "empezar", "type": "choice", "prompt": "¿Por qué capítulo te gustaría empezar?", "help": "No hay respuesta correcta: es para que lo hables con tu psicólogo. Los capítulos están pensados para recorrerse paso a paso, en orden.", "optional": true, "options": [ "1. El modelo cognitivo", "2. Los pensamientos automáticos", "3. Las distorsiones cognitivas", "4. Creencias intermedias y nucleares", "5. Cuestionamiento socrático y reestructuración", "6. El modelo ABC de Ellis", "7. Tríada cognitiva y activación conductual", "Todavía no lo sé" ] }, { "id": "siguiente", "type": "info", "title": "Tu próximo paso", "content": "Cuando quieras, seguí con el capítulo 1, **«El modelo cognitivo»**: los capítulos se apoyan uno en el otro y conviene recorrerlos en orden. Si te interesa más otro tema, hablalo con tu psicólogo.\n\nAvanzá a tu ritmo y llevá tus dudas a la próxima sesión." } ]$steps$::jsonb),
  ('tcc-modelo-cognitivo', 'El modelo cognitivo', 'Entendé cómo la interpretación de lo que pasa moldea lo que sentís y hacés, y hacé tu primer desglose.', 'custom', 'tcc', 'adultos', 'tcc', 15, 201,
   $steps$[ { "id": "intro", "type": "info", "title": "El modelo cognitivo de Beck", "content": "No nos alteran las cosas que pasan, sino **la lectura que hacemos de ellas**.\n\nEse es el corazón del modelo que Aaron T. Beck construyó a partir de su trabajo con personas con depresión." }, { "id": "ruido", "type": "info", "title": "Un ruido de noche", "content": "Imaginá que estás en casa de noche y escuchás un ruido fuerte.\n\nSi pensás «entró alguien», vas a sentir miedo, el corazón se acelera y quizás buscás algo para defenderte. Si pensás «fue el gato que tiró algo», te quedás tranquilo y seguís con lo tuyo.\n\nEl ruido fue el mismo; lo que cambió fue el pensamiento. Y ese pensamiento cambió la emoción, el cuerpo y la conducta.\n\nEl modelo cognitivo dice justamente eso: entre lo que ocurre y lo que sentimos siempre se cuela una interpretación. Muchas veces es tan rápida y automática que ni la notamos, pero está ahí, dirigiendo la escena." }, { "id": "esquema", "type": "info", "title": "El esquema básico", "content": "**Situación → Pensamiento → Emoción + Respuesta física → Conducta**\n\nEl pensamiento es la bisagra. Trabajar sobre él es trabajar sobre todo lo demás.\n\nEn el ejemplo del ruido:\n\n- **Situación:** un ruido fuerte, de noche, en casa.\n- **Pensamiento:** «entró alguien».\n- **Emoción:** miedo.\n- **Respuesta física:** el corazón se acelera.\n- **Conducta:** buscás algo para defenderte." }, { "id": "clinica_1", "type": "info", "title": "Para profundizar (opcional, 1 de 2)", "content": "Esta pantalla y la siguiente son la explicación clínica, más técnica. Si preferís, salteá las dos.\n\nEl modelo cognitivo propone que el procesamiento de la información media la respuesta emocional y conductual. Ante un estímulo (interno o externo), la persona activa **esquemas** —estructuras cognitivas de significado— que orientan la atención, la interpretación y la memoria, y que se expresan en pensamientos automáticos situacionales. Estos pensamientos generan respuestas emocionales, fisiológicas y conductuales que, a su vez, retroalimentan el sistema." }, { "id": "clinica_2", "type": "info", "title": "Para profundizar (opcional, 2 de 2)", "content": "En su formulación más reciente (Beck y Haigh, 2014), el modelo subraya el carácter continuo entre respuestas normales y disfuncionales: no hay pensamientos «anormales» distintos en naturaleza, sino sesgos de interpretación que, cuando se vuelven rígidos, excesivos o desajustados respecto de la evidencia, sostienen el malestar. El objetivo no es «pensar en positivo», sino recuperar flexibilidad y ajuste.\n\nNiveles de cognición, de menor a mayor profundidad:\n\n- **Pensamientos automáticos:** superficiales, situacionales.\n- **Creencias intermedias:** reglas, supuestos y actitudes.\n- **Creencias nucleares:** esquemas absolutos sobre uno mismo, los demás y el mundo.\n\nLos capítulos siguientes recorren cada nivel." }, { "id": "cotidiano", "type": "checklist", "prompt": "¿Cuáles de estas señales reconocés en tu vida cotidiana?", "help": "Así se reconoce el modelo en acción. Cuando notás un cambio emocional brusco y no sabés bien por qué, casi siempre hubo un pensamiento en el medio. Marcá las que te pasan.", "optional": true, "options": [ "Me cambia la emoción de golpe (angustia, bronca, tristeza) y no sé por qué", "Ante un mismo hecho, otra persona y yo reaccionamos muy distinto", "Mi cuerpo reacciona (tensión, taquicardia, nudo) antes de que pueda nombrar lo que pensé", "Evito, me callo o me voy para aliviar una emoción que apareció «de la nada»" ] }, { "id": "ejemplos_1", "type": "info", "title": "Ejemplos por área (1 de 2)", "content": "Situación → pensamiento → emoción y conducta.\n\n- **Ansiedad.** Suena el teléfono con número desconocido → «Seguro es una mala noticia» → angustia; no atiende.\n- **Depresión.** Un amigo tarda en responder un mensaje → «Se cansó de mí» → tristeza; se aísla.\n- **Pareja.** La pareja llega callada del trabajo → «Está enojada conmigo» → inseguridad; reclama.\n- **Autoestima.** Se equivoca al hablar en una reunión → «Quedé como un tonto» → vergüenza; se calla el resto.\n- **Trabajo.** El jefe pide «hablar un momento» → «Me van a echar» → miedo; no duerme." }, { "id": "ejemplos_2", "type": "info", "title": "Ejemplos por área (2 de 2)", "content": "- **Universidad.** Ve una consigna difícil en el examen → «No voy a poder, soy un desastre» → bloqueo; deja el examen.\n- **Duelo.** Se ríe con amigos tras una pérdida → «No tengo derecho a estar bien» → culpa; se retira.\n- **Perfeccionismo.** Entrega un informe con un error menor → «Está todo arruinado» → frustración; rehace todo.\n- **Ansiedad social.** Alguien no le devuelve el saludo → «Le caigo mal» → malestar; evita cruzarlo.\n- **Autoestima.** Recibe un elogio → «Lo dice por compromiso» → incomodidad; lo minimiza." }, { "id": "errores", "type": "info", "title": "Errores frecuentes", "content": "Qué se confunde y cómo evitarlo:\n\n- **Creer que el modelo dice «la culpa es tuya por pensar mal».** No. Dice que la interpretación influye, no que la persona elige sufrir. Los pensamientos automáticos no se eligen; se aprenden.\n- **Confundirlo con «pensamiento positivo».** El objetivo es pensar de forma más ajustada y flexible, no más optimista a la fuerza.\n- **Saltear la emoción.** Identificar y nombrar la emoción es parte del trabajo, no un paso menor.\n- **Buscar «el» pensamiento correcto.** Suele haber varios pensamientos encadenados; conviene mapearlos todos." }, { "id": "diferencias", "type": "info", "title": "Diferencias con conceptos similares", "content": "- **Situación:** el hecho observable. Es neutral; no contiene interpretación.\n- **Pensamiento:** la lectura que hacemos del hecho. Es lo que cambia entre personas.\n- **Emoción:** la respuesta afectiva (una palabra). Se siente; no se discute como verdadera o falsa.\n- **Conducta:** lo que hacemos. Es observable; suele buscar aliviar la emoción.\n\nEn las próximas pantallas, probá distinguirlos con uno de los ejemplos." }, { "id": "quiz_1", "type": "choice", "prompt": "«Un amigo tarda en responder un mensaje». ¿Qué es?", "help": "Ejemplo del área depresión. 1 de 4.", "options": [ "Situación", "Pensamiento", "Emoción", "Conducta" ], "feedback": { "Situación": "**¡Bien! Es la situación:** el hecho observable. Es neutral; no contiene interpretación.", "Pensamiento": "**Es la situación:** el hecho observable. Es neutral; no contiene interpretación. El pensamiento sería la lectura que hacemos de ese hecho, como «se cansó de mí».", "Emoción": "**Es la situación:** el hecho observable. Una emoción se nombra con una palabra (tristeza, miedo) y se siente; esto es algo que pasó afuera.", "Conducta": "**Es la situación:** el hecho observable, lo que pasó. La conducta es lo que hace la persona después; suele buscar aliviar lo que siente." } }, { "id": "quiz_2", "type": "choice", "prompt": "«Se cansó de mí». ¿Qué es?", "help": "Mismo ejemplo. 2 de 4.", "options": [ "Situación", "Pensamiento", "Emoción", "Conducta" ], "feedback": { "Situación": "**Es un pensamiento:** la lectura que hacemos del hecho. Lo observable es que el amigo tarda en responder; «se cansó de mí» es una interpretación, y es lo que cambia entre personas.", "Pensamiento": "**¡Bien! Es el pensamiento:** la lectura que hacemos del hecho. Es lo que cambia entre personas: frente al mismo mensaje sin respuesta, otra persona podría leerlo de otra manera.", "Emoción": "**Es un pensamiento:** se puede escribir como una frase. La emoción que trae se nombra con una palabra: tristeza.", "Conducta": "**Es un pensamiento:** la lectura que hacemos del hecho. La conducta es lo que la persona hace, y eso se puede observar." } }, { "id": "quiz_3", "type": "choice", "prompt": "«Tristeza». ¿Qué es?", "help": "Mismo ejemplo. 3 de 4.", "options": [ "Situación", "Pensamiento", "Emoción", "Conducta" ], "feedback": { "Situación": "**Es la emoción:** la respuesta afectiva, que se nombra con una palabra. La situación es el hecho de afuera: el amigo que tarda en responder.", "Pensamiento": "**Es la emoción:** se nombra con una sola palabra. El pensamiento es una frase, como «se cansó de mí».", "Emoción": "**¡Bien! Es la emoción:** la respuesta afectiva, en una palabra. Se siente; no se discute como verdadera o falsa.", "Conducta": "**Es la emoción:** se siente por dentro. La conducta es lo que hacemos, y suele buscar aliviar esa emoción." } }, { "id": "quiz_4", "type": "choice", "prompt": "«Se aísla». ¿Qué es?", "help": "Mismo ejemplo. 4 de 4.", "options": [ "Situación", "Pensamiento", "Emoción", "Conducta" ], "feedback": { "Situación": "**Es la conducta:** lo que hace la persona después de pensar «se cansó de mí» y sentirse triste. La situación fue el mensaje sin respuesta.", "Pensamiento": "**Es la conducta:** algo que la persona hace y que se puede observar. El pensamiento fue «se cansó de mí».", "Emoción": "**Es la conducta:** lo que la persona hace. La emoción fue la tristeza; aislarse suele buscar aliviarla.", "Conducta": "**¡Bien! Es la conducta:** lo que hacemos. Es observable y suele buscar aliviar la emoción." } }, { "id": "marcos_1", "type": "info", "title": "Marcos, 34 años (1 de 2)", "content": "**Consulta por ansiedad.**\n\nMarcos llega a sesión angustiado tras una reunión de trabajo. Cuenta: «El gerente miró su celular mientras yo hablaba; supe que lo estaba haciendo mal». Desde entonces evita hablar en reuniones.\n\n**Desglose con el modelo:**\n\n- **Situación:** el gerente mira el celular.\n- **Pensamiento automático:** «lo estoy haciendo mal, no sirvo para esto».\n- **Emoción:** ansiedad y vergüenza.\n- **Respuesta física:** sudoración, voz temblorosa.\n- **Conducta:** acorta su intervención y evita futuras reuniones." }, { "id": "marcos_2", "type": "info", "title": "Marcos, 34 años (2 de 2)", "content": "**Intervención inicial:** el terapeuta no discute si el gerente estaba o no aburrido. Ayuda a Marcos a ver el paso intermedio —el pensamiento— y a considerar lecturas alternativas: «tal vez respondía un mensaje urgente».\n\nEl objetivo de esta primera fase es que Marcos **observe su propio proceso**, no que se convenza de nada." }, { "id": "desglose_intro", "type": "info", "title": "Tu primer desglose", "content": "Elegí un momento reciente en que sentiste una emoción intensa. Vas a desglosarlo paso a paso, como Marcos: situación, emoción, cuerpo, pensamiento y conducta.\n\nEs la hoja de trabajo «mapa situación–pensamiento–emoción» del cuadernillo, una pregunta por vez." }, { "id": "situacion", "type": "text", "prompt": "Describí la situación en una frase, como si fuera una foto", "help": "Qué, quién, cuándo, dónde. Sin interpretaciones. En el caso de Marcos: «el gerente mira el celular»." }, { "id": "emocion", "type": "checklist", "prompt": "¿Qué emoción sentiste?", "help": "Cada emoción se nombra con una sola palabra. Marcá hasta tres. Marcos marcaría ansiedad y vergüenza.", "max": 3, "options": [ "Angustia", "Ansiedad", "Miedo", "Bronca", "Tristeza", "Vergüenza", "Culpa", "Frustración", "Inseguridad", "Incomodidad", "Otra" ] }, { "id": "emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "intensidad", "type": "scale", "prompt": "¿Con qué intensidad la sentiste?", "help": "De 0 a 100. Si marcaste más de una, puntuá la más fuerte.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima" }, { "id": "cuerpo", "type": "text", "prompt": "¿Qué pasó en tu cuerpo?", "help": "Por ejemplo: taquicardia, tensión, nudo en el estómago. Marcos notó sudoración y voz temblorosa." }, { "id": "pensamiento", "type": "text", "prompt": "¿Qué te pasó por la cabeza justo antes de sentir eso?", "help": "Anotá el pensamiento tal cual apareció, con sus palabras. Marcos: «Lo estoy haciendo mal, no sirvo para esto»." }, { "id": "conducta", "type": "text", "prompt": "¿Qué hiciste (o dejaste de hacer) para aliviar la emoción?", "help": "Marcos acortó su intervención y empezó a evitar las reuniones." }, { "id": "otra_lectura", "type": "text", "prompt": "¿Qué otra interpretación sería posible, aunque no la creas del todo?", "help": "Como en el caso de Marcos: «tal vez respondía un mensaje urgente». No se trata de convencerte de nada, sino de ver el paso intermedio. Esto es parte de la tarea de la semana: podés hacerlo ahora o más adelante.", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Tu desglose", "template": "Situación: «{{situacion}}» → Pensamiento: «{{pensamiento}}» → Emoción: {{emocion}} + Cuerpo: «{{cuerpo}}» → Conducta: «{{conducta}}». Otra lectura posible: «{{otra_lectura}}».", "content": "**Situación → Pensamiento → Emoción + Respuesta física → Conducta.** Fijate que el pensamiento quedó en el medio: es la bisagra.\n\nTu desglose se guarda en «Mis respuestas» cuando tocás «Terminar», al final del ejercicio." }, { "id": "reflexion", "type": "info", "title": "Preguntas de reflexión", "content": "- ¿En qué situaciones tu cuerpo reacciona antes de que puedas nombrar lo que pensás?\n- ¿Recordás una vez en que interpretaste algo de un modo y después resultó ser distinto?\n- ¿Qué emociones te cuesta más nombrar?\n- ¿Notás que ciertas situaciones disparan siempre el mismo tipo de pensamiento?\n- ¿Qué conductas usás habitualmente para aliviar emociones incómodas?\n- ¿Cómo sería tu día si pudieras detectar el pensamiento antes de que decida por vos?" }, { "id": "reflexion_respuesta", "type": "text", "prompt": "Si querés, respondé alguna de estas preguntas", "help": "Elegí la que más te resuene y anotá cuál es. Podés llevar tu respuesta a la próxima sesión.", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- No reaccionamos a los hechos, sino a nuestra interpretación de ellos.\n- El esquema básico es: situación → pensamiento → emoción + respuesta física → conducta.\n- El pensamiento es la bisagra: trabajarlo modifica la emoción y la conducta.\n- El objetivo no es pensar en positivo, sino pensar de forma más ajustada y flexible.\n- Hay tres niveles de cognición: pensamientos automáticos, creencias intermedias y creencias nucleares." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "- Repetí este desglose con **tres situaciones distintas** durante la semana, lo antes posible después de que ocurran (unos 5 a 10 minutos cada vez).\n- Elegí una de esas situaciones y anotá una segunda interpretación posible, aunque no la creas del todo.\n- Observá si, al identificar el pensamiento, la emoción cambia aunque sea un poco.\n- Compartí un ejemplo con alguien de confianza y preguntale cómo lo habría interpretado esa persona.\n\nEl próximo capítulo es **«Los pensamientos automáticos»**." } ]$steps$::jsonb),
  ('tcc-pensamientos-automaticos', 'Los pensamientos automáticos', 'Aprendé a atrapar las ideas rápidas que disparan el malestar y registralas en las primeras columnas del RPD.', 'thought_record', 'tcc', 'adultos', 'tcc', 15, 202,
   $steps$[ { "id": "intro", "type": "info", "title": "Los pensamientos automáticos", "content": "Son las ideas rápidas, breves y espontáneas que atraviesan la mente todo el tiempo. No las llamamos; aparecen solas.\n\nAprender a atraparlas es **el primer gran trabajo de la TCC**." }, { "id": "radio", "type": "info", "title": "Una radio de fondo", "content": "Tu mente comenta la realidad sin parar, como una radio de fondo que casi nunca escuchás del todo. Esos comentarios son los pensamientos automáticos.\n\nSuelen ser cortos («no puedo», «me va a salir mal», «no le importo»), pasan muy rápido y los damos por ciertos sin revisarlos.\n\nComo una gota que no notás, pero que repetida termina mojando todo el día." }, { "id": "clinica", "type": "info", "title": "Para profundizar (opcional)", "content": "Es la explicación clínica, más técnica. Si preferís, pasá a la pantalla siguiente.\n\nLos pensamientos automáticos son cogniciones situacionales de nivel superficial que surgen de forma involuntaria ante estímulos concretos. Beck los describió como el nivel más accesible del sistema cognitivo y, por eso, el punto de entrada habitual en terapia. Reflejan el contenido de creencias más profundas, pero se trabajan primero porque son fáciles de detectar y de registrar.\n\nPueden presentarse como una frase, como imágenes mentales o como una mezcla. Su **credibilidad subjetiva** —cuánto los creemos— es una variable clave: no importa solo qué pensamos, sino cuánto lo compramos. Reducir esa credibilidad, más que eliminar el pensamiento, es un objetivo central." }, { "id": "caracteristicas", "type": "info", "title": "Características", "content": "- **Automáticos:** aparecen sin esfuerzo ni intención.\n- **Breves:** suelen ser frases telegráficas o imágenes fugaces.\n- **Plausibles:** se sienten verdaderos, aunque no siempre lo sean.\n- **Involuntarios:** no los elegimos; cuesta apagarlos a voluntad.\n- **Específicos de la situación:** cambian según el contexto que los dispara.\n- **Cargados de emoción:** suelen anteceder o acompañar un cambio afectivo." }, { "id": "pregunta_oro", "type": "info", "title": "La pregunta de oro", "content": "Para identificarlos, la pregunta clave, que vas a usar en todo el cuadernillo, es:\n\n**«¿Qué me pasó por la cabeza justo antes (o durante) el momento en que empecé a sentirme así?»**\n\nCuando cuesta encontrarlo, ayuda:\n\n- recrear la escena con detalle;\n- prestar atención a las imágenes que aparecen;\n- completar frases como «temo que…», «lo que esto significa de mí es…»." }, { "id": "diferencias", "type": "info", "title": "Diferencias con emociones, preocupaciones y rumiaciones", "content": "- **Pensamiento automático:** una idea puntual sobre una situación. Se puede escribir como frase; se refiere a un momento concreto.\n- **Emoción:** un estado afectivo. Se nombra con UNA palabra (miedo, tristeza). No es una frase.\n- **Preocupación:** una cadena de pensamientos «¿y si…?» sobre el futuro. Es anticipatoria y encadenada; busca prevenir una amenaza.\n- **Rumiación:** un repaso repetitivo del pasado o de un problema. Es circular, mira hacia atrás, sobre causas y significados («¿por qué a mí?»)." }, { "id": "regla", "type": "info", "title": "Regla práctica", "content": "- Si lo podés escribir como una oración que empieza con «que…», suele ser un **pensamiento**.\n- Si es una sola palabra, es una **emoción**.\n- Si mira al futuro y se encadena, es **preocupación**.\n- Si mira al pasado y gira en círculo, es **rumiación**.\n\nProbá la regla con cuatro ejemplos." }, { "id": "quiz_1", "type": "choice", "prompt": "«Me va a salir mal». ¿Qué es?", "help": "Aplicá la regla práctica. 1 de 4.", "options": [ "Pensamiento automático", "Emoción", "Preocupación", "Rumiación" ], "feedback": { "Pensamiento automático": "**¡Bien! Es un pensamiento automático:** se puede escribir como frase y se refiere a un momento concreto. Aunque habla del futuro, es una idea puntual: no se encadena en «¿y si…?».", "Emoción": "**Es un pensamiento automático:** es una frase, no una sola palabra. La emoción que lo acompaña sí se nombraría con una palabra, por ejemplo, miedo.", "Preocupación": "**Es un pensamiento automático.** Habla del futuro, pero es una idea puntual sobre un momento concreto. La preocupación es una cadena de «¿y si…?» que busca prevenir una amenaza.", "Rumiación": "**Es un pensamiento automático:** una idea puntual sobre una situación. La rumiación mira hacia atrás y gira en círculo sobre causas y significados («¿por qué a mí?»)." } }, { "id": "quiz_2", "type": "choice", "prompt": "«Angustia». ¿Qué es?", "help": "2 de 4.", "options": [ "Pensamiento automático", "Emoción", "Preocupación", "Rumiación" ], "feedback": { "Pensamiento automático": "**Es una emoción:** es una sola palabra. Un pensamiento se puede escribir como frase; para encontrarlo, usá la pregunta de oro.", "Emoción": "**¡Bien! Es una emoción:** un estado afectivo que se nombra con una sola palabra.", "Preocupación": "**Es una emoción:** una sola palabra. La preocupación es una cadena de pensamientos «¿y si…?» sobre el futuro.", "Rumiación": "**Es una emoción:** una sola palabra. La rumiación es un repaso repetitivo del pasado que gira en círculo." } }, { "id": "quiz_3", "type": "choice", "prompt": "«¿Y si me equivoco? ¿Y si se dan cuenta? ¿Y si pierdo el trabajo?». ¿Qué es?", "help": "3 de 4.", "options": [ "Pensamiento automático", "Emoción", "Preocupación", "Rumiación" ], "feedback": { "Pensamiento automático": "**Es una preocupación:** no es una idea puntual, sino una cadena de «¿y si…?» que mira al futuro.", "Emoción": "**Es una preocupación:** son varias frases, no una palabra. Mira al futuro y se encadena en «¿y si…?».", "Preocupación": "**¡Bien! Es una preocupación:** mira al futuro, se encadena y busca prevenir una amenaza. Ojo: no es lo mismo que planificar. Planificar resuelve; preocuparse gira sin resolver.", "Rumiación": "**Es una preocupación:** mira hacia adelante, al futuro. La rumiación mira hacia atrás, al pasado." } }, { "id": "quiz_4", "type": "choice", "prompt": "«Desde que me dejó, me pregunto una y otra vez qué hice mal, por qué a mí». ¿Qué es?", "help": "4 de 4.", "options": [ "Pensamiento automático", "Emoción", "Preocupación", "Rumiación" ], "feedback": { "Pensamiento automático": "**Es una rumiación:** no es una idea puntual sobre un momento concreto, sino un repaso repetitivo del pasado que vuelve una y otra vez.", "Emoción": "**Es una rumiación:** es un repaso del pasado, no una palabra que nombre un estado afectivo.", "Preocupación": "**Es una rumiación:** mira hacia atrás, al pasado, no al futuro. Gira en círculo sobre causas y significados («¿por qué a mí?»).", "Rumiación": "**¡Bien! Es una rumiación:** mira al pasado y gira en círculo, sobre causas y significados («¿por qué a mí?»)." } }, { "id": "ejemplos", "type": "checklist", "prompt": "¿Alguno de estos pensamientos te suena?", "help": "Son pensamientos automáticos típicos de distintas áreas. Marcá los que aparecen en tu cabeza, si hay alguno.\n\nSi pensamientos como «nada tiene sentido» o «soy una carga» se repiten o te pesan mucho, hablalo con tu psicólogo. En caso de crisis, pedí ayuda ya a una línea de ayuda, a emergencias o en la guardia del hospital más cercano; en **Calmarme** está el recuadro «Si necesitás ayuda urgente» con los teléfonos.", "optional": true, "options": [ "Ansiedad: «Algo malo va a pasar», «no lo voy a soportar»", "Depresión: «Nada tiene sentido», «soy una carga»", "Pareja: «Si me quisiera, se daría cuenta solo»", "Autoestima: «No valgo lo suficiente», «cualquiera lo haría mejor»", "Trabajo: «Si pido ayuda, van a ver que no sé»", "Universidad: «Si repruebo, se termina todo»", "Duelo: «Debería haber hecho más», «lo abandoné»", "Perfeccionismo: «Si no es perfecto, es un fracaso»", "Ansiedad: «Todos se dan cuenta de que estoy nervioso»", "Depresión: «Siempre fue así y siempre va a ser así»" ] }, { "id": "errores", "type": "info", "title": "Errores frecuentes", "content": "Qué se confunde y cómo evitarlo:\n\n- **Anotar la emoción como si fuera el pensamiento.** «Me sentí mal» no es un pensamiento; buscá la frase que estaba debajo.\n- **Escribir el pensamiento «traducido» o suavizado.** Registralo tal como apareció, con sus palabras crudas.\n- **Quedarse con el primero.** Preguntá «¿y qué más?» para encontrar el pensamiento más caliente, el que más emoción trae.\n- **Confundir preocupación con planificación.** Planificar resuelve; preocuparse gira sin resolver." }, { "id": "lucia", "type": "info", "title": "Lucía, 21 años", "content": "**Estudiante universitaria.**\n\nLucía consulta por «bloqueos» antes de rendir. Al recrear la escena del último examen, aparece una secuencia: ve la primera pregunta difícil (situación) y piensa:\n\n«no me acuerdo de nada» → «voy a reprobar» → «si repruebo, soy un fracaso» → «mis viejos se van a decepcionar».\n\nLa emoción escala de nerviosismo a pánico y entrega la hoja en blanco." }, { "id": "lucia_caliente", "type": "choice", "prompt": "¿Cuál es el pensamiento más caliente de la cadena de Lucía?", "help": "El pensamiento caliente es el que más emoción trae.", "options": [ "«No me acuerdo de nada»", "«Voy a reprobar»", "«Si repruebo, soy un fracaso»", "«Mis viejos se van a decepcionar»" ], "feedback": { "«No me acuerdo de nada»": "Es el primero de la cadena, y por eso conviene seguir preguntando «¿y qué más?». En el caso, el más caliente es **«soy un fracaso»**: no es sobre el examen, sino sobre ella misma. Lo que se trabaja es identificar la cadena completa y detectar ese pensamiento, que conecta con una creencia nuclear que se aborda más adelante.", "«Voy a reprobar»": "Pesa, pero sigue hablando del examen. En el caso, el más caliente es **«soy un fracaso»**: no es sobre el examen, sino sobre ella misma. Lo que se trabaja es identificar la cadena completa y detectar ese pensamiento, que conecta con una creencia nuclear que se aborda más adelante.", "«Si repruebo, soy un fracaso»": "**¡Exacto!** «Soy un fracaso» no es sobre el examen, sino sobre ella misma. Lo que se trabaja es identificar la cadena completa y detectar ese pensamiento, que conecta con una creencia nuclear que se aborda más adelante, en «Creencias intermedias y nucleares».", "«Mis viejos se van a decepcionar»": "Es parte de la cadena y puede pesar mucho. En el caso, el más caliente es **«soy un fracaso»**: no es sobre el examen, sino sobre ella misma. Lo que se trabaja es identificar la cadena completa y detectar ese pensamiento, que conecta con una creencia nuclear que se aborda más adelante." } }, { "id": "cazar", "type": "info", "title": "Cazar el pensamiento", "content": "El ejercicio guiado de este capítulo:\n\n- **1.** Durante tres días, cada vez que notes un cambio de ánimo, hacé una pausa de diez segundos.\n- **2.** Hacete la pregunta de oro y anotá la primera frase que aparezca, cruda.\n- **3.** Preguntate «¿y qué más?» hasta que no aparezcan pensamientos nuevos.\n- **4.** Marcá el pensamiento que más emoción te trae: ese es el «pensamiento caliente».\n- **5.** Poné la credibilidad de 0 a 100 (cuánto lo creés en ese momento)." }, { "id": "rpd_intro", "type": "info", "title": "Tu Registro de Pensamientos (RPD)", "content": "El Registro de Pensamientos Disfuncionales (RPD) es la herramienta más usada de la TCC.\n\nEn este capítulo trabajás las primeras cuatro columnas: **fecha y situación, emoción (0–100), pensamientos automáticos y credibilidad (0–100)**. En «Cuestionamiento socrático y reestructuración» vas a completar las últimas: evidencia y respuesta alternativa.\n\nProbalo ahora con un momento reciente en que notaste un cambio de ánimo." }, { "id": "situacion", "type": "text", "prompt": "¿Cuándo fue y qué pasó?", "help": "Fecha y situación, como una foto: qué, quién, cuándo, dónde. Sin interpretaciones. Lucía: «En el último examen, veo la primera pregunta, que es difícil»." }, { "id": "emocion", "type": "checklist", "prompt": "¿Qué emoción sentiste?", "help": "Cada emoción se nombra con una sola palabra, no con una frase. Marcá hasta tres. La de Lucía escaló de nerviosismo a pánico.", "max": 3, "options": [ "Angustia", "Ansiedad", "Miedo", "Nerviosismo", "Pánico", "Bronca", "Tristeza", "Vergüenza", "Culpa", "Frustración", "Inseguridad", "Otra" ] }, { "id": "emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "intensidad", "type": "scale", "prompt": "¿Con qué intensidad la sentiste?", "help": "De 0 a 100. Si marcaste más de una, puntuá la más fuerte.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima" }, { "id": "pensamientos", "type": "list", "prompt": "¿Qué te pasó por la cabeza justo antes de empezar a sentirte así?", "help": "Anotá la primera frase, cruda, tal como apareció. Después preguntate **«¿y qué más?»** y anotá cada pensamiento nuevo en otro renglón, hasta que no aparezcan más.\n\nSi cuesta: recreá la escena con detalle, prestá atención a las imágenes o completá «temo que…», «lo que esto significa de mí es…».\n\nLucía: «no me acuerdo de nada» → «voy a reprobar» → «si repruebo, soy un fracaso» → «mis viejos se van a decepcionar».", "count": 5, "min": 1 }, { "id": "caliente", "type": "text", "prompt": "¿Cuál es tu pensamiento caliente?", "help": "El que más emoción te trae. Copialo de tu lista. El de Lucía: «si repruebo, soy un fracaso»." }, { "id": "credibilidad", "type": "scale", "prompt": "¿Cuánto creés ese pensamiento?", "help": "Credibilidad de 0 a 100: cuánto lo creés en ese momento. No importa solo qué pensás, sino cuánto lo creés.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "clasificar", "type": "choice", "prompt": "Aplicá la regla práctica: lo que anotaste como pensamiento caliente, ¿qué es?", "help": "Clasificar cada anotación también es parte de la tarea de la semana.", "options": [ "Un pensamiento: una frase sobre un momento concreto", "Una emoción: una sola palabra", "Una preocupación: una cadena de «¿y si…?» sobre el futuro", "Una rumiación: vueltas en círculo sobre el pasado" ], "feedback": { "Un pensamiento: una frase sobre un momento concreto": "**Bien.** Eso es lo que va en esta columna del RPD. Fijate que esté tal como apareció, con sus palabras crudas, sin traducirlo ni suavizarlo.", "Una emoción: una sola palabra": "**Ojo:** anotar la emoción como si fuera el pensamiento es un error frecuente. «Me sentí mal» no es un pensamiento: buscá la frase que estaba debajo, con la pregunta de oro. Podés tocar «Atrás» y ajustarlo.", "Una preocupación: una cadena de «¿y si…?» sobre el futuro": "Si mira al futuro y se encadena en «¿y si…?», es una preocupación. Buscá en esa cadena la frase puntual que más emoción te trae y anotala como pensamiento caliente: podés tocar «Atrás» y ajustarlo. Recordá: planificar resuelve; preocuparse gira sin resolver. Si es una preocupación que se repite, anotá si es algo que podés resolver hoy o no: es parte de la tarea de la semana.", "Una rumiación: vueltas en círculo sobre el pasado": "Si mira al pasado y gira en círculo («¿por qué a mí?»), es rumiación. Buscá la frase puntual que apareció en el momento en que empezaste a sentirte así y anotala como pensamiento caliente. Podés tocar «Atrás» y ajustarlo." } }, { "id": "resumen", "type": "reflect", "title": "Tu registro", "template": "Situación: «{{situacion}}». Emoción: {{emocion}}. Pensamientos: {{pensamientos}}. Pensamiento caliente: «{{caliente}}».", "content": "Estas son las primeras cuatro columnas del RPD. En «Cuestionamiento socrático y reestructuración» vas a completar las últimas: evidencia y respuesta alternativa.\n\nTu registro se guarda en «Mis respuestas» cuando tocás «Terminar», al final del ejercicio." }, { "id": "reflexion", "type": "info", "title": "Preguntas de reflexión", "content": "- ¿Qué pensamiento automático se repite más en tu semana?\n- ¿Notás diferencia entre pensar un problema y darle vueltas sin salida?\n- ¿Cuál de tus pensamientos automáticos te resulta más creíble, aunque sospeches que no es del todo cierto?\n- ¿En qué momento del día aparecen más? ¿Hay un patrón?\n- ¿Qué pasaría si trataras esos pensamientos como hipótesis en vez de como hechos?\n- ¿Cómo te hablás a vos mismo cuando algo sale mal?" }, { "id": "reflexion_respuesta", "type": "text", "prompt": "Si querés, respondé alguna de estas preguntas", "help": "Elegí la que más te resuene y anotá cuál es. Podés llevar tu respuesta a la próxima sesión.", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- Los pensamientos automáticos son ideas breves, involuntarias y plausibles.\n- La pregunta de oro: «¿qué me pasó por la cabeza justo antes de sentirme así?».\n- Emoción = una palabra; pensamiento = una frase; preocupación = futuro; rumiación = pasado en círculo.\n- No importa solo qué pensás, sino cuánto lo creés (credibilidad).\n- El RPD es la herramienta base para registrarlos." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "- Durante tres días, cada vez que notes un cambio de ánimo, hacé la pausa de diez segundos y cazá el pensamiento.\n- Completá al menos **cinco registros** durante la semana (unos 5 a 10 minutos cada uno). Podés repetir este ejercicio o usar el «Registro de pensamientos (RPD)»: por ahora, salteá las preguntas del pensamiento alternativo, que vas a ver en «Cuestionamiento socrático y reestructuración».\n- En dos de ellos, identificá y marcá el pensamiento caliente.\n- Clasificá cada anotación: ¿es pensamiento, emoción, preocupación o rumiación?\n- Elegí una preocupación recurrente y anotá si es algo que podés resolver hoy o no.\n\nEl próximo capítulo es **«Las distorsiones cognitivas»**." } ]$steps$::jsonb),
  ('tcc-distorsiones', 'Las distorsiones cognitivas', 'Conocé las 12 distorsiones más frecuentes, aprendé a reconocerlas y descubrí cuál es tu «lente» habitual.', 'custom', 'tcc', 'adultos', 'tcc', 20, 203,
   $steps$[ { "id": "intro", "type": "info", "title": "Lentes rayados", "content": "Las distorsiones cognitivas son errores sistemáticos en la forma de procesar la información: atajos mentales que deforman la realidad y sostienen el malestar. No son signo de poca inteligencia; los tenemos todos. La clave es aprender a reconocerlos.\n\nLa mente, para ahorrar esfuerzo, usa atajos. La mayoría son útiles, pero algunos nos hacen ver la realidad torcida, como **lentes rayados**. Una persona puede recibir nueve comentarios positivos y uno negativo, y quedarse toda la noche pensando solo en el negativo. Eso es una distorsión: no está mintiendo, está filtrando." }, { "id": "profundizar", "type": "info", "title": "Para profundizar (opcional)", "content": "Las distorsiones cognitivas son sesgos sistemáticos en el procesamiento de la información descritos por Beck y ampliados por Burns. Operan sobre los pensamientos automáticos y les dan forma.\n\nIdentificar el tipo de distorsión facilita el cuestionamiento, porque cada una tiene un «punto débil» característico. No se trata de etiquetar para descalificar el pensamiento, sino de entender el mecanismo para poder revisarlo." }, { "id": "tabla_1", "type": "info", "title": "Las principales distorsiones (1 de 4)", "content": "Estas son las más frecuentes, con su definición, un ejemplo y una vía para cuestionarla.\n\n**Todo o nada.** Ver en extremos, sin matices. «Si no es perfecto, es un desastre.»\nCuestionala: ¿hay puntos intermedios? ¿Qué habría entre 0 y 100?\n\n**Sobregeneralización.** De un hecho aislado a una regla universal. «Siempre me sale mal todo.»\nCuestionala: ¿«siempre»? ¿Podés nombrar excepciones concretas?\n\n**Filtro mental.** Fijarse solo en lo negativo. Un reproche borra diez elogios.\nCuestionala: ¿qué datos positivos estoy dejando afuera?" }, { "id": "tabla_2", "type": "info", "title": "Las principales distorsiones (2 de 4)", "content": "**Descalificar lo positivo.** Restar valor a lo bueno. «Me salió bien, pero fue suerte.»\nCuestionala: si un amigo lograra esto, ¿le dirías que fue solo suerte?\n\n**Lectura de mente.** Suponer lo que otros piensan. «Sé que le parezco aburrido.»\nCuestionala: ¿qué evidencia tengo? ¿Lo comprobé o lo asumí?\n\n**Adivinación del futuro.** Predecir lo peor como un hecho. «Voy a fracasar seguro.»\nCuestionala: ¿cuántas veces esta predicción se cumplió tal cual?" }, { "id": "tabla_3", "type": "info", "title": "Las principales distorsiones (3 de 4)", "content": "**Catastrofización.** Imaginar el peor escenario y darlo por cierto. «Si me tiembla la voz, es el fin.»\nCuestionala: ¿qué es lo más probable, no lo peor? ¿Y si pasara, cómo lo afrontaría?\n\n**Razonamiento emocional.** «Lo siento, entonces es verdad.» «Me siento inútil, luego lo soy.»\nCuestionala: ¿un sentimiento es una prueba? ¿Los hechos coinciden?\n\n**Debería / tener que.** Reglas rígidas sobre cómo deben ser las cosas. «No debería equivocarme nunca.»\nCuestionala: ¿esa regla es realista? ¿La aplicarías a otro?" }, { "id": "tabla_4", "type": "info", "title": "Las principales distorsiones (4 de 4)", "content": "**Etiquetación.** Ponerse (o poner) una etiqueta global. «Soy un fracaso.»\nCuestionala: ¿un error define a toda la persona? Describí la conducta, no la etiqueta.\n\n**Personalización.** Asumir responsabilidad de lo que no controlás. «Está de mal humor por mi culpa.»\nCuestionala: ¿qué otros factores pudieron influir?\n\n**Culpabilización.** Cargar toda la culpa en uno mismo o en otro.\nCuestionala: ¿qué parte es mía, qué parte del contexto y qué parte de otros?" }, { "id": "reconocer", "type": "info", "title": "¿Cómo reconocerlas?", "content": "Prestá atención a estas pistas:\n\n- Aparecen palabras absolutas: «siempre», «nunca», «todo», «nadie», «todos».\n- Hay etiquetas globales sobre vos o los demás: «soy un…», «es un…».\n- Se predice el futuro con certeza o se lee la mente ajena sin datos.\n- Un sentimiento se usa como prueba de un hecho.\n- Aparecen «debería», «tengo que», «no puedo fallar»." }, { "id": "areas", "type": "info", "title": "Ejemplos por área", "content": "Así se ven en distintas áreas de la vida. Fijate que un mismo pensamiento puede tener más de una.\n\n- **Ansiedad:** «Si tengo un ataque en el colectivo, va a ser catastrófico» → catastrofización.\n- **Autoestima:** «Soy un desastre» → etiquetación.\n- **Duelo:** «Debería haberlo salvado» → debería / culpabilización.\n- **Autoestima:** «Todos se dieron cuenta de mi error» → filtro mental + lectura de mente.\n- **Trabajo:** «El equipo falló por mi culpa» → personalización.\n\nAhora probá vos con otros cinco ejemplos." }, { "id": "quiz_depresion", "type": "choice", "prompt": "¿Qué distorsión hay en «Nunca voy a estar mejor»?", "help": "Ejemplo del área depresión (1 de 5).", "options": [ "Sobregeneralización", "Adivinación del futuro", "Razonamiento emocional", "Etiquetación" ], "feedback": { "Adivinación del futuro": "**Exacto.** Predice lo peor como si fuera un hecho. Para cuestionarla: ¿cuántas veces esta predicción se cumplió tal cual?", "Sobregeneralización": "**Casi.** El «nunca» es una buena pista de que hay una distorsión, pero el pensamiento no saca una regla de un hecho aislado: predice el futuro como si fuera un hecho. Es **adivinación del futuro**.", "Razonamiento emocional": "**No.** No usa un sentimiento como prueba («lo siento, entonces es verdad»): predice el futuro como si fuera un hecho. Es **adivinación del futuro**.", "Etiquetación": "**No.** No pone una etiqueta global («soy un…»): predice el futuro como si fuera un hecho. Es **adivinación del futuro**." } }, { "id": "quiz_pareja", "type": "choice", "prompt": "¿Qué distorsión hay en «Si no me escribe, es que ya no le importo»?", "help": "Ejemplo del área pareja (2 de 5).", "options": [ "Catastrofización", "Personalización", "Lectura de mente", "Debería / tener que" ], "feedback": { "Lectura de mente": "**Exacto.** Supone lo que el otro piensa o siente, sin datos. Para cuestionarla: ¿qué evidencia tengo? ¿Lo comprobé o lo asumí?", "Catastrofización": "**No es la principal.** Saca una conclusión dura, pero lo central es que da por hecho lo que la otra persona siente, sin haberlo comprobado. Es **lectura de mente**.", "Personalización": "**Se parece, pero no.** No se hace cargo de algo que no controla: supone lo que el otro siente. Es **lectura de mente**.", "Debería / tener que": "**No.** No hay una regla rígida («debería», «tengo que»): supone lo que el otro siente. Es **lectura de mente**." } }, { "id": "quiz_trabajo", "type": "choice", "prompt": "¿Qué distorsión hay en «Un error y arruiné todo el proyecto»?", "help": "Ejemplo del área trabajo (3 de 5).", "options": [ "Todo o nada", "Filtro mental", "Etiquetación", "Adivinación del futuro" ], "feedback": { "Todo o nada": "**Exacto.** Ve en extremos, sin matices: un error alcanza para que «todo» esté arruinado. Para cuestionarla: ¿hay puntos intermedios? ¿Qué habría entre 0 y 100?", "Filtro mental": "**Cerca.** El filtro se fija solo en lo negativo, pero acá lo central es el extremo: o sale perfecto o está todo arruinado. Es **todo o nada**.", "Etiquetación": "**No.** No le pone una etiqueta a la persona («soy un…»): ve el resultado en extremos. Es **todo o nada**.", "Adivinación del futuro": "**No.** No predice lo que va a pasar: juzga lo que pasó sin matices. Es **todo o nada**." } }, { "id": "quiz_universidad", "type": "choice", "prompt": "¿Qué distorsión hay en «Me fue bien de casualidad»?", "help": "Ejemplo del área universidad (4 de 5).", "options": [ "Filtro mental", "Lectura de mente", "Razonamiento emocional", "Descalificar lo positivo" ], "feedback": { "Descalificar lo positivo": "**Exacto.** Le resta valor a lo bueno. Para cuestionarla: si un amigo lograra esto, ¿le dirías que fue solo suerte?", "Filtro mental": "**Cerca.** El filtro deja afuera lo positivo; acá lo positivo se ve, pero se le resta valor («de casualidad»). Es **descalificar lo positivo**.", "Lectura de mente": "**No.** No supone lo que piensan otros: le resta valor a un logro propio. Es **descalificar lo positivo**.", "Razonamiento emocional": "**No.** No usa un sentimiento como prueba: le resta valor a lo bueno. Es **descalificar lo positivo**." } }, { "id": "quiz_perfeccionismo", "type": "choice", "prompt": "¿Qué distorsión hay en «Me siento incompetente, entonces lo soy»?", "help": "Ejemplo del área perfeccionismo (5 de 5).", "options": [ "Etiquetación", "Todo o nada", "Razonamiento emocional", "Lectura de mente" ], "feedback": { "Razonamiento emocional": "**Exacto.** «Lo siento, entonces es verdad»: usa un sentimiento como prueba de un hecho. Para cuestionarla: ¿un sentimiento es una prueba? ¿Los hechos coinciden?", "Etiquetación": "**Cerca.** «Incompetente» suena a etiqueta, pero la clave está en el «me siento…, entonces lo soy»: un sentimiento usado como prueba. Es **razonamiento emocional**.", "Todo o nada": "**No.** No ve en extremos: toma un sentimiento como prueba de un hecho. Es **razonamiento emocional**.", "Lectura de mente": "**No.** No supone lo que piensan otros: toma su propio sentimiento como prueba. Es **razonamiento emocional**." } }, { "id": "errores", "type": "info", "title": "Errores frecuentes", "content": "Qué se confunde y cómo evitarlo:\n\n- **Usar la etiqueta de la distorsión como insulto.** «Otra vez catastrofizando» no ayuda; el fin es entender, no juzgarse.\n- **Creer que nombrar la distorsión ya la resuelve.** Nombrarla es el primer paso; después hay que cuestionarla (lo vas a ver en «Cuestionamiento socrático y reestructuración»).\n- **Forzar una sola categoría.** Un pensamiento puede tener dos o tres distorsiones a la vez.\n- **Confundir una distorsión con una emoción legítima.** Estar triste tras una pérdida no es una distorsión; pensar «no merezco estar bien nunca más» sí puede serlo." }, { "id": "diferencias", "type": "info", "title": "Diferencias con conceptos similares", "content": "Una distorsión no es lo mismo que:\n\n- **Un pensamiento automático:** es el pensamiento en sí; la distorsión es el **tipo** de error que contiene.\n- **Una creencia nuclear:** es más profunda y estable; las distorsiones operan en la superficie.\n- **Una opinión razonable:** una opinión admite matices y evidencia; la distorsión es rígida y absoluta." }, { "id": "rodrigo", "type": "info", "title": "Caso clínico: Rodrigo, 29 años", "content": "**Perfeccionismo laboral.** Rodrigo entrega un informe muy valorado, pero con una cifra mal tipeada. Piensa:\n\n- «Está todo arruinado» (todo o nada).\n- «Van a pensar que soy un incompetente» (lectura de mente).\n- «Soy un desastre» (etiquetación).\n\nPasa la noche rehaciéndolo entero.\n\n**Trabajo en sesión:** se nombran las tres distorsiones. Rodrigo descubre que el mismo error, cometido por un compañero, le parecería «un detalle sin importancia». Ese **doble estándar** es la puerta de entrada al cuestionamiento." }, { "id": "guiado_intro", "type": "info", "title": "Ejercicio guiado: tu distorsión frecuente", "content": "Ahora vas a buscar tu «lente» más frecuente:\n\n1. Volvé a tus registros de «Los pensamientos automáticos» o del «Registro de pensamientos (RPD)» y elegí tres pensamientos calientes.\n2. Para cada uno, buscá qué distorsión(es) encaja(n) mejor.\n3. Anotá qué palabra o pista te lo indicó («siempre», una etiqueta, una predicción).\n4. Identificá cuál distorsión aparece más seguido: esa es tu «lente» más frecuente.\n5. Escribí, para esa distorsión, la pregunta que mejor la desafía.\n\nTus registros están en «Mis respuestas» de cada ejercicio. Si salís a buscarlos, este ejercicio vuelve a empezar (hasta acá solo respondiste los ejemplos). Si todavía no tenés registros, usá pensamientos de estos días." }, { "id": "calientes", "type": "list", "prompt": "Anotá tres pensamientos calientes de tus registros", "help": "Los que más emoción te trajeron, tal como aparecieron. Por ejemplo, Rodrigo: «Está todo arruinado».", "count": 3 }, { "id": "calientes_distorsion", "type": "list", "prompt": "Para cada pensamiento: ¿qué distorsión encaja y qué pista te lo indicó?", "help": "Uno por renglón, en el mismo orden (con «Atrás» los volvés a ver). Puede haber más de una distorsión. Por ejemplo: todo o nada, la pista fue «todo».\n\nLas doce: todo o nada, sobregeneralización, filtro mental, descalificar lo positivo, lectura de mente, adivinación del futuro, catastrofización, razonamiento emocional, debería / tener que, etiquetación, personalización y culpabilización.", "count": 3 }, { "id": "lente", "type": "choice", "prompt": "¿Cuál aparece más seguido? Esa es tu «lente» más frecuente", "help": "Mirá tus tres respuestas anteriores. Si ninguna se repite, elegí la que más te suene.", "options": [ "Todo o nada", "Sobregeneralización", "Filtro mental", "Descalificar lo positivo", "Lectura de mente", "Adivinación del futuro", "Catastrofización", "Razonamiento emocional", "Debería / tener que", "Etiquetación", "Personalización", "Culpabilización" ], "feedback": { "Todo o nada": "Pregunta de la tabla para desafiarla: ¿Hay puntos intermedios? ¿Qué habría entre 0 y 100?", "Sobregeneralización": "Pregunta de la tabla para desafiarla: ¿«Siempre»? ¿Podés nombrar excepciones concretas?", "Filtro mental": "Pregunta de la tabla para desafiarla: ¿Qué datos positivos estoy dejando afuera?", "Descalificar lo positivo": "Pregunta de la tabla para desafiarla: Si un amigo lograra esto, ¿le dirías que fue solo suerte?", "Lectura de mente": "Pregunta de la tabla para desafiarla: ¿Qué evidencia tengo? ¿Lo comprobé o lo asumí?", "Adivinación del futuro": "Pregunta de la tabla para desafiarla: ¿Cuántas veces esta predicción se cumplió tal cual?", "Catastrofización": "Pregunta de la tabla para desafiarla: ¿Qué es lo más probable, no lo peor? ¿Y si pasara, cómo lo afrontaría?", "Razonamiento emocional": "Pregunta de la tabla para desafiarla: ¿Un sentimiento es una prueba? ¿Los hechos coinciden?", "Debería / tener que": "Pregunta de la tabla para desafiarla: ¿Esa regla es realista? ¿La aplicarías a otro?", "Etiquetación": "Pregunta de la tabla para desafiarla: ¿Un error define a toda la persona? Describí la conducta, no la etiqueta.", "Personalización": "Pregunta de la tabla para desafiarla: ¿Qué otros factores pudieron influir?", "Culpabilización": "Pregunta de la tabla para desafiarla: ¿Qué parte es mía, qué parte del contexto y qué parte de otros?" } }, { "id": "lente_pregunta", "type": "text", "prompt": "Escribí la pregunta que mejor desafía esa distorsión", "help": "Es la que viste en la pantalla anterior: podés usarla tal cual o escribirla con tus palabras." }, { "id": "hoja_intro", "type": "info", "title": "Hoja de trabajo: identificando distorsiones", "content": "Ahora completá una fila de la hoja con una situación concreta: reciente o de tus registros.\n\nSon cuatro preguntas, una por columna: la situación, el pensamiento automático, la distorsión o distorsiones y la pista que la revela. En cada una vas a ver el ejemplo de Rodrigo." }, { "id": "hoja_situacion", "type": "text", "prompt": "Situación: ¿qué pasó?", "help": "Breve y concreta: dónde, cuándo, con quién. Rodrigo: entregó un informe muy valorado, pero con una cifra mal tipeada." }, { "id": "hoja_pensamiento", "type": "text", "prompt": "Pensamiento automático: ¿qué pensaste?", "help": "La frase tal como apareció. Rodrigo: «Está todo arruinado»." }, { "id": "hoja_distorsiones", "type": "checklist", "prompt": "Distorsión(es): ¿cuáles encajan?", "help": "Marcá todas las que veas: un pensamiento puede tener dos o tres a la vez. Rodrigo: todo o nada.\n\nPuede que no haya ninguna: estar triste tras una pérdida no es una distorsión.", "options": [ "Todo o nada", "Sobregeneralización", "Filtro mental", "Descalificar lo positivo", "Lectura de mente", "Adivinación del futuro", "Catastrofización", "Razonamiento emocional", "Debería / tener que", "Etiquetación", "Personalización", "Culpabilización", "No encuentro ninguna" ] }, { "id": "hoja_pista", "type": "text", "prompt": "¿Qué pista lo revela?", "help": "Una palabra absoluta, una etiqueta, una predicción, un «debería», un sentimiento usado como prueba… En «Está todo arruinado», la pista es «todo».\n\nSi marcaste «No encuentro ninguna», escribí «ninguna»." }, { "id": "refl_areas", "type": "text", "prompt": "¿En qué áreas de tu vida aparece más tu lente?", "help": "Preguntas de reflexión: respondé las que quieras, podés saltear cualquiera.\n\nPor ejemplo: trabajo, pareja, estudio.", "optional": true }, { "id": "refl_estandar", "type": "text", "prompt": "¿Te tratás con el mismo estándar con el que tratás a los demás?", "help": "Acordate del doble estándar de Rodrigo.", "optional": true }, { "id": "refl_palabras", "type": "checklist", "prompt": "¿Qué palabras absolutas usás más seguido?", "options": [ "Siempre", "Nunca", "Todo", "Nadie", "Todos", "Debería", "Tengo que", "No puedo fallar" ], "optional": true, "help": "Marcá las que reconozcas en tus pensamientos. Las últimas tres son pistas de reglas rígidas." }, { "id": "refl_sin_distorsion", "type": "text", "prompt": "¿Cómo cambiaría una situación si sacaras la distorsión de la ecuación?", "optional": true }, { "id": "refl_herencia", "type": "text", "prompt": "¿Qué distorsión heredaste de tu entorno o de tu historia?", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Tu lente y tu hoja", "template": "Tu lente más frecuente: {{lente}}. La pregunta que la desafía: «{{lente_pregunta}}». En tu hoja: «{{hoja_pensamiento}}». Distorsiones: {{hoja_distorsiones}}. Pista: {{hoja_pista}}.", "content": "Tus respuestas se guardan cuando tocás «Terminar», al final del ejercicio: las vas a poder volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también las puede ver." }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- Las distorsiones son errores sistemáticos que deforman cómo procesamos la información.\n- Las tenemos todos; reconocerlas es más útil que juzgarlas.\n- Cada distorsión tiene un punto débil y una pregunta que la desafía.\n- Un pensamiento puede contener varias distorsiones a la vez.\n- Nombrarla es el primer paso; cuestionarla viene después." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "Tareas para casa, a lo largo de la semana:\n\n- Detectá y clasificá **cinco pensamientos** con distorsión. Anotalos en «Registro de distorsiones» (unos 5 minutos cada uno).\n- Elegí tu distorsión más frecuente y llevá una «cuenta» de cuántas veces aparece por día.\n- Por cada una, escribí una frase alternativa más ajustada (sin exagerar hacia el otro extremo).\n- Aplicá el «doble estándar»: preguntate qué le dirías a un amigo que pensara eso.\n\nEl próximo capítulo es **«Creencias intermedias y nucleares»**. Cuestionar las distorsiones lo vas a trabajar en «Cuestionamiento socrático y reestructuración»." } ]$steps$::jsonb),
  ('tcc-creencias', 'Creencias intermedias y nucleares', 'Bajá de un pensamiento automático a la creencia de fondo con la flecha descendente y empezá a revisarla.', 'custom', 'tcc', 'adultos', 'tcc', 20, 204,
   $steps$[ { "id": "intro", "type": "info", "title": "Hojas, tronco y raíz", "content": "Debajo de los pensamientos automáticos hay estructuras más profundas: reglas de vida y creencias sobre uno mismo que funcionan como el sistema operativo de la mente. Casi nunca las decimos en voz alta, pero deciden mucho.\n\nPensá en un árbol. Los **pensamientos automáticos** son las hojas: se ven, cambian con el clima, hay miles. Las **creencias intermedias** son el tronco y las ramas: las reglas con las que te movés por la vida. Las **creencias nucleares** son la raíz: ideas absolutas sobre quién sos, aprendidas muy temprano.\n\nSi solo cortás hojas, vuelven a crecer. Para un cambio duradero hay que llegar al tronco y a la raíz." }, { "id": "profundizar", "type": "info", "title": "Para profundizar (opcional)", "content": "Beck describió tres niveles cognitivos:\n\n- **Creencias nucleares (esquemas):** ideas globales, rígidas y sobregeneralizadas sobre el self, los otros y el mundo, habitualmente formadas en experiencias tempranas.\n- **Creencias intermedias:** actitudes, reglas y supuestos condicionales que la persona desarrolla para sobrellevar esas creencias nucleares.\n- **Pensamientos automáticos:** la manifestación situacional de todo ese sistema." }, { "id": "tres_formas", "type": "info", "title": "Las tres formas de la creencia intermedia", "content": "- **Actitud:** una valoración. «Es terrible cometer errores.»\n- **Regla:** un imperativo. «Nunca debo mostrar debilidad.»\n- **Supuesto condicional:** un «si… entonces…». «Si pido ayuda, entonces soy débil.» / «Si soy perfecto, entonces me van a querer.»" }, { "id": "dominios", "type": "info", "title": "Los tres dominios de las creencias nucleares", "content": "Las creencias nucleares negativas sobre uno mismo suelen agruparse en tres grandes dominios (Judith Beck):\n\n- **Desamparo:** «soy impotente / incapaz». Por ejemplo: «no puedo con nada», «soy débil», «no tengo control», «estoy atrapado».\n- **Desamor:** «no soy querible». Por ejemplo: «no merezco cariño», «voy a terminar solo», «hay algo malo en mí».\n- **Desvalorización:** «no valgo / soy defectuoso». Por ejemplo: «soy un fracaso», «no sirvo», «soy mala persona»." }, { "id": "desarrollo", "type": "info", "title": "¿Cómo se desarrollan y cómo mantienen el malestar?", "content": "Las creencias nucleares se forman a partir de experiencias repetidas, especialmente tempranas, y del significado que se les dio.\n\nUna vez instaladas, se auto-perpetúan. La persona:\n\n- presta más atención a la información que las confirma;\n- reinterpreta o descarta la que las contradice;\n- y desarrolla estrategias (reglas y conductas) para no sentir su dolor." }, { "id": "circulo", "type": "info", "title": "El círculo que las mantiene", "content": "**Creencia nuclear** (por ejemplo, «no valgo»)\n→ **regla o supuesto** («si logro todo, valdré»)\n→ **estrategia** (exigencia, control, evitación)\n→ **pensamientos automáticos** ante cada situación\n→ **emoción y conducta** que, al final, confirman la creencia.\n\nLa creencia se protege a sí misma: cuando la regla se cumple, hay alivio; cuando se rompe, se dispara la creencia nuclear en toda su fuerza." }, { "id": "reconocer", "type": "info", "title": "¿Cómo reconocerlas?", "content": "- Reglas que aparecen como «debería», «tengo que», «nunca», «siempre».\n- Supuestos «si… entonces…» que ordenan tu conducta sin que lo notes.\n- Reacciones desproporcionadas: cuando la emoción es mucho más grande que la situación, suele haber una creencia nuclear tocada.\n- Temas que se repiten en distintas áreas (pareja, trabajo, estudio): esa constante suele ser la raíz." }, { "id": "flecha", "type": "info", "title": "La técnica de la flecha descendente", "content": "Para pasar de un pensamiento automático a la creencia nuclear se usa la **flecha descendente**: tomás un pensamiento y preguntás, una y otra vez, «si eso fuera cierto, ¿qué significaría?», hasta llegar a la idea de fondo.\n\n**Ejemplo**\nPensamiento: «Me equivoqué en la reunión.»\n↓ ¿Y si eso fuera cierto, qué significaría? «Que van a notar que no sé.»\n↓ ¿Y eso qué significaría? «Que no estoy a la altura del puesto.»\n↓ ¿Y eso qué diría de vos? «Que no sirvo.» ← creencia nuclear (desvalorización)" }, { "id": "areas", "type": "info", "title": "Ejemplos por área", "content": "De la regla o supuesto (creencia intermedia) a la creencia nuclear probable:\n\n- **Autoestima:** «Si otro me critica, es que tiene razón» → desvalorización: «soy defectuoso».\n- **Trabajo:** «Si pido ayuda, soy un inútil» → desamparo: «soy incapaz».\n- **Universidad:** «Si no soy el mejor, no valgo nada» → desvalorización: «no soy suficiente».\n- **Duelo:** «Debería haber podido evitarlo» → desamparo / culpa: «fallé».\n- **Perfeccionismo:** «Si algo tiene un error, todo mi trabajo no sirve» → desvalorización: «no soy suficiente».\n\nAhora probá vos con otros tres." }, { "id": "quiz_ansiedad", "type": "choice", "prompt": "«Si mantengo todo bajo control, no pasará nada malo»: ¿a qué dominio apunta?", "help": "Ejemplo del área ansiedad (1 de 3). Pensá qué creencia nuclear podría estar debajo de esa regla.", "options": [ "Desamparo", "Desamor", "Desvalorización" ], "feedback": { "Desamparo": "**Exacto.** La creencia nuclear probable es «no puedo con la incertidumbre». La idea central del desamparo es «soy impotente / incapaz».", "Desamor": "**No en este caso.** La regla no habla de ser querido: habla de control. La creencia probable es «no puedo con la incertidumbre», del dominio **desamparo** («soy impotente / incapaz»).", "Desvalorización": "**No en este caso.** La regla no habla de valer o de ser defectuoso: habla de control. La creencia probable es «no puedo con la incertidumbre», del dominio **desamparo** («soy impotente / incapaz»)." } }, { "id": "quiz_pareja", "type": "choice", "prompt": "«Si me muestro como soy, me van a dejar»: ¿a qué dominio apunta?", "help": "Ejemplo del área pareja (2 de 3).", "options": [ "Desamparo", "Desamor", "Desvalorización" ], "feedback": { "Desamor": "**Exacto.** La creencia nuclear probable es «no soy querible», la idea central del desamor.", "Desamparo": "**No en este caso.** El temor no es a no poder con algo, sino al abandono: «me van a dejar». La creencia probable es «no soy querible», del dominio **desamor**.", "Desvalorización": "**No en este caso.** El temor central no es a no valer, sino al abandono: «me van a dejar». La creencia probable es «no soy querible», del dominio **desamor**." } }, { "id": "quiz_depresion", "type": "choice", "prompt": "«Si no soy productivo, no valgo»: ¿a qué dominio apunta?", "help": "Ejemplo del área depresión (3 de 3).", "options": [ "Desamparo", "Desamor", "Desvalorización" ], "feedback": { "Desvalorización": "**Exacto.** La creencia nuclear probable es «no sirvo». La idea central de la desvalorización es «no valgo / soy defectuoso».", "Desamparo": "**No en este caso.** No dice «no puedo», dice «no valgo». La creencia probable es «no sirvo», del dominio **desvalorización**.", "Desamor": "**No en este caso.** No habla de ser querido, sino de valer. La creencia probable es «no sirvo», del dominio **desvalorización**." } }, { "id": "tecnicas", "type": "info", "title": "Técnicas para empezar a modificarlas", "content": "- **Registro de datos positivos:** anotar cada día evidencia, por pequeña que sea, que contradiga la creencia nuclear negativa.\n- **Continuo cognitivo:** en vez de «valgo / no valgo», ubicar la situación en una escala de 0 a 100 para romper el todo o nada.\n- **Reescribir la regla:** convertir «tengo que ser perfecto» en «prefiero hacerlo bien, y el error es parte de aprender».\n- **Actuar contra la regla (experimentos):** pedir ayuda a propósito y observar qué pasa realmente.\n- **Creencia nuclear alternativa:** formular una versión más ajustada («soy suficiente, con virtudes y límites») y buscar evidencia que la sostenga." }, { "id": "carla", "type": "info", "title": "Caso clínico: Carla, 38 años", "content": "**Depresión y sobreexigencia.** Carla llega agotada. Trabaja de más, no delega y se siente vacía. Con la flecha descendente aparece: «si dejo de rendir, van a ver quién soy realmente» → creencia nuclear de desvalorización: «no valgo por mí, solo por lo que produzco».\n\n**Trabajo en sesión:** se identifica el supuesto («si produzco, valgo»), se reescribe la regla y se diseña un experimento: delegar una tarea y registrar qué pasa con su valor a los ojos de los demás. La creencia empieza a resquebrajarse cuando la evidencia real no coincide con la predicción." }, { "id": "guiado_intro", "type": "info", "title": "Ejercicio guiado: de la hoja a la raíz", "content": "Ahora te toca a vos:\n\n1. Elegí un pensamiento automático que te traiga mucha emoción.\n2. Aplicá la flecha descendente al menos tres veces.\n3. Cuando llegues a una frase corta sobre vos («soy…», «no…»), detenete: probablemente sea una creencia nuclear.\n4. Ubicala en uno de los tres dominios.\n5. Escribí la regla o supuesto que usás para no sentir esa creencia.\n6. Formulá una creencia alternativa más ajustada y realista.\n\n**Andá a tu ritmo.** Si te moviliza mucho, frená, usá **Calmarme** y retomalo en sesión. En caso de crisis, pedí ayuda ya a una línea de ayuda, a emergencias o en la guardia del hospital más cercano; en **Calmarme** está el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "pensamiento", "type": "text", "prompt": "¿Qué pensamiento automático te trae mucha emoción?", "help": "Escribilo tal como aparece. En el ejemplo: «Me equivoqué en la reunión.»" }, { "id": "flecha_1", "type": "text", "prompt": "Si eso fuera cierto, ¿qué significaría?", "help": "En el ejemplo: «Que van a notar que no sé.»" }, { "id": "flecha_2", "type": "text", "prompt": "Y si eso fuera cierto, ¿qué significaría?", "help": "En el ejemplo: «Que no estoy a la altura del puesto.»" }, { "id": "flecha_3", "type": "text", "prompt": "¿Y eso qué diría de vos?", "help": "En el ejemplo: «Que no sirvo.» Si llegaste a una frase corta sobre vos («soy…», «no…»), probablemente sea la creencia nuclear." }, { "id": "flecha_4", "type": "text", "prompt": "Si todavía no llegaste a una frase corta sobre vos: ¿y eso qué significaría?", "help": "Seguí preguntando hasta llegar a la idea de fondo. Si ya llegaste, tocá «Saltar».", "optional": true }, { "id": "creencia", "type": "text", "prompt": "¿A qué creencia nuclear llegaste?", "help": "Una frase corta sobre vos: «soy…», «no…». En el ejemplo: «No sirvo.»" }, { "id": "dominio", "type": "choice", "prompt": "¿En qué dominio la ubicás?", "options": [ "Desamparo: «soy impotente / incapaz»", "Desamor: «no soy querible»", "Desvalorización: «no valgo / soy defectuoso»", "No lo tengo claro" ], "feedback": { "Desamparo: «soy impotente / incapaz»": "Otras creencias de este dominio: «no puedo con nada», «soy débil», «no tengo control», «estoy atrapado».", "Desamor: «no soy querible»": "Otras creencias de este dominio: «no merezco cariño», «voy a terminar solo», «hay algo malo en mí».", "Desvalorización: «no valgo / soy defectuoso»": "Otras creencias de este dominio: «soy un fracaso», «no sirvo», «soy mala persona». Es el dominio del ejemplo de la reunión y del caso de Carla.", "No lo tengo claro": "Está bien: no siempre es evidente. Seguí con el ejercicio y revisalo en sesión con tu psicólogo." } }, { "id": "regla", "type": "text", "prompt": "¿Qué regla o supuesto usás para no sentir esa creencia?", "help": "Puede ser una actitud («es terrible…»), una regla («nunca debo…», «tengo que…») o un «si… entonces…». Carla: «si produzco, valgo»." }, { "id": "alternativa", "type": "text", "prompt": "¿Qué creencia alternativa, más ajustada y realista, podés formular?", "help": "Por ejemplo: «soy suficiente, con virtudes y límites»." }, { "id": "hoja", "type": "reflect", "title": "Tu hoja: reglas, supuestos y creencia nuclear", "template": "Pensamiento de partida: «{{pensamiento}}». Flecha descendente: «{{flecha_1}}» → «{{flecha_2}}» → «{{flecha_3}}». Creencia nuclear: «{{creencia}}» ({{dominio}}). Regla o supuesto que la protege: «{{regla}}». Creencia alternativa: «{{alternativa}}».", "content": "Tu hoja se guarda cuando tocás «Terminar», al final del ejercicio: la vas a poder volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también la puede ver." }, { "id": "registro", "type": "reflect", "title": "Registro de creencia nuclear alternativa", "template": "Creencia antigua: «{{creencia}}». Creencia nueva, más ajustada: «{{alternativa}}».", "content": "La creencia nueva se sostiene con evidencia. En la próxima pantalla anotá pruebas que la apoyen, por pequeñas que sean." }, { "id": "registro_evidencia", "type": "list", "prompt": "¿Qué evidencia apoya tu creencia nueva?", "help": "Hechos de hoy o de tu historia, por mínimos que sean. Completá los que puedas: la idea es sumar una prueba por día y seguir durante la semana en «Registro de creencias nucleares».", "count": 5, "min": 1 }, { "id": "refl_herencia", "type": "text", "prompt": "¿Qué reglas de vida heredaste sin haberlas elegido?", "help": "Preguntas de reflexión: respondé las que quieras, podés saltear cualquiera.", "optional": true }, { "id": "refl_dominio", "type": "choice", "prompt": "¿Cuál de los tres dominios resuena más con vos?", "options": [ "Desamparo", "Desamor", "Desvalorización" ], "optional": true }, { "id": "refl_tema", "type": "text", "prompt": "¿Qué tema se repite en tus conflictos, sin importar el área?", "optional": true }, { "id": "refl_evitar", "type": "text", "prompt": "¿Qué hacés para no sentir tu creencia nuclear más dolorosa?", "optional": true }, { "id": "refl_regla", "type": "text", "prompt": "¿Cómo sería tu vida si esa regla dejara de mandar?", "optional": true }, { "id": "refl_creerte", "type": "text", "prompt": "¿Qué creencia alternativa te gustaría poder creerte de verdad?", "optional": true }, { "id": "refl_historia", "type": "text", "prompt": "¿Qué evidencia de tu historia contradice tu creencia negativa?", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- Hay tres niveles: pensamientos automáticos (hojas), creencias intermedias (tronco) y nucleares (raíz).\n- Las creencias intermedias son actitudes, reglas y supuestos condicionales.\n- Las creencias nucleares negativas se agrupan en desamparo, desamor y desvalorización.\n- Se llega a ellas con la flecha descendente: «si fuera cierto, ¿qué significaría?».\n- Se modifican con evidencia, continuo cognitivo, reescritura de reglas y experimentos." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "Tareas para casa, a lo largo de la semana:\n\n- Aplicá la flecha descendente a **dos pensamientos** distintos: podés volver a hacer este ejercicio con cada uno (la parte práctica lleva unos 10 minutos).\n- Identificá una regla «si… entonces…» que ordena tu conducta y escribila.\n- Registrá cada día una prueba, mínima, a favor de tu creencia alternativa: podés usar «Registro de creencias nucleares» (unos 5 minutos).\n- Diseñá un pequeño experimento para actuar en contra de una de tus reglas y anotá el resultado.\n\nEl próximo capítulo es **«Cuestionamiento socrático y reestructuración»**." } ]$steps$::jsonb),
  ('tcc-reestructuracion', 'Cuestionamiento socrático y reestructuración', 'Cuestioná un pensamiento con preguntas socráticas y construí uno alternativo con el registro de 7 columnas.', 'thought_record', 'tcc', 'adultos', 'tcc', 20, 205,
   $steps$[ { "id": "intro", "type": "info", "title": "El motor del cambio", "content": "Ya sabés detectar pensamientos, distorsiones y creencias. Ahora viene el motor del cambio: aprender a ponerlos a prueba con preguntas y a construir formas de pensar más ajustadas y útiles.\n\nCuestionar no es discutir con vos mismo ni obligarte a pensar bonito. Es hacerte buenas preguntas, como un **detective curioso** que quiere ver toda la evidencia antes de dar un veredicto. En vez de creerle al primer pensamiento, lo tratás como una hipótesis: «¿es esto realmente cierto?, ¿qué pruebas tengo a favor y en contra?, ¿hay otra forma de verlo?»." }, { "id": "profundizar", "type": "info", "title": "Para profundizar (opcional)", "content": "El **cuestionamiento socrático** es un método de descubrimiento guiado: mediante preguntas abiertas, el terapeuta ayuda a la persona a examinar sus propios pensamientos y llegar a conclusiones más ajustadas por sí misma, en lugar de imponerle una interpretación.\n\nLa **reestructuración cognitiva** es el proceso más amplio de identificar, evaluar y modificar cogniciones desadaptativas; el diálogo socrático es una de sus herramientas centrales, junto con los experimentos conductuales y la búsqueda de evidencia." }, { "id": "actitud", "type": "info", "title": "La actitud correcta", "content": "El objetivo no es «ganar» ni convencer, sino abrir la mirada. Una buena pregunta socrática genera una duda genuina, no una respuesta forzada.\n\n**La regla de oro:** preguntar con curiosidad real, no para llevar a la persona a donde ya decidimos." }, { "id": "preguntas", "type": "info", "title": "Las preguntas fundamentales", "content": "Podés agrupar el cuestionamiento en cuatro familias de preguntas:\n\n- **Examinar la evidencia:** ¿Qué pruebas tengo a favor de este pensamiento? ¿Qué pruebas tengo en contra? ¿Estoy tomando una suposición como un hecho?\n- **Buscar alternativas:** ¿Hay otra forma de ver esto? ¿Qué diría alguien que me quiere bien? ¿Qué le diría yo a un amigo en esta situación?\n- **Descatastrofizar:** ¿Qué es lo peor que podría pasar? ¿Y lo mejor? ¿Qué es lo más probable? Si pasara lo peor, ¿cómo lo afrontaría?\n- **Evaluar la utilidad:** ¿Me sirve pensar así? ¿Qué efecto tiene en mí creer esto? ¿Qué ganaría pensándolo de otro modo?" }, { "id": "quiz_familia_1", "type": "choice", "prompt": "«Si pasara lo peor, ¿cómo lo afrontaría?»: ¿de qué familia es?", "help": "Repaso rápido (1 de 2).", "options": [ "Examinar la evidencia", "Buscar alternativas", "Descatastrofizar", "Evaluar la utilidad" ], "feedback": { "Descatastrofizar": "**Exacto.** Es de la familia descatastrofizar, junto con «¿Qué es lo peor que podría pasar? ¿Y lo mejor? ¿Qué es lo más probable?».", "Examinar la evidencia": "**No.** Esa familia pregunta por pruebas a favor y en contra. Esta mira lo peor y cómo lo afrontarías: es de **descatastrofizar**.", "Buscar alternativas": "**No.** Esa familia busca otra forma de ver la situación. Esta mira lo peor y cómo lo afrontarías: es de **descatastrofizar**.", "Evaluar la utilidad": "**No.** Esa familia pregunta si te sirve pensar así. Esta mira lo peor y cómo lo afrontarías: es de **descatastrofizar**." } }, { "id": "quiz_familia_2", "type": "choice", "prompt": "«¿Qué le diría yo a un amigo en esta situación?»: ¿de qué familia es?", "help": "Repaso rápido (2 de 2).", "options": [ "Examinar la evidencia", "Buscar alternativas", "Descatastrofizar", "Evaluar la utilidad" ], "feedback": { "Buscar alternativas": "**Exacto.** Es de la familia buscar alternativas, junto con «¿Hay otra forma de ver esto?» y «¿Qué diría alguien que me quiere bien?».", "Examinar la evidencia": "**No.** Esa familia pregunta por pruebas a favor y en contra. Esta busca otra forma de ver la situación: es de **buscar alternativas**.", "Descatastrofizar": "**No.** Esa familia mira lo peor, lo mejor y lo más probable. Esta busca otra forma de ver la situación: es de **buscar alternativas**.", "Evaluar la utilidad": "**No.** Esa familia pregunta si te sirve pensar así. Esta busca otra forma de ver la situación: es de **buscar alternativas**." } }, { "id": "quiz_retorica", "type": "choice", "prompt": "¿Cuál de estas dos es una pregunta socrática?", "options": [ "«¿No te parece que exagerás?»", "«¿Qué pruebas tengo en contra de este pensamiento?»" ], "feedback": { "«¿No te parece que exagerás?»": "**No es socrática.** Es una pregunta retórica disfrazada: ya trae la respuesta metida. Una buena pregunta socrática genera una duda genuina, no una respuesta forzada.", "«¿Qué pruebas tengo en contra de este pensamiento?»": "**Exacto.** Es una pregunta abierta, de la familia examinar la evidencia: no trae la respuesta puesta, invita a mirar los datos con curiosidad." } }, { "id": "errores", "type": "info", "title": "Errores frecuentes", "content": "Qué se confunde y cómo evitarlo:\n\n- **Convertir el socrático en interrogatorio.** Si la persona (o vos mismo) se siente acorralada, se cierra. Preguntá desde la curiosidad.\n- **Preguntas retóricas disfrazadas.** «¿No te parece que exagerás?» no es socrático: ya trae la respuesta metida.\n- **Buscar el pensamiento «positivo».** La meta es un pensamiento creíble y ajustado, no uno alegre que no te creés.\n- **Saltar la evidencia en contra propia.** Es fácil listar pruebas a favor del pensamiento negativo y olvidar las de en contra: forzate a buscar ambas.\n- **Quedarse solo en las palabras.** A veces el mejor cuestionamiento es un experimento: probar en la realidad, no solo debatir en la cabeza." }, { "id": "pasos", "type": "info", "title": "Reestructuración cognitiva paso a paso", "content": "1. Identificá la situación y la emoción (con intensidad 0–100).\n2. Escribí el pensamiento automático caliente y su credibilidad (0–100).\n3. Nombrá la distorsión, si la hay.\n4. Buscá evidencia **a favor** del pensamiento (hechos, no interpretaciones).\n5. Buscá evidencia **en contra** (lo que solés pasar por alto).\n6. Construí un pensamiento alternativo que integre toda la evidencia, no que niegue lo negativo.\n7. Volvé a puntuar: credibilidad del pensamiento original e intensidad de la emoción. ¿Bajaron?" }, { "id": "alternativo_info", "type": "info", "title": "Cómo construir un buen pensamiento alternativo", "content": "- Que sea creíble para vos (si no te lo creés, no funciona).\n- Que integre lo cierto del pensamiento original sin quedarse solo en eso.\n- Que sea equilibrado, no un eslogan optimista.\n- Que puedas usarlo la próxima vez que aparezca la situación." }, { "id": "quiz_alternativo", "type": "choice", "prompt": "Para «voy a fracasar seguro», ¿cuál es un pensamiento alternativo ajustado?", "options": [ "«Me va a salir perfecto»", "«No sé cómo va a salir, me preparé razonablemente y, pase lo que pase, puedo manejarlo»" ], "feedback": { "«Me va a salir perfecto»": "**No.** Es el opuesto forzado: un eslogan optimista que difícilmente te creas. Un alternativo ajustado sería: «no sé cómo va a salir, me preparé razonablemente y, pase lo que pase, puedo manejarlo».", "«No sé cómo va a salir, me preparé razonablemente y, pase lo que pase, puedo manejarlo»": "**Exacto.** Es creíble, equilibrado y lo podés usar la próxima vez. No es «voy a fracasar seguro» ni su opuesto forzado, «me va a salir perfecto»." } }, { "id": "areas_1", "type": "info", "title": "Ejemplos por área (1 de 2)", "content": "Del pensamiento automático al alternativo ajustado:\n\n- **Ansiedad:** «Me va a dar un ataque y no lo soporto» → «La ansiedad es intensa pero pasa; ya la atravesé antes».\n- **Depresión:** «No sirvo para nada» → «Hoy me cuesta, pero hay cosas que sí hago y sí me importan».\n- **Pareja:** «No le importo» → «No me escribió; puede haber muchas razones que no tienen que ver conmigo».\n- **Autoestima:** «Todos lo hacen mejor que yo» → «Cada uno tiene su ritmo; yo también tengo avances»." }, { "id": "areas_2", "type": "info", "title": "Ejemplos por área (2 de 2)", "content": "- **Trabajo:** «Un error y arruiné todo» → «Cometí un error puntual; el resto del trabajo sigue en pie».\n- **Universidad:** «Si repruebo, soy un fracaso» → «Reprobar una materia es un traspié, no una definición de quién soy».\n- **Duelo:** «No tengo derecho a estar bien» → «Puedo extrañar y a la vez seguir viviendo; ambas cosas conviven».\n- **Perfeccionismo:** «Si no es perfecto, no vale» → «Bien hecho es suficiente; lo perfecto no existe y me agota»." }, { "id": "ana", "type": "info", "title": "Caso clínico: Ana, 26 años", "content": "**Ansiedad social.** Ana evita reuniones por miedo a «quedar en ridículo». Pensamiento caliente: «todos van a ver que estoy nerviosa y me van a juzgar» (lectura de mente + catastrofización), credibilidad 90.\n\n- **Evidencia a favor:** «a veces me tiembla la voz».\n- **Evidencia en contra:** «nunca nadie me lo comentó, me han invitado de nuevo, yo no juzgo a otros por estar nerviosos».\n- **Alternativo:** «puedo estar algo nerviosa y aun así participar; la mayoría está pendiente de lo suyo, no de mí».\n\nLa credibilidad del original baja a 40; la ansiedad, de 80 a 50. Se cierra con un experimento: ir a una reunión y registrar cuántos comentarios recibe realmente." }, { "id": "guiado_intro", "type": "info", "title": "Ejercicio guiado: tu primera reestructuración", "content": "Tomá un pensamiento caliente de tus registros y recorré el formulario completo, columna por columna, **sin saltarte la evidencia en contra**.\n\nEs el registro de pensamientos de 7 columnas: situación, emoción, pensamiento automático, distorsión, evidencia a favor, evidencia en contra y pensamiento alternativo con nueva puntuación. En cada pregunta vas a ver cómo lo hizo Ana.\n\nSi empezaste un registro en «Los pensamientos automáticos» o en «Registro de pensamientos (RPD)», retomalo acá: está en «Mis respuestas» de ese ejercicio. Si salís a buscarlo, este ejercicio vuelve a empezar (hasta acá solo respondiste los repasos)." }, { "id": "situacion", "type": "text", "prompt": "1. Situación: ¿qué pasó?", "help": "Dónde, cuándo, con quién. Ana: una reunión, de esas que suele evitar por miedo a «quedar en ridículo»." }, { "id": "emocion", "type": "checklist", "prompt": "2. Emoción: ¿qué sentiste?", "help": "Cada emoción se nombra con una sola palabra. Marcá hasta tres. Ana sintió ansiedad.", "options": [ "Angustia", "Ansiedad", "Miedo", "Nerviosismo", "Pánico", "Bronca", "Tristeza", "Vergüenza", "Culpa", "Frustración", "Inseguridad", "Otra" ], "max": 3 }, { "id": "emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "emocion_intensidad", "type": "scale", "prompt": "¿Con qué intensidad la sentiste? (de 0 a 100)", "help": "Si marcaste más de una, puntuá la más fuerte. Ana: ansiedad, 80.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima" }, { "id": "pensamiento", "type": "text", "prompt": "3. Pensamiento automático: ¿qué pensaste?", "help": "El pensamiento caliente, tal como apareció. Ana: «todos van a ver que estoy nerviosa y me van a juzgar»." }, { "id": "credibilidad", "type": "scale", "prompt": "¿Cuánto creés ese pensamiento? (de 0 a 100)", "help": "Ana: 90.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "distorsion", "type": "checklist", "prompt": "4. Distorsión: ¿cuál o cuáles encajan?", "help": "Si la hay; puede haber más de una. Ana: lectura de mente + catastrofización.", "options": [ "Todo o nada", "Sobregeneralización", "Filtro mental", "Descalificar lo positivo", "Lectura de mente", "Adivinación del futuro", "Catastrofización", "Razonamiento emocional", "Debería / tener que", "Etiquetación", "Personalización", "Culpabilización", "No encuentro ninguna" ] }, { "id": "evidencia_favor", "type": "text", "prompt": "5. Evidencia a favor: ¿qué hechos apoyan el pensamiento?", "help": "Hechos, no interpretaciones. Ana: «a veces me tiembla la voz»." }, { "id": "evidencia_contra", "type": "text", "prompt": "6. Evidencia en contra: ¿qué hechos no encajan con el pensamiento?", "help": "Lo que solés pasar por alto: forzate a buscarla. Te pueden ayudar estas preguntas: ¿estoy tomando una suposición como un hecho? ¿Qué le diría yo a un amigo en esta situación?\n\nAna: «nunca nadie me lo comentó, me han invitado de nuevo, yo no juzgo a otros por estar nerviosos»." }, { "id": "alternativo", "type": "text", "prompt": "7. Pensamiento alternativo: ¿qué forma más ajustada hay de verlo?", "help": "Que integre toda la evidencia, no que niegue lo negativo: creíble, equilibrado y que puedas usar la próxima vez.\n\nAna: «puedo estar algo nerviosa y aun así participar; la mayoría está pendiente de lo suyo, no de mí»." }, { "id": "credibilidad_alternativo", "type": "scale", "prompt": "¿Cuánto creés el pensamiento alternativo? (de 0 a 100)", "help": "Si no te lo creés, no funciona: si da muy bajo, volvé atrás y ajustalo.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "credibilidad_despues", "type": "scale", "prompt": "¿Cuánto creés ahora el pensamiento automático del principio? (de 0 a 100)", "help": "Ana: bajó de 90 a 40.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "emocion_despues", "type": "scale", "prompt": "¿Con qué intensidad sentís ahora la emoción? (de 0 a 100)", "help": "Puntuá la misma emoción de antes. Ana: la ansiedad bajó de 80 a 50.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima" }, { "id": "resumen", "type": "reflect", "title": "Tu reestructuración", "template": "Situación: «{{situacion}}». Pensamiento automático: «{{pensamiento}}». Distorsión: {{distorsion}}. Evidencia a favor: «{{evidencia_favor}}». Evidencia en contra: «{{evidencia_contra}}». Pensamiento alternativo: «{{alternativo}}».", "content": "Compará tus puntuaciones de antes y de ahora (con «Atrás» las volvés a ver): ¿bajaron la credibilidad del pensamiento y la intensidad de la emoción?\n\nTu registro se guarda cuando tocás «Terminar», al final del ejercicio: lo vas a poder volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." }, { "id": "refl_preguntas", "type": "text", "prompt": "¿Qué preguntas socráticas te resultan más útiles?", "help": "Preguntas de reflexión: respondé las que quieras, podés saltear cualquiera.", "optional": true }, { "id": "refl_cuesta", "type": "choice", "prompt": "¿Te cuesta más buscar la evidencia en contra o construir el alternativo?", "options": [ "Buscar la evidencia en contra", "Construir el alternativo", "Las dos por igual" ], "optional": true }, { "id": "refl_cuerpo", "type": "text", "prompt": "¿Qué pasa en tu cuerpo cuando un pensamiento pierde credibilidad?", "optional": true }, { "id": "refl_experimento", "type": "text", "prompt": "¿En qué situaciones el mejor cuestionamiento sería un experimento y no un debate?", "optional": true }, { "id": "refl_hablarte", "type": "text", "prompt": "¿Cómo te hablarías si te trataras como a alguien que querés?", "optional": true }, { "id": "refl_a_mano", "type": "text", "prompt": "¿Qué pensamiento alternativo te gustaría tener a mano para tu situación más difícil?", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- El cuestionamiento socrático es descubrimiento guiado, no discusión ni interrogatorio.\n- Cuatro familias de preguntas: evidencia, alternativas, descatastrofizar y utilidad.\n- La reestructuración va de la situación al pensamiento alternativo, pasando por la evidencia.\n- Un buen alternativo es creíble, equilibrado y utilizable, no un eslogan optimista.\n- A veces el mejor cuestionamiento es un experimento en la realidad." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "Tareas para casa, a lo largo de la semana:\n\n- Completá el formulario de 7 columnas con al menos **tres pensamientos**: volvé a hacer este ejercicio con cada uno (el formulario lleva unos 5 a 10 minutos).\n- En cada uno, obligate a escribir tanta evidencia en contra como a favor.\n- Diseñá un experimento conductual para poner a prueba una predicción negativa.\n- Anotá si, al usar el pensamiento alternativo, la emoción baja de intensidad.\n- Repasá «50 preguntas socráticas» y elegí tus cinco favoritas.\n\nEl próximo capítulo es **«El modelo ABC de Ellis»**." } ]$steps$::jsonb),
  ('tcc-abc-ellis', 'El modelo ABC de Ellis', 'Descubrí cómo tus «debo» inflan el malestar y convertilos en preferencias flexibles con el registro ABCDE.', 'thought_record', 'tcc', 'adultos', 'tcc', 20, 206,
   $steps$[ { "id": "intro", "type": "info", "title": "El modelo ABC de Ellis", "content": "Albert Ellis llegó, por otro camino, a una idea muy parecida a la de Beck: **no son los hechos los que nos perturban, sino las creencias con las que los interpretamos**.\n\nSu modelo ABC ordena ese proceso de una forma simple y potente." }, { "id": "sencilla", "type": "info", "title": "Explicación sencilla", "content": "Ellis lo resumía con una frase antigua, de Epicteto: «Las personas no se perturban por las cosas, sino por la opinión que tienen de ellas».\n\nEl modelo ABC dice: pasa algo (**A**), lo interpretás con ciertas creencias (**B**), y de ahí surge lo que sentís y hacés (**C**).\n\nLa mayoría cree que A causa C directamente («me dejaron, por eso sufro»), pero **en el medio siempre está B**." }, { "id": "clinica", "type": "info", "title": "Para profundizar (opcional)", "content": "Es la explicación clínica. Si preferís, pasá a la pantalla siguiente.\n\nLa Terapia Racional Emotiva Conductual (TREC/REBT) de Ellis sostiene que la perturbación emocional deriva de **creencias irracionales**: exigencias absolutas y rígidas («debo», «tengo que», «debería») desde las que se derivan tres conclusiones típicas:\n\n- el **tremendismo** (catastrofizar);\n- la **baja tolerancia a la frustración** («no lo soporto»);\n- la **condena global** de sí mismo o de otros («soy un inútil», «es una mala persona»).\n\nEl trabajo terapéutico consiste en detectar esas exigencias, debatirlas y sustituirlas por preferencias flexibles." }, { "id": "letras", "type": "info", "title": "Las letras del modelo", "content": "- **A — Acontecimiento activador.** El hecho o situación (real o imaginado) que dispara el proceso.\n- **B — Creencias (Beliefs).** Lo que la persona piensa y cree sobre A. Aquí está el corazón del malestar.\n- **C — Consecuencias.** Las emociones, sensaciones físicas y conductas que resultan de B.\n- **D — Debate (Disputa).** Cuestionar y confrontar las creencias irracionales de B.\n- **E — Nueva filosofía (Effect).** El efecto: una creencia más racional y una emoción más adaptativa." }, { "id": "irracional_racional", "type": "info", "title": "Creencias irracionales vs. racionales", "content": "- **Irracional (exigencia):** «Debo caerle bien a todos; si no, es horrible y no lo soporto.»\n- **Racional (preferencia):** «Me gustaría caer bien, pero no siempre va a pasar, y puedo tolerarlo.»\n\nEl giro central de Ellis: pasar de la **exigencia rígida** («tengo que») a la **preferencia flexible** («prefiero»)." }, { "id": "reconocer", "type": "info", "title": "¿Cómo reconocer una creencia irracional?", "content": "- Contiene una **exigencia absoluta**: «debo», «tengo que», «debería», «no puede ser que».\n- Concluye en **tremendismo**: «es horrible», «es lo peor que podría pasar».\n- Expresa **baja tolerancia a la frustración**: «no lo soporto», «no puedo con esto».\n- Termina en **condena global**: «soy un inútil», «es un desastre de persona»." }, { "id": "debate", "type": "info", "title": "Debate: cómo disputar la creencia (D)", "content": "Ellis proponía tres tipos de debate, que podés combinar:\n\n- **Empírico (¿es verdad?):** ¿Dónde está la prueba de que esto DEBE ser así?\n- **Lógico (¿tiene sentido?):** ¿Se sigue lógicamente que, porque lo prefiero, tenga que ocurrir?\n- **Pragmático (¿me sirve?):** ¿Adónde me lleva sostener esta exigencia? ¿Me ayuda o me hunde?" }, { "id": "ejemplos_1", "type": "info", "title": "Ejemplos por área (1 de 2)", "content": "Del hecho (A) a la creencia irracional (B) y a la racional (E):\n\n- **Ansiedad.** A: debo dar una charla. B: «Tengo que hacerlo perfecto o es un desastre». E: «Quiero hacerlo bien; equivocarme es humano».\n- **Depresión.** A: un plan se cae. B: «Nada me sale, no lo soporto». E: «Es frustrante, y aun así puedo seguir».\n- **Pareja.** A: una discusión. B: «Si discutimos, es que no me ama». E: «Discutir es normal; no define el amor».\n- **Autoestima.** A: una crítica. B: «No debería equivocarme nunca». E: «Puedo equivocarme y seguir valiendo»." }, { "id": "ejemplos_2", "type": "info", "title": "Ejemplos por área (2 de 2)", "content": "- **Trabajo.** A: un pedido difícil. B: «Debo poder con todo solo». E: «Puedo pedir ayuda; no me hace menos».\n- **Universidad.** A: una nota baja. B: «Tengo que ser el mejor siempre». E: «Prefiero ir bien; una nota no me define».\n- **Duelo.** A: sentir alivio. B: «No debería sentir esto, soy horrible». E: «Los sentimientos mezclados son normales».\n- **Perfeccionismo.** A: un detalle falla. B: «No puede tener ni un error». E: «Prefiero la excelencia, no la perfección»." }, { "id": "te_suena", "type": "checklist", "prompt": "¿Alguna de estas creencias te suena?", "help": "Marcá las que se parezcan a cosas que te decís. Si ninguna, tocá «Saltar».", "optional": true, "options": [ "«Tengo que hacerlo perfecto o es un desastre»", "«Nada me sale, no lo soporto»", "«Si discutimos, es que no me ama»", "«No debería equivocarme nunca»", "«Debo poder con todo solo»", "«Tengo que ser el mejor siempre»", "«No debería sentir esto, soy horrible»", "«No puede tener ni un error»" ] }, { "id": "ellis_beck", "type": "info", "title": "Ellis y Beck: comparación", "content": "Los dos modelos son primos: ambos ubican la interpretación en el centro. Se diferencian en el énfasis y el estilo.\n\n- **Foco principal.** Beck: pensamientos automáticos, distorsiones y esquemas. Ellis: creencias irracionales y exigencias absolutas.\n- **Diana del cambio.** Beck: ajustar la interpretación a la evidencia. Ellis: cambiar exigencias por preferencias.\n- **Método típico.** Beck: descubrimiento guiado (socrático), experimentos. Ellis: debate más directo y confrontativo de creencias.\n- **Estructura.** Beck: situación → pensamiento → emoción → conducta. Ellis: A → B → C → D → E.\n- **Estilo del terapeuta.** Beck: colaborativo, empírico. Ellis: activo, didáctico, a veces provocador.\n- **Qué comparten.** La interpretación (B / pensamiento) media entre el hecho y la emoción: el malestar no viene del hecho, sino de la creencia." }, { "id": "errores", "type": "info", "title": "Errores frecuentes", "content": "Qué se confunde y cómo evitarlo:\n\n- **Confundir A con C.** «Me sentí humillado» no es el hecho (A), es la consecuencia (C). El hecho es «me corrigieron delante de otros».\n- **Meter la creencia dentro de A.** «Me trataron injustamente» ya es interpretación (B). En A va solo lo observable.\n- **Debatir la emoción en vez de la creencia.** No se debate sentir tristeza; se debate la exigencia que la infla.\n- **Cambiar exigencia por otra exigencia.** «Debo dejar de exigirme» sigue siendo un «debo». Apuntá a la preferencia flexible.\n\nEn las próximas pantallas, probá distinguirlos." }, { "id": "quiz_1", "type": "choice", "prompt": "«Me corrigieron delante de otros». ¿Qué letra es?", "help": "1 de 4.", "options": [ "A — Acontecimiento", "B — Creencia", "C — Consecuencia" ], "feedback": { "A — Acontecimiento": "**¡Bien! Es A:** el hecho observable, sin interpretaciones. En A va solo lo observable; la interpretación ya sería B.", "B — Creencia": "**Es A:** el hecho observable. B sería lo que la persona piensa y cree sobre ese hecho; por ejemplo, «me trataron injustamente».", "C — Consecuencia": "**Es A:** el hecho observable. C es lo que resulta de B: emociones, sensaciones físicas y conductas, como sentirse humillado." } }, { "id": "quiz_2", "type": "choice", "prompt": "«Me sentí humillado». ¿Qué letra es?", "help": "2 de 4.", "options": [ "A — Acontecimiento", "B — Creencia", "C — Consecuencia" ], "feedback": { "A — Acontecimiento": "**Es C, no A.** Es un error frecuente: «me sentí humillado» no es el hecho, es la consecuencia. El hecho es «me corrigieron delante de otros».", "B — Creencia": "**Es C:** una emoción, no una creencia. B es lo que la persona piensa sobre el hecho; la humillación es lo que resulta de eso.", "C — Consecuencia": "**¡Bien! Es C:** la consecuencia. Las emociones, sensaciones físicas y conductas que resultan de B." } }, { "id": "quiz_3", "type": "choice", "prompt": "«Me trataron injustamente». ¿Qué letra es?", "help": "3 de 4.", "options": [ "A — Acontecimiento", "B — Creencia", "C — Consecuencia" ], "feedback": { "A — Acontecimiento": "**Es B.** Parece un hecho, pero ya es interpretación. Meter la creencia dentro de A es un error frecuente: en A va solo lo observable.", "B — Creencia": "**¡Bien! Es B:** ya es interpretación. Meter la creencia dentro de A es un error frecuente; en A va solo lo observable.", "C — Consecuencia": "**Es B:** una interpretación del hecho. C sería la emoción o la conducta que resulta de esa creencia." } }, { "id": "quiz_4", "type": "choice", "prompt": "«Debo dejar de exigirme». ¿Qué es?", "help": "4 de 4.", "options": [ "Una exigencia rígida", "Una preferencia flexible" ], "feedback": { "Una exigencia rígida": "**¡Bien!** Aunque hable de exigirse menos, sigue siendo un «debo». Cambiar una exigencia por otra es un error frecuente: apuntá a la preferencia flexible («prefiero», «me gustaría»).", "Una preferencia flexible": "**Es una exigencia.** Aunque hable de exigirse menos, sigue siendo un «debo». Cambiar una exigencia por otra es un error frecuente: apuntá a la preferencia flexible («prefiero», «me gustaría»)." } }, { "id": "diego", "type": "info", "title": "Caso clínico: Diego, 31 años", "content": "**Ira y pareja.** Diego estalla cuando su pareja llega tarde.\n\n- **A:** la pareja llega 20 minutos tarde.\n- **B:** «no tiene ningún derecho a hacerme esperar, debería respetarme siempre, esto es intolerable».\n- **C:** ira intensa, reproche, portazo.\n\n**Debate (D):** ¿dónde está escrito que SIEMPRE debe ser puntual? ¿Es intolerable o muy molesto? ¿Le sirve reaccionar así?\n\n**Nueva filosofía (E):** «prefiero que sea puntual y me molesta que no lo sea, pero no es una catástrofe ni una falta de respeto absoluta; puedo decirlo con calma». La emoción pasa de ira a fastidio manejable." }, { "id": "guiado", "type": "info", "title": "Tu primer ABCDE", "content": "Elegí una situación reciente que te haya alterado. Vas a completar tu registro ABCDE en este orden, una pregunta por vez:\n\n1. En **A**, escribí solo el hecho observable, sin interpretaciones.\n2. En **C**, anotá qué sentiste y qué hiciste.\n3. En **B**, buscá la creencia: ¿qué exigencia («debo/debería/tengo que») estaba detrás?\n4. En **D**, debatila con las tres preguntas: ¿es verdad?, ¿tiene lógica?, ¿me sirve?\n5. En **E**, escribí la versión racional, en forma de preferencia flexible." }, { "id": "a_hecho", "type": "text", "prompt": "A — ¿Qué pasó? Escribí solo el hecho observable", "help": "Sin interpretaciones. Diego anotó: «la pareja llega 20 minutos tarde». Ojo: «me trataron injustamente» ya es interpretación (B), y «me sentí humillado» es consecuencia (C)." }, { "id": "c_emocion", "type": "checklist", "prompt": "C — ¿Qué sentiste?", "help": "Marcá hasta tres. Diego sintió ira intensa.", "max": 3, "options": [ "Ira", "Fastidio", "Ansiedad", "Miedo", "Angustia", "Tristeza", "Frustración", "Humillación", "Vergüenza", "Culpa", "Otra" ] }, { "id": "c_emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "c_intensidad", "type": "scale", "prompt": "¿Con qué intensidad lo sentiste?", "help": "Si marcaste más de una emoción, puntuá la más fuerte.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Máxima", "maps_to": "emotion_before" }, { "id": "c_conducta", "type": "text", "prompt": "C — ¿Qué hiciste?", "help": "Lo que hiciste (o dejaste de hacer) en ese momento. Diego: reproche y portazo." }, { "id": "b_creencia", "type": "text", "prompt": "B — ¿Qué exigencia («debo», «debería», «tengo que») estaba detrás?", "help": "Escribí la creencia tal como apareció, con tus palabras. Diego: «no tiene ningún derecho a hacerme esperar, debería respetarme siempre, esto es intolerable»." }, { "id": "b_senales", "type": "checklist", "prompt": "¿Qué señales de creencia irracional encontrás en tu B?", "help": "Es como subrayar las palabras de exigencia. Marcá todas las que aparezcan en lo que escribiste. Si no encontrás ninguna, volvé atrás y preguntate qué «debo», «debería» o «tengo que» estaba detrás.", "options": [ "Exigencia absoluta: «debo», «tengo que», «debería», «no puede ser que»", "Tremendismo: «es horrible», «es lo peor que podría pasar»", "Baja tolerancia a la frustración: «no lo soporto», «no puedo con esto»", "Condena global: «soy un inútil», «es un desastre de persona»", "Todavía no encuentro ninguna" ] }, { "id": "d_empirico", "type": "text", "prompt": "D — ¿Es verdad? ¿Dónde está la prueba de que esto DEBE ser así?", "help": "Es el debate empírico. Recordá: no se debate la emoción, sino la exigencia que la infla. En el caso de Diego: «¿dónde está escrito que SIEMPRE debe ser puntual?»." }, { "id": "d_logico", "type": "text", "prompt": "¿Tiene lógica? ¿Se sigue lógicamente que, porque lo prefiero, tenga que ocurrir?", "help": "Es el debate lógico. Para Diego, otra pregunta útil fue: «¿Es intolerable o muy molesto?»." }, { "id": "d_pragmatico", "type": "text", "prompt": "¿Me sirve? ¿Adónde me lleva sostener esta exigencia? ¿Me ayuda o me hunde?", "help": "Es el debate pragmático. En el caso de Diego: «¿Le sirve reaccionar así?»." }, { "id": "e_preferencia", "type": "text", "prompt": "E — ¿Cómo queda tu creencia como preferencia flexible?", "help": "Cambiá el «debo» por «prefiero» o «me gustaría», y el «no lo soporto» por «puedo tolerarlo». Ojo: «debo dejar de exigirme» sigue siendo un «debo». Diego: «prefiero que sea puntual y me molesta que no lo sea, pero no es una catástrofe ni una falta de respeto absoluta; puedo decirlo con calma»." }, { "id": "e_emocion", "type": "text", "prompt": "¿Qué sentís ahora, con esta nueva filosofía?", "help": "E también es una emoción más adaptativa. En Diego, la emoción pasó de ira a fastidio manejable.", "optional": true }, { "id": "e_intensidad", "type": "scale", "prompt": "¿Con qué intensidad sentís ahora lo que anotaste en C?", "help": "Puntuá la misma emoción que antes.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Máxima", "maps_to": "emotion_after" }, { "id": "preferencia_semana", "type": "text", "prompt": "¿Qué preferencia flexible te gustaría adoptar esta semana?", "help": "Elegí una para repetirla en voz alta cuando aparezca la situación. Puede ser la que acabás de escribir u otra." }, { "id": "resumen", "type": "reflect", "title": "Tu registro ABCDE", "template": "A: «{{a_hecho}}». B: «{{b_creencia}}». C: {{c_emocion}}; «{{c_conducta}}». E: «{{e_preferencia}}». Mi preferencia para esta semana: «{{preferencia_semana}}».", "content": "El malestar nace en B, no en A: la creencia media entre el hecho y la emoción.\n\nCuando toques «Terminar», en la última pantalla, tu registro (con el debate) queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." }, { "id": "reflexion", "type": "info", "title": "Preguntas de reflexión", "content": "- ¿Qué exigencias absolutas repetís más seguido?\n- ¿Con qué te decís «no lo soporto» cuando en realidad lo estás soportando?\n- ¿Qué cambiaría si tus «debo» se volvieran «prefiero»?\n- ¿En qué áreas te condenás globalmente por un error puntual?\n\nY una más, en la pantalla siguiente." }, { "id": "estilo", "type": "choice", "prompt": "¿Preferís el estilo más directo de Ellis o el más exploratorio de Beck?", "optional": true, "options": [ "El más directo de Ellis", "El más exploratorio de Beck", "Los dos me sirven", "Todavía no lo sé" ] }, { "id": "reflexion_respuesta", "type": "text", "prompt": "Si querés, escribí tus respuestas", "help": "Por ejemplo, por qué preferís uno u otro estilo, o qué te respondés a alguna de las preguntas de reflexión. También podés llevarlo a la próxima sesión.", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- ABC: Acontecimiento → Creencia → Consecuencia. Se amplía con D (debate) y E (nueva filosofía).\n- El malestar nace en B, no en A: la creencia media entre el hecho y la emoción.\n- Las creencias irracionales son exigencias rígidas: «debo», «tengo que», «no lo soporto».\n- Se debaten con tres preguntas: ¿es verdad?, ¿tiene lógica?, ¿me sirve?\n- Beck y Ellis coinciden en lo esencial; se diferencian en el énfasis y el estilo." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "- Completá **tres registros ABCDE** durante la semana: repetí este ejercicio cada vez (unos 10 minutos; las pantallas de lectura las podés pasar rápido). Para anotar en el momento, también tenés el «Registro ABC».\n- En cada B, marcá las palabras de exigencia («debo», «tengo que», «debería»), como hiciste hoy.\n- Reescribí cada exigencia como una preferencia flexible.\n- Repetí en voz alta la preferencia que elegiste cuando aparezca la situación.\n\nEl próximo capítulo es **«Tríada cognitiva y activación conductual»**." } ]$steps$::jsonb),
  ('tcc-activacion-conductual', 'Tríada cognitiva y activación conductual', 'Entendé la tríada y la espiral de la depresión, y armá tu lista de actividades de placer y de dominio.', 'custom', 'tcc', 'adultos', 'tcc', 15, 207,
   $steps$[ { "id": "intro", "type": "info", "title": "Salir del pozo", "content": "La depresión tiene una forma reconocible de pensar y un círculo que se retroalimenta. Este capítulo explica ambos y presenta la herramienta conductual más eficaz para salir del pozo: la **activación conductual**.\n\nEn caso de crisis, pedí ayuda ya a una línea de ayuda, a emergencias o en la guardia del hospital más cercano. En la app, la sección **Calmarme** tiene el recuadro «Si necesitás ayuda urgente» con los teléfonos." }, { "id": "triada", "type": "info", "title": "La tríada cognitiva de Beck", "content": "Beck observó que, en la depresión, el pensamiento negativo se organiza en tres frentes. Es la llamada **tríada cognitiva**:\n\n- **Visión negativa de UNO MISMO.** Contenido típico: «soy defectuoso, inútil, no valgo». Ejemplos: «no sirvo para nada», «soy una carga».\n- **Visión negativa del MUNDO.** Contenido típico: «todo es hostil, exigente, sin sentido». Ejemplos: «nada tiene gracia», «nadie me valora».\n- **Visión negativa del FUTURO.** Contenido típico: «nada va a mejorar». Ejemplos: «esto no tiene salida», «siempre será igual»." }, { "id": "espiral", "type": "info", "title": "El círculo de la depresión", "content": "La depresión funciona como una espiral descendente. Entenderla ayuda a saber dónde intervenir.\n\n**La espiral:** ánimo bajo → menos energía y ganas → me aíslo y dejo de hacer cosas → menos experiencias gratificantes y de logro → más pensamientos negativos («no sirvo, nada me gusta») → ánimo aún más bajo.\n\nLa trampa es esperar a «tener ganas» para hacer. En la depresión, **las ganas no vienen antes de la acción: vienen después**. Por eso se interviene sobre la conducta, no solo sobre el ánimo." }, { "id": "profundizar", "type": "info", "title": "Para profundizar (opcional)", "content": "Es la explicación clínica de por qué funciona la activación. Si preferís, pasá a la pantalla siguiente.\n\nLa activación conductual parte de un principio contraintuitivo: en lugar de esperar a sentirse mejor para actuar, la persona **actúa para empezar a sentirse mejor**. Reintroduce de forma planificada y gradual actividades que aportan placer y sensación de dominio, rompiendo el ciclo de evitación y retraimiento que mantiene el estado depresivo.\n\nLa evidencia acumulada la respalda como intervención eficaz para la depresión, comparable en varios estudios a paquetes de TCC más amplios, con la ventaja de ser relativamente simple de aplicar." }, { "id": "tipos", "type": "info", "title": "Los dos tipos de actividad", "content": "- **Placer (P):** aporta disfrute, conexión, bienestar. Por ejemplo: escuchar música, ver a un amigo, caminar, un baño, cocinar algo rico.\n- **Dominio (D):** aporta logro, competencia, sensación de utilidad. Por ejemplo: ordenar un cajón, pagar una cuenta, estudiar 20 min, hacer un trámite.\n\n**Idea clave:** una buena semana equilibra placer y dominio. Solo placer puede sentirse vacío; solo dominio, agotador. Cada actividad se puntúa después de hacerla en placer (0–10) y dominio (0–10)." }, { "id": "programacion", "type": "info", "title": "Programación gradual", "content": "No se trata de llenar la agenda de golpe. Se empieza pequeño y se sube de a poco:\n\n1. Hacé una lista de actividades que antes te gustaban o te daban sensación de logro.\n2. Ordenalas de la más fácil a la más difícil según cuánta energía requieren hoy.\n3. Empezá por las más fáciles: mejor una caminata de 10 minutos que un plan imposible.\n4. Programá día y hora concretos (no «cuando pueda», sino «martes 18:00»).\n5. Hacela aunque no tengas ganas: la motivación llega después de empezar.\n6. Registrá placer y dominio al terminar, y subí gradualmente la dificultad." }, { "id": "reglas_oro", "type": "info", "title": "Reglas de oro de la activación", "content": "- **De afuera hacia adentro:** primero la acción, después el ánimo.\n- **Concreto y pequeño:** mejor un paso mínimo cumplido que un plan enorme abandonado.\n- **Programado, no espontáneo:** agendá la actividad como si fuera una cita.\n- **Registrar es parte del tratamiento:** lo que se mide, se puede ajustar." }, { "id": "areas", "type": "info", "title": "Ejemplos por área", "content": "Actividades de activación en distintas áreas, y su tipo:\n\n- **Depresión:** salir a caminar 10 minutos a la mañana → placer + dominio.\n- **Duelo:** retomar un café semanal con una amiga → placer.\n- **Autoestima:** terminar una tarea pequeña postergada → dominio.\n- **Ansiedad:** hacer una actividad relajante agendada (música, baño) → placer.\n- **Trabajo:** dividir un pendiente grande en un paso de 15 minutos → dominio.\n\nAhora probá vos con otros tres." }, { "id": "quiz_universidad", "type": "choice", "prompt": "«Estudiar en bloques cortos con una recompensa después»: ¿qué tipo es?", "help": "Ejemplo del área universidad (1 de 3). La respuesta es la del cuadernillo; en la práctica, cada actividad se puntúa en placer y en dominio después de hacerla.", "options": [ "Placer", "Dominio", "Placer y dominio" ], "feedback": { "Placer y dominio": "**Exacto.** Estudiar aporta dominio (logro, sensación de utilidad) y la recompensa de después aporta placer: es **dominio + placer**.", "Placer": "**Le falta una parte.** La recompensa aporta placer, pero estudiar aporta logro: es **dominio + placer**.", "Dominio": "**Le falta una parte.** Estudiar aporta logro, pero la recompensa de después suma placer: es **dominio + placer**." } }, { "id": "quiz_pareja", "type": "choice", "prompt": "«Planificar una actividad compartida simple»: ¿qué tipo es?", "help": "Ejemplo del área pareja (2 de 3).", "options": [ "Placer", "Dominio", "Placer y dominio" ], "feedback": { "Placer": "**Exacto.** Aporta disfrute y conexión: es una actividad de **placer**.", "Dominio": "**En el cuadernillo figura como placer:** lo central es el disfrute y la conexión con la otra persona, más que el logro.", "Placer y dominio": "**En el cuadernillo figura como placer:** lo central es el disfrute y la conexión. Si a vos además te deja sensación de logro, se va a ver cuando la puntúes en las dos escalas." } }, { "id": "quiz_perfeccionismo", "type": "choice", "prompt": "«Hacer algo “suficientemente bien” a propósito»: ¿qué tipo es?", "help": "Ejemplo del área perfeccionismo (3 de 3).", "options": [ "Placer", "Dominio", "Placer y dominio" ], "feedback": { "Dominio": "**Exacto.** Es una actividad de **dominio**: aporta logro y sensación de competencia.", "Placer": "**En el cuadernillo figura como dominio:** aporta logro y competencia, más que disfrute.", "Placer y dominio": "**En el cuadernillo figura como dominio:** lo central es el logro y la competencia. Si además lo disfrutás, se va a ver cuando lo puntúes en las dos escalas." } }, { "id": "sofia", "type": "info", "title": "Caso clínico: Sofía, 42 años", "content": "**Episodio depresivo.** Sofía casi no sale de casa. Dice: «no tengo ganas de nada» y espera recuperarlas para volver a moverse. Se le explica el círculo y se acuerda un primer paso mínimo: regar las plantas y caminar hasta la esquina, martes y jueves a las 10:00.\n\n**Resultado:** las primeras veces lo hace «sin ganas y sin gusto» (placer 2, dominio 5). A la segunda semana el dominio sube y aparece algo de placer. Al registrar, Sofía comprueba que los días con al menos una actividad su ánimo es un poco mejor. La evidencia la anima a subir la dosis." }, { "id": "vertice", "type": "choice", "prompt": "¿Cuál de los tres vértices de la tríada pesa más en vos?", "help": "Uno mismo, el mundo o el futuro. Pensá en lo que te decís cuando el ánimo está bajo.", "options": [ "Uno mismo", "El mundo", "El futuro", "No lo tengo claro" ], "feedback": { "Uno mismo": "Es la **visión negativa de uno mismo**: «soy defectuoso, inútil, no valgo». Suena como «no sirvo para nada» o «soy una carga».\n\nEn este capítulo se interviene sobre la conducta: en las próximas pantallas armás tu lista de activación.", "El mundo": "Es la **visión negativa del mundo**: «todo es hostil, exigente, sin sentido». Suena como «nada tiene gracia» o «nadie me valora».\n\nEn este capítulo se interviene sobre la conducta: en las próximas pantallas armás tu lista de activación.", "El futuro": "Es la **visión negativa del futuro**: «nada va a mejorar». Suena como «esto no tiene salida» o «siempre será igual».\n\nEn este capítulo se interviene sobre la conducta: en las próximas pantallas armás tu lista de activación.", "No lo tengo claro": "Está bien. Esta semana, cuando baje el ánimo, fijate si tus pensamientos hablan de vos, del mundo o del futuro, y si querés, revisalo en sesión con tu psicólogo.\n\nMientras tanto, en las próximas pantallas armás tu lista de activación." } }, { "id": "guiado_intro", "type": "info", "title": "Ejercicio guiado: tu lista de activación", "content": "Ahora armás tu propia lista, siguiendo la programación gradual:\n\n- Actividades de **placer** que quieras recuperar.\n- Actividades de **dominio** (logro) pendientes.\n- Tu **primer paso mínimo**, con día y hora concretos.\n\nNo se trata de llenar la agenda de golpe: si hoy te cuesta, con una actividad en cada lista alcanza." }, { "id": "placer", "type": "list", "prompt": "Actividades de placer que quiero recuperar", "help": "Cosas que antes te gustaban y te daban disfrute, conexión o bienestar. Por ejemplo: escuchar música, ver a un amigo, caminar, un baño, cocinar algo rico.\n\nUna por renglón. Si podés, de la más fácil a la más difícil según cuánta energía requieren hoy.", "count": 5, "min": 1 }, { "id": "dominio", "type": "list", "prompt": "Actividades de dominio (logro) pendientes", "help": "Tareas que te darían sensación de logro, competencia o utilidad. Por ejemplo: ordenar un cajón, pagar una cuenta, estudiar 20 min, hacer un trámite.\n\nUna por renglón. Si podés, de la más fácil a la más difícil según cuánta energía requieren hoy.", "count": 5, "min": 1 }, { "id": "primer_paso", "type": "text", "prompt": "Mi primer paso mínimo: ¿qué vas a hacer?", "help": "Elegí algo de lo más fácil de tus listas: mejor una caminata de 10 minutos que un plan imposible. Sofía acordó regar las plantas y caminar hasta la esquina." }, { "id": "primer_paso_cuando", "type": "text", "prompt": "¿Qué día y a qué hora lo vas a hacer?", "help": "Concretos: no «cuando pueda», sino «martes 18:00». Agendalo como si fuera una cita. Sofía: martes y jueves a las 10:00.", "placeholder": "Por ejemplo: martes 18:00" }, { "id": "resumen", "type": "reflect", "title": "Tu lista de activación", "template": "Placer que quiero recuperar: {{placer}}. Dominio (logro) pendiente: {{dominio}}. Mi primer paso mínimo: «{{primer_paso}}». Cuándo: {{primer_paso_cuando}}.", "content": "Hacelo aunque no tengas ganas: la motivación llega después de empezar. Al terminar, puntuá placer y dominio en «Registro de actividades».\n\nCuando toques «Terminar», en la última pantalla, tu lista queda guardada: la podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también la puede ver." }, { "id": "refl_dejaste", "type": "text", "prompt": "¿Qué actividades dejaste de hacer desde que estás con el ánimo bajo?", "help": "Preguntas de reflexión: respondé las que quieras, podés saltear cualquiera.", "optional": true }, { "id": "refl_ganas", "type": "choice", "prompt": "¿Notás que esperás «tener ganas» antes de actuar?", "options": [ "Sí, seguido", "A veces", "Casi nunca" ], "feedback": { "Sí, seguido": "Es la trampa de la espiral: en la depresión, las ganas no vienen antes de la acción, vienen después. Por eso el primer paso se agenda y se hace aunque no haya ganas.", "A veces": "Es la trampa de la espiral: en la depresión, las ganas no vienen antes de la acción, vienen después. Por eso el primer paso se agenda y se hace aunque no haya ganas.", "Casi nunca": "Bien: es una de las claves del capítulo. Igual, agendá tus actividades con día y hora, no «cuando pueda»." }, "optional": true }, { "id": "refl_dia", "type": "text", "prompt": "¿Qué diferencia hay en tu ánimo entre un día activo y uno pasivo?", "help": "Si todavía no lo sabés, el «Registro de actividades» te puede ayudar a verlo, como le pasó a Sofía.", "optional": true }, { "id": "refl_manana", "type": "text", "prompt": "¿Qué actividad pequeña podrías agendar mañana mismo?", "help": "Puede ser tu primer paso mínimo u otra de tus listas.", "optional": true }, { "id": "refl_postergado", "type": "text", "prompt": "¿Qué te sacás de encima cuando cumplís algo que venías postergando?", "optional": true }, { "id": "para_llevar", "type": "info", "title": "Para llevar", "content": "- La tríada cognitiva: visión negativa de uno mismo, del mundo y del futuro.\n- La depresión es una espiral: menos actividad → menos gratificación → más pensamientos negativos.\n- En la depresión, las ganas vienen **después** de la acción, no antes.\n- La activación conductual reintroduce actividades de placer y de dominio de forma gradual.\n- Programar, hacer aunque no haya ganas y registrar son las claves." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "Tareas para casa, a lo largo de la semana:\n\n- Completá el **«Planificador semanal de activación»** con al menos una actividad por día (unos 8 minutos).\n- Asegurá el equilibrio: que haya tanto placer como dominio en la semana.\n- Empezá por lo más fácil y agendá día y hora, no «cuando pueda».\n- Puntuá P y D después de cada actividad y observá la relación con tu ánimo: usá el **«Registro de actividades»** cada vez que termines una (unos 3 minutos).\n- Al final de la semana, subí un escalón la dificultad de una actividad." } ]$steps$::jsonb),
  ('tcc-registro-rpd', 'Registro de pensamientos (RPD)', 'Anotá la situación, la emoción y el pensamiento automático y, al reestructurar, el pensamiento alternativo.', 'thought_record', 'tcc', 'adultos', 'tcc', 6, 211,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro de pensamientos (RPD)", "content": "El **Registro de Pensamientos Disfuncionales (RPD)** es la hoja del Anexo 1 del cuadernillo. Viene de los capítulos «Los pensamientos automáticos» y «Cuestionamiento socrático y reestructuración».\n\nRegistrá tus pensamientos **lo antes posible después de la situación**.\n\nLas últimas preguntas (pensamiento alternativo, nueva credibilidad y nueva emoción) se completan al reestructurar. Si todavía no llegaste a ese capítulo, tocá «Saltar» en esas preguntas.\n\nUsalo tantas veces como necesites: la práctica repetida es lo que instala el cambio." }, { "id": "situacion", "type": "text", "prompt": "Fecha y situación: ¿qué pasó?", "help": "Dónde, cuándo, con quién. La fecha se guarda sola con el registro.", "placeholder": "Qué pasó, dónde, con quién…" }, { "id": "emocion", "type": "checklist", "prompt": "Emoción: ¿qué sentiste?", "help": "Cada emoción se nombra con una sola palabra. Marcá hasta tres.", "options": [ "Angustia", "Ansiedad", "Miedo", "Nerviosismo", "Pánico", "Bronca", "Tristeza", "Vergüenza", "Culpa", "Frustración", "Inseguridad", "Otra" ], "max": 3 }, { "id": "emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "intensidad", "type": "scale", "prompt": "¿Con qué intensidad la sentiste? (de 0 a 100)", "help": "Si marcaste más de una, puntuá la más fuerte.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima" }, { "id": "pensamiento", "type": "text", "prompt": "Pensamiento automático: ¿qué te pasó por la cabeza?", "help": "Usá la pregunta de oro: «¿qué me pasó por la cabeza justo antes de sentirme así?». Escribilo tal como apareció, con sus palabras crudas, sin traducirlo ni suavizarlo.\n\nSi hubo varios, quedate con el **pensamiento caliente**: el que trae más carga emocional.\n\nAsí lo hizo Ana (26 años), que evita reuniones por miedo a «quedar en ridículo»: «todos van a ver que estoy nerviosa y me van a juzgar»." }, { "id": "credibilidad", "type": "scale", "prompt": "¿Cuánto creés ese pensamiento? (de 0 a 100)", "help": "Es su credibilidad: no importa solo qué pensás, sino cuánto lo creés. Ana: 90.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "alternativo", "type": "text", "prompt": "Pensamiento alternativo: ¿qué forma más ajustada hay de verlo?", "help": "Se completa al reestructurar. Que integre toda la evidencia, no que niegue lo negativo: creíble para vos, equilibrado y que puedas usar la próxima vez. No un eslogan optimista. Te pueden ayudar «50 preguntas socráticas» y el «Registro de evidencias».\n\nAna: «puedo estar algo nerviosa y aun así participar; la mayoría está pendiente de lo suyo, no de mí».\n\nSi todavía no lo trabajaste, tocá «Saltar».", "optional": true }, { "id": "credibilidad_nueva", "type": "scale", "prompt": "¿Cuánto creés ahora el pensamiento automático? (de 0 a 100)", "help": "Es la nueva credibilidad del pensamiento del principio, después de reestructurar. En el caso de Ana, bajó de 90 a 40. Si no escribiste un pensamiento alternativo, tocá «Saltar».", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente", "optional": true }, { "id": "emocion_nueva", "type": "scale", "prompt": "¿Con qué intensidad sentís ahora la emoción? (de 0 a 100)", "help": "Puntuá la misma emoción de antes. En Ana, la ansiedad bajó de 80 a 50. Si no escribiste un pensamiento alternativo, tocá «Saltar».", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Máxima", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Tu registro", "template": "Situación: «{{situacion}}». Emoción: {{emocion}}. Pensamiento automático: «{{pensamiento}}». Pensamiento alternativo (si ya lo trabajaste): «{{alternativo}}».", "content": "Si reestructuraste, compará tus puntuaciones de antes y de ahora (con «Atrás» las volvés a ver): ¿bajaron la credibilidad del pensamiento y la intensidad de la emoción?\n\nCuando toques «Terminar», tu registro queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-registro-abc', 'Registro ABC', 'Anotá el acontecimiento, la creencia y la consecuencia y, si querés, sumá el debate y la nueva filosofía.', 'thought_record', 'tcc', 'adultos', 'tcc', 6, 212,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro ABC", "content": "Es la hoja del Anexo 2 del cuadernillo y viene del capítulo «El modelo ABC de Ellis».\n\n- **A — Acontecimiento:** el hecho, solo lo observable.\n- **B — Creencia:** lo que pensaste y creíste sobre A.\n- **C — Consecuencia:** lo que sentiste y lo que hiciste.\n\nAl final podés sumar, si querés, **D** (debate) y **E** (nueva filosofía), como en el capítulo.\n\nUsalo tantas veces como necesites: la práctica repetida es lo que instala el cambio." }, { "id": "a_acontecimiento", "type": "text", "prompt": "A — Acontecimiento: ¿qué pasó?", "help": "Solo el hecho observable, sin interpretaciones. Así lo hizo Diego (31 años), el caso de «El modelo ABC de Ellis»: «la pareja llega 20 minutos tarde».\n\nOjo: «me trataron injustamente» ya es interpretación (B), y «me sentí humillado» es consecuencia (C).", "placeholder": "Lo que vería cualquiera que estuviera ahí…" }, { "id": "b_creencia", "type": "text", "prompt": "B — Creencia: ¿qué pensaste o creíste sobre lo que pasó?", "help": "Escribila con tus palabras, tal como apareció. Buscá la exigencia que estaba detrás: «debo», «tengo que», «debería», «no puede ser que», «no lo soporto».\n\nDiego: «no tiene ningún derecho a hacerme esperar, debería respetarme siempre, esto es intolerable»." }, { "id": "c_emocion", "type": "checklist", "prompt": "C — Consecuencia: ¿qué sentiste?", "help": "Marcá hasta tres. Diego sintió ira intensa.", "options": [ "Ira", "Fastidio", "Ansiedad", "Miedo", "Angustia", "Tristeza", "Frustración", "Humillación", "Vergüenza", "Culpa", "Otra" ], "max": 3 }, { "id": "c_emocion_otra", "type": "text", "prompt": "Si marcaste «Otra», ¿cuál fue?", "help": "Una sola palabra. Si no marcaste «Otra», tocá «Saltar».", "optional": true }, { "id": "c_conducta", "type": "text", "prompt": "C — Consecuencia: ¿qué hiciste?", "help": "Lo que hiciste (o dejaste de hacer) en ese momento. Diego: reproche y portazo." }, { "id": "d_debate", "type": "text", "prompt": "D — Debate: ¿es verdad?, ¿tiene lógica?, ¿me sirve?", "help": "Debatí la creencia de B con las tres preguntas de Ellis:\n\n- **¿Es verdad?** ¿Dónde está la prueba de que esto DEBE ser así?\n- **¿Tiene lógica?** ¿Se sigue lógicamente que, porque lo prefiero, tenga que ocurrir?\n- **¿Me sirve?** ¿Adónde me lleva sostener esta exigencia? ¿Me ayuda o me hunde?\n\nNo se debate la emoción, sino la exigencia que la infla. En el caso de Diego: ¿dónde está escrito que SIEMPRE debe ser puntual? ¿Es intolerable o muy molesto? ¿Le sirve reaccionar así?\n\nSi no querés hacerlo ahora, tocá «Saltar».", "optional": true }, { "id": "e_nueva_filosofia", "type": "text", "prompt": "E — Nueva filosofía: ¿cómo queda tu creencia como preferencia flexible?", "help": "Cambiá el «debo» por «prefiero» o «me gustaría», y el «no lo soporto» por «puedo tolerarlo». Ojo: «debo dejar de exigirme» sigue siendo un «debo».\n\nDiego: «prefiero que sea puntual y me molesta que no lo sea, pero no es una catástrofe ni una falta de respeto absoluta; puedo decirlo con calma». Su emoción pasó de ira a fastidio manejable.\n\nSi no hiciste el debate, tocá «Saltar».", "optional": true }, { "id": "resumen", "type": "reflect", "title": "Tu registro ABC", "template": "A: «{{a_acontecimiento}}». B: «{{b_creencia}}». C: {{c_emocion}}; «{{c_conducta}}». E, si la trabajaste: «{{e_nueva_filosofia}}».", "content": "El malestar nace en B, no en A: la creencia media entre el hecho y la emoción. Para trabajar el debate paso a paso, volvé a «El modelo ABC de Ellis».\n\nCuando toques «Terminar», tu registro queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-registro-actividades', 'Registro de actividades', 'Anotá una actividad y puntuá placer, dominio y ánimo: con varios registros vas a ver cómo se relacionan.', 'custom', 'tcc', 'adultos', 'tcc', 3, 213,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro de actividades", "content": "Es la hoja del Anexo 3 del cuadernillo y viene del capítulo «Tríada cognitiva y activación conductual». Sirve para ver la **relación entre actividad y ánimo**.\n\nEn el cuadernillo se anota hora por hora lo que hacés; acá registrás **una actividad por vez**: repetilo cada vez que termines una. Vas a puntuar de 0 a 10:\n\n- **Placer (P):** disfrute, conexión, bienestar.\n- **Dominio (D):** logro, competencia, sensación de utilidad.\n- **Ánimo:** cómo estabas en ese momento.\n\nUsalo tantas veces como necesites: la práctica repetida es lo que instala el cambio." }, { "id": "franja", "type": "text", "prompt": "Franja horaria: ¿cuándo fue?", "help": "La hora (por ejemplo, de 10 a 11) o el momento del día (mañana, tarde, noche). La fecha se guarda sola con el registro.", "placeholder": "Por ejemplo: de 10 a 11" }, { "id": "actividad", "type": "text", "prompt": "Actividad realizada: ¿qué hiciste?", "help": "Breve y concreta. Por ejemplo: salir a caminar 10 minutos, ordenar un cajón, ver a un amigo.", "placeholder": "Lo que hice…" }, { "id": "placer", "type": "scale", "prompt": "Placer: ¿cuánto disfrute te dio? (de 0 a 10)", "help": "Disfrute, conexión, bienestar. Puede ser bajo: las primeras veces, Sofía puntuó placer 2.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Mucho" }, { "id": "dominio", "type": "scale", "prompt": "Dominio: ¿cuánto logro sentiste? (de 0 a 10)", "help": "Logro, competencia, sensación de utilidad. Sofía, las primeras veces: dominio 5.", "min": 0, "max": 10, "min_label": "Nada", "max_label": "Mucho" }, { "id": "animo", "type": "scale", "prompt": "Ánimo: ¿cómo estuvo tu ánimo? (de 0 a 10)", "help": "En ese momento del día.", "min": 0, "max": 10, "min_label": "Muy bajo", "max_label": "Muy bueno" }, { "id": "resumen", "type": "reflect", "title": "Tu registro", "template": "{{franja}}: {{actividad}}.", "content": "Con varios registros vas a poder ver la relación entre actividad y ánimo, como Sofía, que comprobó que los días con al menos una actividad su ánimo era un poco mejor.\n\nCuando toques «Terminar», tu registro queda guardado con el placer, el dominio y el ánimo: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-registro-evidencias', 'Registro de evidencias', 'Poné a prueba un pensamiento: juntá evidencia a favor y en contra antes de sacar una conclusión.', 'thought_record', 'tcc', 'adultos', 'tcc', 6, 214,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro de evidencias", "content": "Es la hoja del Anexo 4 del cuadernillo y viene del capítulo «Cuestionamiento socrático y reestructuración».\n\nSirve para poner a prueba un pensamiento: escribilo primero y juntá pruebas **a favor** y **en contra** antes de sacar conclusiones.\n\nUsalo tantas veces como necesites: la práctica repetida es lo que instala el cambio." }, { "id": "pensamiento", "type": "text", "prompt": "¿Qué pensamiento querés examinar?", "help": "Escribilo tal como aparece. Así lo hizo Ana (26 años), el caso de «Cuestionamiento socrático y reestructuración», que evita reuniones por miedo a «quedar en ridículo»: «todos van a ver que estoy nerviosa y me van a juzgar»." }, { "id": "credibilidad_inicial", "type": "scale", "prompt": "¿Cuánto lo creés ahora? (de 0 a 100)", "help": "Es la credibilidad inicial. Ana: 90.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "evidencia_favor", "type": "list", "prompt": "Evidencia a favor: ¿qué hechos apoyan el pensamiento?", "help": "Hechos, no interpretaciones. Una prueba por renglón. Ana: «a veces me tiembla la voz».", "count": 5, "min": 1 }, { "id": "evidencia_contra", "type": "list", "prompt": "Evidencia en contra: ¿qué hechos no encajan con el pensamiento?", "help": "Lo que solés pasar por alto: forzate a buscar tanta como a favor. Te pueden ayudar estas preguntas: ¿qué datos estoy dejando afuera? ¿Estoy tomando una suposición como si fuera un hecho? ¿Confundo una opinión con un hecho?\n\nAna: «nunca nadie me lo comentó», «me han invitado de nuevo», «yo no juzgo a otros por estar nerviosos».", "count": 5, "min": 1 }, { "id": "conclusion", "type": "text", "prompt": "Conclusión equilibrada: ¿qué pensamiento alternativo surge de la evidencia?", "help": "Que integre toda la evidencia, no que niegue lo negativo: creíble para vos y equilibrado, no un eslogan optimista.\n\nAna: «puedo estar algo nerviosa y aun así participar; la mayoría está pendiente de lo suyo, no de mí»." }, { "id": "credibilidad_nueva", "type": "scale", "prompt": "¿Cuánto creés ahora el pensamiento del principio? (de 0 a 100)", "help": "Es la nueva credibilidad. En el caso de Ana, bajó de 90 a 40.", "min": 0, "max": 100, "min_label": "Nada", "max_label": "Totalmente" }, { "id": "resumen", "type": "reflect", "title": "Tu registro de evidencias", "template": "Pensamiento examinado: «{{pensamiento}}». A favor: {{evidencia_favor}}. En contra: {{evidencia_contra}}. Conclusión equilibrada: «{{conclusion}}».", "content": "Compará la credibilidad del principio con la de ahora (con «Atrás» la volvés a ver): ¿bajó?\n\nA veces el mejor cuestionamiento es un experimento: probar en la realidad, no solo debatir en la cabeza. Ana cerró con uno: ir a una reunión y registrar cuántos comentarios recibe realmente.\n\nCuando toques «Terminar», tu registro queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-registro-creencias', 'Registro de creencias nucleares', 'Anotá tu creencia antigua, una alternativa más ajustada y, cada día, la evidencia que apoya la nueva.', 'thought_record', 'tcc', 'adultos', 'tcc', 5, 215,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro de creencias nucleares", "content": "Es la hoja del Anexo 5 del cuadernillo y viene del capítulo «Creencias intermedias y nucleares».\n\nLa creencia nueva se sostiene con evidencia. Por eso, **cada día** anotá una prueba, por pequeña que sea, que la apoye.\n\nLa creencia antigua y la alternativa suelen ser las mismas de un día a otro: escribilas igual cada vez (las tenés en «Mis respuestas»). Lo que cambia es la evidencia del día.\n\nSi todavía no identificaste tu creencia nuclear, empezá por «Creencias intermedias y nucleares». Si te moviliza mucho, podés frenar, ir a **Calmarme** y retomarlo en sesión." }, { "id": "creencia_antigua", "type": "text", "prompt": "Creencia nuclear negativa (antigua): ¿cuál es?", "help": "Una frase corta sobre vos: «soy…», «no…». Por ejemplo: «no sirvo»." }, { "id": "dominio", "type": "choice", "prompt": "¿En qué dominio la ubicás?", "help": "Las creencias nucleares negativas sobre uno mismo suelen agruparse en tres dominios:\n\n- **Desamparo:** «soy impotente / incapaz». Por ejemplo: «no puedo con nada», «soy débil», «no tengo control», «estoy atrapado».\n- **Desamor:** «no soy querible». Por ejemplo: «no merezco cariño», «voy a terminar solo», «hay algo malo en mí».\n- **Desvalorización:** «no valgo / soy defectuoso». Por ejemplo: «soy un fracaso», «no sirvo», «soy mala persona».", "options": [ "Desamparo: «soy impotente / incapaz»", "Desamor: «no soy querible»", "Desvalorización: «no valgo / soy defectuoso»", "No lo tengo claro" ], "feedback": { "No lo tengo claro": "Está bien. Seguí con el registro y revisalo en sesión con tu psicólogo." } }, { "id": "creencia_alternativa", "type": "text", "prompt": "Creencia nuclear alternativa: ¿qué versión más ajustada podés formular?", "help": "Más ajustada y realista. Por ejemplo: «soy suficiente, con virtudes y límites»." }, { "id": "situacion", "type": "text", "prompt": "Hoy: ¿en qué situación encontraste evidencia a favor de la creencia nueva?", "help": "Dónde, cuándo, con quién. La fecha se guarda sola con el registro.", "placeholder": "Qué pasó, dónde, con quién…" }, { "id": "evidencia", "type": "text", "prompt": "¿Qué evidencia de esa situación apoya la creencia nueva?", "help": "Un hecho concreto, por pequeño que sea: lo que pasó, no lo que interpretaste." }, { "id": "resumen", "type": "reflect", "title": "Tu registro de hoy", "template": "Creencia antigua: «{{creencia_antigua}}» ({{dominio}}). Creencia nueva, más ajustada: «{{creencia_alternativa}}». Situación de hoy: «{{situacion}}». Evidencia a favor de la nueva: «{{evidencia}}».", "content": "Volvé a hacer este registro cada día, con una prueba nueva: así se va juntando la evidencia que sostiene la creencia más ajustada.\n\nCuando toques «Terminar», tu registro queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-registro-distorsiones', 'Registro de distorsiones', 'Anotá la situación y el pensamiento, marcá qué distorsiones contiene y escribí la pregunta que lo desafía.', 'thought_record', 'tcc', 'adultos', 'tcc', 5, 216,
   $steps$[ { "id": "intro", "type": "info", "title": "Registro de distorsiones", "content": "Es la hoja del Anexo 6 del cuadernillo y viene del capítulo «Las distorsiones cognitivas».\n\nSon cuatro preguntas: la situación, el pensamiento, la distorsión o distorsiones que contiene y la pregunta que la desafía.\n\nPistas para reconocerlas: palabras absolutas («siempre», «nunca», «todo», «nadie», «todos»), etiquetas globales («soy un…», «es un…»), predecir el futuro con certeza o leer la mente ajena sin datos, usar un sentimiento como prueba de un hecho, y los «debería», «tengo que», «no puedo fallar».\n\nUsalo tantas veces como necesites: la práctica repetida es lo que instala el cambio." }, { "id": "situacion", "type": "text", "prompt": "Situación: ¿qué pasó?", "help": "Breve y concreta: dónde, cuándo, con quién. La fecha se guarda sola con el registro.", "placeholder": "Qué pasó, dónde, con quién…" }, { "id": "pensamiento", "type": "text", "prompt": "Pensamiento: ¿qué te pasó por la cabeza?", "help": "La frase tal como apareció, sin suavizarla. Así lo hizo Rodrigo (29 años), el caso de «Las distorsiones cognitivas»: entregó un informe muy valorado, pero con una cifra mal tipeada, y pensó: «Está todo arruinado»." }, { "id": "repaso", "type": "info", "title": "Las 12 distorsiones, en una línea", "content": "Si ya las conocés, seguí de largo.\n\n- **Todo o nada:** ver en extremos, sin matices.\n- **Sobregeneralización:** de un hecho aislado a una regla universal.\n- **Filtro mental:** fijarse solo en lo negativo.\n- **Descalificar lo positivo:** restar valor a lo bueno.\n- **Lectura de mente:** suponer lo que otros piensan.\n- **Adivinación del futuro:** predecir lo peor como un hecho.\n- **Catastrofización:** imaginar el peor escenario y darlo por cierto.\n- **Razonamiento emocional:** «lo siento, entonces es verdad».\n- **Debería / tener que:** reglas rígidas sobre cómo deben ser las cosas.\n- **Etiquetación:** ponerse (o poner) una etiqueta global.\n- **Personalización:** asumir responsabilidad de lo que no controlás.\n- **Culpabilización:** cargar toda la culpa en uno mismo o en otro." }, { "id": "distorsiones", "type": "checklist", "prompt": "Distorsión(es): ¿cuáles encajan con tu pensamiento?", "help": "Marcá todas las que veas: un pensamiento puede tener dos o tres a la vez. Rodrigo: todo o nada.\n\nPuede que no haya ninguna: estar triste tras una pérdida no es una distorsión; pensar «no merezco estar bien nunca más» sí puede serlo. Si es así, marcá «No encuentro ninguna».", "options": [ "Todo o nada", "Sobregeneralización", "Filtro mental", "Descalificar lo positivo", "Lectura de mente", "Adivinación del futuro", "Catastrofización", "Razonamiento emocional", "Debería / tener que", "Etiquetación", "Personalización", "Culpabilización", "No encuentro ninguna" ] }, { "id": "pregunta", "type": "text", "prompt": "¿Qué pregunta la desafía?", "help": "Buscá la de tu distorsión o escribila con tus palabras:\n\n- **Todo o nada:** ¿hay puntos intermedios? ¿Qué habría entre 0 y 100?\n- **Sobregeneralización:** ¿«siempre»? ¿Podés nombrar excepciones concretas?\n- **Filtro mental:** ¿qué datos positivos estoy dejando afuera?\n- **Descalificar lo positivo:** si un amigo lograra esto, ¿le dirías que fue solo suerte?\n- **Lectura de mente:** ¿qué evidencia tengo? ¿Lo comprobé o lo asumí?\n- **Adivinación del futuro:** ¿cuántas veces esta predicción se cumplió tal cual?\n- **Catastrofización:** ¿qué es lo más probable, no lo peor? ¿Y si pasara, cómo lo afrontaría?\n- **Razonamiento emocional:** ¿un sentimiento es una prueba? ¿Los hechos coinciden?\n- **Debería / tener que:** ¿esa regla es realista? ¿La aplicarías a otro?\n- **Etiquetación:** ¿un error define a toda la persona? Describí la conducta, no la etiqueta.\n- **Personalización:** ¿qué otros factores pudieron influir?\n- **Culpabilización:** ¿qué parte es mía, qué parte del contexto y qué parte de otros?\n\nSi no encontraste ninguna, o querés otras, usá «50 preguntas socráticas»." }, { "id": "resumen", "type": "reflect", "title": "Tu registro", "template": "Situación: «{{situacion}}». Pensamiento: «{{pensamiento}}». Distorsión(es): {{distorsiones}}. Pregunta que la desafía: «{{pregunta}}».", "content": "Nombrar la distorsión es el primer paso; el fin es entender, no juzgarse. Para cuestionar el pensamiento y construir uno alternativo, podés seguir con «Registro de pensamientos (RPD)» o «Registro de evidencias».\n\nCuando toques «Terminar», tu registro queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." } ]$steps$::jsonb),
  ('tcc-planificador-activacion', 'Planificador semanal de activación', 'Agendá actividades de placer y de dominio con día y hora concretos, y hacé el balance al cerrar la semana.', 'custom', 'tcc', 'adultos', 'tcc', 8, 217,
   $steps$[ { "id": "intro", "type": "info", "title": "Planificador semanal de activación", "content": "Es la hoja del Anexo 7 del cuadernillo y viene del capítulo «Tríada cognitiva y activación conductual».\n\nAgendá actividades de **placer (P)** y **dominio (D)** con día y hora concretos: una o dos por día alcanzan. Al terminarlas, puntualas en el «Registro de actividades».\n\n- **Placer:** disfrute, conexión, bienestar.\n- **Dominio:** logro, competencia, sensación de utilidad.\n\nSi hiciste tu lista de activación, la encontrás en «Tríada cognitiva y activación conductual», en «Mis respuestas»." }, { "id": "balance", "type": "text", "prompt": "Si cerrás una semana: ¿hubo placer y dominio? ¿Qué ajustás para la próxima?", "help": "Es el balance de la semana que termina. Mirá tu planificador anterior y tus registros de actividades: los encontrás en «Mis respuestas» de cada ejercicio. Para el ajuste: subí un escalón la dificultad de una actividad.\n\nSi es tu primera semana, tocá «Saltar».", "optional": true }, { "id": "reglas_oro", "type": "info", "title": "Reglas de oro de la activación", "content": "- **De afuera hacia adentro:** primero la acción, después el ánimo.\n- **Concreto y pequeño:** mejor un paso mínimo cumplido que un plan enorme abandonado.\n- **Programado, no espontáneo:** agendá la actividad como si fuera una cita.\n- **Registrar es parte del tratamiento:** lo que se mide, se puede ajustar." }, { "id": "actividades", "type": "list", "prompt": "Agendá tus actividades de la semana: día, hora y P o D", "help": "Una por renglón, como si fuera una cita: no «cuando pueda», sino día y hora. Por ejemplo: «martes 18:00 — caminar 10 minutos (P)» o «jueves 10:00 — pagar una cuenta (D)».\n\nIdealmente, al menos una por día; si un día tiene dos, ponelas en el mismo renglón. Empezá por lo más fácil.", "count": 7, "min": 1 }, { "id": "equilibrio", "type": "choice", "prompt": "¿Hay equilibrio entre placer y dominio en tu semana?", "options": [ "Sí, hay de los dos", "Hay más placer que dominio", "Hay más dominio que placer" ], "feedback": { "Sí, hay de los dos": "**Bien.** Una buena semana equilibra placer y dominio.", "Hay más placer que dominio": "Solo placer puede sentirse vacío. Si querés, volvé atrás y sumá algo de dominio: una tarea pequeña que te dé sensación de logro, como ordenar un cajón o hacer un trámite.", "Hay más dominio que placer": "Solo dominio puede sentirse agotador. Si querés, volvé atrás y sumá algo de placer: algo que te dé disfrute o conexión, como escuchar música o ver a un amigo." } }, { "id": "resumen", "type": "reflect", "title": "Tu semana", "template": "Mis actividades: {{actividades}}.", "content": "Hacelas aunque no tengas ganas: la motivación llega después de empezar.\n\nCuando toques «Terminar», en la última pantalla, tu planificador queda guardado: lo podés volver a ver en este ejercicio, en «Mis respuestas». Si en tu perfil está activado «Compartir mis registros con mi psicólogo», tu psicólogo también lo puede ver." }, { "id": "semana", "type": "info", "title": "Para esta semana", "content": "- Al terminar cada actividad, puntuá placer (P) y dominio (D) de 0 a 10 en el **«Registro de actividades»** (unos 3 minutos) y observá la relación con tu ánimo.\n- Al cerrar la semana, volvé a hacer este planificador: empezá por el balance (¿hubo placer y dominio?) y subí un escalón la dificultad de una actividad." } ]$steps$::jsonb),
  ('tcc-preguntas-socraticas', '50 preguntas socráticas', 'Elegí entre cincuenta preguntas para poner a prueba tus pensamientos, según lo que necesites trabajar.', 'custom', 'tcc', 'adultos', 'tcc', 6, 221,
   $steps$[ { "id": "intro", "type": "info", "title": "50 preguntas socráticas", "content": "Es el Anexo 8 del cuadernillo y acompaña al capítulo «Cuestionamiento socrático y reestructuración». Las preguntas están agrupadas por objetivo terapéutico, en nueve grupos.\n\nElegí según lo que necesites en cada momento. No hace falta usarlas todas: **dos o tres buenas preguntas alcanzan**.\n\nTe sirven para los registros, por ejemplo «Registro de pensamientos (RPD)», «Registro de evidencias» o «Registro de distorsiones». Hacelas con curiosidad real, no para llegar a una respuesta que ya decidiste." }, { "id": "evidencia", "type": "info", "title": "Examinar la evidencia (1 de 9)", "content": "- ¿Qué pruebas concretas tengo de que esto es cierto?\n- ¿Qué pruebas tengo de que NO lo es?\n- ¿Estoy tomando una suposición como si fuera un hecho?\n- Si esto fuera a juicio, ¿alcanzaría la evidencia para condenarlo?\n- ¿Qué datos estoy dejando afuera?\n- ¿Confundo una opinión con un hecho?" }, { "id": "alternativas", "type": "info", "title": "Buscar perspectivas alternativas (2 de 9)", "content": "- ¿Hay otra forma de ver esta situación?\n- ¿Qué diría alguien que me quiere bien?\n- ¿Qué le diría yo a un amigo que pensara esto?\n- Dentro de cinco años, ¿le daré la misma importancia?\n- ¿Cómo vería esto una persona que admiro por su calma?\n- ¿Qué otras explicaciones posibles hay?" }, { "id": "descatastrofizar", "type": "info", "title": "Descatastrofizar (3 de 9)", "content": "- ¿Qué es lo peor que podría pasar realmente?\n- ¿Qué es lo mejor que podría pasar?\n- ¿Qué es lo más probable que pase?\n- Si pasara lo peor, ¿cómo lo afrontaría?\n- ¿Sobreviviría a esto? ¿Lo he superado antes?\n- ¿Estoy confundiendo «posible» con «probable»?" }, { "id": "utilidad", "type": "info", "title": "Evaluar la utilidad del pensamiento (4 de 9)", "content": "- ¿Me sirve de algo pensar así?\n- ¿Qué efecto tiene en mí creer esto?\n- ¿Qué ganaría si lo pensara distinto?\n- ¿Este pensamiento me acerca o me aleja de lo que quiero?\n- ¿Pensar esto resuelve algo o solo me hunde?" }, { "id": "distorsiones", "type": "info", "title": "Cuestionar distorsiones y absolutos (5 de 9)", "content": "- ¿Estoy pensando en todo o nada, sin puntos medios?\n- ¿Uso palabras como «siempre», «nunca», «todos», «nadie»?\n- ¿Estoy leyendo la mente de otra persona sin datos?\n- ¿Estoy prediciendo el futuro como si fuera seguro?\n- ¿Me estoy poniendo una etiqueta global por un hecho puntual?\n- ¿Estoy usando lo que siento como prueba de lo que pasa?" }, { "id": "exigencias", "type": "info", "title": "Trabajar exigencias y reglas (Ellis) (6 de 9)", "content": "- ¿Dónde está escrito que esto DEBE ser así?\n- ¿Es realmente intolerable o muy molesto?\n- ¿Puedo cambiar este «debo» por un «prefiero»?\n- ¿Le exigiría lo mismo a otra persona?\n- ¿Esta regla me protege o me limita?" }, { "id": "creencias", "type": "info", "title": "Trabajar creencias nucleares (7 de 9)", "content": "- Si esto fuera cierto, ¿qué significaría de mí?\n- ¿Esta idea sobre mí es un hecho o una vieja historia aprendida?\n- ¿Qué evidencia de mi vida contradice esta creencia?\n- ¿Un error define quién soy por completo?\n- ¿Cómo aprendí a creer esto sobre mí?\n- ¿Qué creencia más justa podría sostener en su lugar?" }, { "id": "autocompasion", "type": "info", "title": "Autocompasión y trato hacia uno mismo (8 de 9)", "content": "- ¿Me estoy hablando como le hablaría a alguien que quiero?\n- ¿Estoy siendo justo conmigo o solo severo?\n- ¿Qué necesito realmente en este momento?\n- ¿Puedo darme el permiso de ser humano y equivocarme?\n- ¿Qué me diría una versión más compasiva de mí?" }, { "id": "accion", "type": "info", "title": "Orientar a la acción (9 de 9)", "content": "- ¿Qué paso pequeño puedo dar ahora, aunque no tenga ganas?\n- ¿Qué haría si no tuviera este pensamiento?\n- ¿Cómo puedo poner a prueba esta creencia en la vida real?\n- ¿Qué experimento me sacaría de la duda?\n- Si el problema tuviera solución, ¿cuál sería el primer movimiento?" }, { "id": "me_sirvio", "type": "list", "prompt": "¿Qué preguntas te sirvieron hoy?", "help": "Copiá una por renglón o escribilas con tus palabras. Si estás haciendo la tarea de «Cuestionamiento socrático y reestructuración», anotá tus cinco favoritas.\n\nEs opcional: si no querés anotar nada, tocá «Terminar». Si anotás algo, queda guardado al tocar «Terminar», en «Mis respuestas» de este ejercicio.", "count": 5, "optional": true } ]$steps$::jsonb),
  ('tcc-glosario', 'Glosario de TCC', 'Consultá definiciones breves de los conceptos centrales del cuadernillo y las lecturas recomendadas.', 'custom', 'tcc', 'adultos', 'tcc', 4, 222,
   $steps$[ { "id": "pensamientos", "type": "info", "title": "Pensamientos (1 de 4)", "content": "Definiciones breves de los conceptos centrales usados en el cuadernillo, para consulta rápida. Están agrupadas por tema.\n\n- **Modelo cognitivo:** el marco de Beck, según el cual la interpretación media entre la situación y la respuesta emocional y conductual.\n- **Pensamiento automático:** idea breve, involuntaria y plausible que surge ante una situación.\n- **Pensamiento caliente:** el pensamiento automático que trae más carga emocional en una situación.\n- **Credibilidad:** cuánto se cree un pensamiento, de 0 a 100. Reducirla es un objetivo terapéutico.\n- **Distorsión cognitiva:** error sistemático en el procesamiento de la información que deforma la realidad.\n- **Rumiación:** repaso repetitivo y circular del pasado o de un problema." }, { "id": "creencias", "type": "info", "title": "Creencias (2 de 4)", "content": "- **Creencia nuclear (esquema):** idea global, rígida y absoluta sobre uno mismo, los demás o el mundo.\n- **Creencia intermedia:** actitudes, reglas y supuestos condicionales que derivan de las creencias nucleares.\n- **Flecha descendente:** técnica que pregunta «si fuera cierto, ¿qué significaría?» hasta llegar a la creencia nuclear.\n- **Modelo ABC:** el esquema de Ellis, Acontecimiento → Creencia → Consecuencia (+ Debate y nueva filosofía).\n- **Creencia irracional (Ellis):** exigencia rígida y absoluta («debo», «tengo que») que genera malestar." }, { "id": "reestructurar", "type": "info", "title": "Cuestionar y reestructurar (3 de 4)", "content": "- **Cuestionamiento socrático:** método de preguntas abiertas para examinar los propios pensamientos y llegar a conclusiones más ajustadas.\n- **Reestructuración cognitiva:** proceso de identificar, evaluar y modificar cogniciones desadaptativas.\n- **Descatastrofización:** evaluar de forma realista la probabilidad y el afrontamiento del peor escenario.\n- **Pensamiento alternativo:** interpretación más ajustada, equilibrada y creíble construida tras la reestructuración." }, { "id": "activacion", "type": "info", "title": "Depresión y activación (4 de 4)", "content": "- **Tríada cognitiva:** visión negativa de uno mismo, del mundo y del futuro, característica de la depresión.\n- **Activación conductual:** reintroducir de forma gradual y planificada actividades de placer y dominio para romper el círculo depresivo.\n- **Actividad de placer:** actividad que aporta disfrute, conexión o bienestar.\n- **Actividad de dominio:** tarea que aporta sensación de logro, competencia o utilidad." }, { "id": "bibliografia_1", "type": "info", "title": "Lecturas recomendadas (1 de 3)", "content": "Las siguientes obras respaldan y amplían el contenido de este cuadernillo. **Este material es psicoeducativo** y no reemplaza la lectura de las fuentes originales ni la formación clínica supervisada.\n\n- Beck, A. T. (1976). Cognitive Therapy and the Emotional Disorders. International Universities Press.\n- Beck, A. T., Rush, A. J., Shaw, B. F., y Emery, G. (1979). Cognitive Therapy of Depression. Guilford Press.\n- Beck, J. S. (2011). Cognitive Behavior Therapy: Basics and Beyond (2.ª ed.). Guilford Press. (Ed. en español: Terapia cognitivo-conductual: fundamentos y más allá.)\n- Beck, A. T., y Haigh, E. A. P. (2014). Advances in cognitive theory and therapy: The generic cognitive model. Annual Review of Clinical Psychology, 10, 1–24." }, { "id": "bibliografia_2", "type": "info", "title": "Lecturas recomendadas (2 de 3)", "content": "- Ellis, A. (1962). Reason and Emotion in Psychotherapy. Lyle Stuart.\n- Ellis, A., y Dryden, W. (1997). The Practice of Rational Emotive Behavior Therapy (2.ª ed.). Springer.\n- Greenberger, D., y Padesky, C. A. (2016). Mind Over Mood (2.ª ed.). Guilford Press. (Ed. en español: El control de tu estado de ánimo.)\n- Padesky, C. A., y Greenberger, D. (1995). Clinician's Guide to Mind Over Mood. Guilford Press.\n- Leahy, R. L. (2017). Cognitive Therapy Techniques: A Practitioner's Guide (2.ª ed.). Guilford Press.\n- Clark, D. M., y Beck, A. T. (2010). Cognitive Therapy of Anxiety Disorders. Guilford Press.\n- Burns, D. D. (1980). Feeling Good: The New Mood Therapy. William Morrow." }, { "id": "bibliografia_3", "type": "info", "title": "Lecturas recomendadas (3 de 3)", "content": "- Martell, C. R., Dimidjian, S., y Herman-Dunn, R. (2010). Behavioral Activation for Depression: A Clinician's Guide. Guilford Press.\n- Hofmann, S. G., Asnaani, A., Vonk, I. J. J., Sawyer, A. T., y Fang, A. (2012). The efficacy of cognitive behavioral therapy: A review of meta-analyses. Cognitive Therapy and Research, 36(5), 427–440.\n- National Institute for Health and Care Excellence (NICE). Guías de práctica clínica para depresión y trastornos de ansiedad. www.nice.org.uk\n- American Psychological Association (APA), Division 12. Research-supported psychological treatments.\n\nEl cuadernillo es material psicoeducativo de uso clínico y formativo, elaborado como guía de trabajo para pacientes y terapeutas en formación. Leerlo no reemplaza una evaluación con un profesional." } ]$steps$::jsonb)
on conflict (slug) do nothing;

-- Recursos de la biblioteca de Materiales (abren el ejercicio correspondiente).
insert into public.materials (title, description, type, category_id, exercise_template_id, duration_minutes, visibility, is_published)
select v.title, v.description, 'exercise', c.id, t.id, t.estimated_minutes, 'public', true
from (values
  ('brujula-entender-lo-que-me-pasa', 'Entender lo que me pasa', 'La cadena situación, pensamiento, emoción, cuerpo, conducta y consecuencia, con el ejemplo de Cami. Para adolescentes.', 'adolescentes'),
  ('brujula-detector-de-pensamientos', 'Mi detector de pensamientos', 'Hechos y pensamientos, la prueba de la cámara y las ocho trampas frecuentes de la mente. Para adolescentes.', 'adolescentes'),
  ('brujula-poner-a-prueba', 'Poner a prueba lo que pienso', 'Hoja de detective para adolescentes: revisar un pensamiento con datos a favor y en contra, con el ejemplo de Lucas.', 'adolescentes'),
  ('brujula-cuando-me-quiero-aislar', 'Cuando me quiero aislar', 'El círculo del aislamiento, ideas que no cuestan plata (placer, logro y conexión), una escalera de pasos y un plan de 7 días.', 'adolescentes'),
  ('brujula-no-todo-lo-que-pienso', 'No todo lo que pienso es una orden', 'Defusión para adolescentes: pensamiento no es hecho, orden ni quién sos; la frase que da distancia y «Hojas en el río».', 'adolescentes'),
  ('brujula-lo-que-me-importa', 'Lo que realmente me importa', 'Valores para adolescentes: la diferencia entre un valor y una meta, elegir tus 3 valores y una acción chiquita para cada uno.', 'adolescentes'),
  ('brujula-emocion-sube-a-100', 'Cuando la emoción sube a 100', 'Regulación emocional para adolescentes: el termómetro de 0 a 10, regular no es reprimir, STOP y una caja de herramientas.', 'adolescentes'),
  ('brujula-decir-lo-que-necesito', 'Decir lo que necesito sin explotar ni callarme', 'Asertividad para adolescentes: callarme, decirlo claro o explotar; la fórmula «Cuando… me siento… necesito… te pido…» y poner límites.', 'adolescentes'),
  ('brujula-cuando-me-hacen-sentir-menos', 'Cuando otros me hacen sentir menos', 'Conflicto, broma, bullying y cyberbullying; el semáforo, qué hacer en redes, lo que pensé sobre mí y un plan anti-bullying.', 'adolescentes'),
  ('brujula-red-de-apoyo', 'Mi red de apoyo', 'Qué es una persona segura, dónde buscarla si en casa no hay, el mapa de apoyo con al menos 2 adultos y a quién recurrir según el tema.', 'adolescentes'),
  ('brujula-pod-vape-presion', 'POD, vape y presión de grupo', 'Cómo aprende el cerebro con la nicotina, la cadena de las ganas, surfear la ola, un plan de 10 minutos y cómo decir que no.', 'adolescentes'),
  ('brujula-plan-momentos-dificiles', 'Mi plan para momentos muy difíciles', 'Plan para adolescentes: señales de alerta, qué hacer para ganar tiempo, a quién pedir ayuda y cómo hacer el entorno más seguro.', 'adolescentes'),
  ('tcc-antes-de-empezar', 'Antes de empezar: cómo usar el cuadernillo de TCC', 'Qué vas a aprender, por qué funciona la TCC, la evidencia, preguntas frecuentes y el mapa de los siete capítulos.', 'psicoeducacion'),
  ('tcc-modelo-cognitivo', 'El modelo cognitivo de Beck', 'Situación, pensamiento, emoción, respuesta física y conducta: por qué el pensamiento es la bisagra. Con ejemplos, un caso y un desglose guiado.', 'psicoeducacion'),
  ('tcc-pensamientos-automaticos', 'Los pensamientos automáticos', 'Qué son, la pregunta de oro, cómo distinguirlos de emociones, preocupaciones y rumiaciones, y cómo anotarlos en el registro de pensamientos (RPD).', 'psicoeducacion'),
  ('tcc-distorsiones', 'Las distorsiones cognitivas', 'Las 12 distorsiones cognitivas con ejemplos y preguntas para cuestionarlas, un quiz y la hoja para identificarlas.', 'psicoeducacion'),
  ('tcc-creencias', 'Creencias intermedias y nucleares', 'Reglas, supuestos y creencias nucleares: los tres dominios, la flecha descendente, el caso de Carla y hojas para trabajarlas.', 'psicoeducacion'),
  ('tcc-reestructuracion', 'Cuestionamiento socrático y reestructuración', 'Las cuatro familias de preguntas socráticas, cómo construir un pensamiento alternativo, el caso de Ana y el registro de pensamientos de 7 columnas.', 'psicoeducacion'),
  ('tcc-abc-ellis', 'El modelo ABC de Ellis', 'Acontecimiento, creencia y consecuencia: cómo pasar de la exigencia rígida a la preferencia flexible. Con ejemplos, un caso y un registro ABCDE.', 'psicoeducacion'),
  ('tcc-activacion-conductual', 'Tríada cognitiva y activación conductual', 'La tríada cognitiva, la espiral de la depresión y cómo salir con actividades de placer y de dominio. Con el caso de Sofía y tu lista de activación.', 'depresion'),
  ('tcc-preguntas-socraticas', '50 preguntas socráticas', 'Cincuenta preguntas para examinar tus pensamientos, agrupadas en nueve objetivos: evidencia, alternativas, exigencias, creencias y más.', 'psicoeducacion'),
  ('tcc-glosario', 'Glosario de TCC', 'Los 19 conceptos centrales de la terapia cognitivo-conductual con definiciones breves, y las lecturas recomendadas del cuadernillo.', 'psicoeducacion')
) as v(slug, title, description, category)
join public.exercise_templates t on t.slug = v.slug
left join public.material_categories c on c.slug = v.category
where not exists (select 1 from public.materials m where m.exercise_template_id = t.id);

commit;
