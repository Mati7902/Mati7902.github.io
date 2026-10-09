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

commit;
