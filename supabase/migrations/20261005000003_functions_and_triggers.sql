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
begin
  select p.profile_id, p.first_name || ' ' || p.last_name into v_profile_id, v_name
  from public.patients p where p.id = new.patient_id;

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
    if new.start_time is distinct from old.start_time then
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
      elsif new.status = 'cancelled' and coalesce(new.cancelled_by, '00000000-0000-0000-0000-000000000000'::uuid) <> v_profile_id then
        insert into public.notifications (user_id, type, title, body, data)
        values (v_profile_id, 'appointment_cancelled', 'Turno cancelado',
          'La sesión del ' || v_when || ' fue cancelada. Podés solicitar un nuevo horario cuando quieras.',
          jsonb_build_object('appointment_id', new.id));
      end if;
    end if;
  end if;

  if new.status is distinct from old.status and new.status = 'cancelled' and new.cancelled_by = v_profile_id then
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
alter default privileges in schema public revoke execute on functions from public;
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
