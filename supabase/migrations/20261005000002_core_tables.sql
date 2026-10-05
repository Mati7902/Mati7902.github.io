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
