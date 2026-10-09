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
