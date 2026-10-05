-- ============================================================================
-- Tests de Row Level Security (SQL puro, sin dependencias).
-- Se ejecutan con el seed cargado. Cada bloque falla con una excepción si una
-- política permite algo indebido.
-- ============================================================================
\set ON_ERROR_STOP on
\o /dev/null

-- Helpers ---------------------------------------------------------------------
create or replace function pg_temp.login(p_user uuid, p_role text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  reset role;
end $$;

create or replace function pg_temp.assert(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Datos de prueba: segundo paciente "Ana Ejemplo" sin relación con Juan -------------
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
values ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.ejemplo@demo.local',
        crypt('x', gen_salt('bf')), now(), '{"provider":"email"}'::jsonb, '{"first_name":"Ana","last_name":"Ejemplo"}'::jsonb, now(), now(), '', '')
on conflict (id) do nothing;
insert into public.profiles (id, role, email, first_name, last_name) values ('33333333-3333-4333-8333-333333333333', 'patient', 'ana.ejemplo@demo.local', 'Ana', 'Ejemplo') on conflict (id) do nothing;
insert into public.patients (profile_id, first_name, last_name, email, phone) values ('33333333-3333-4333-8333-333333333333', 'Ana', 'Ejemplo', 'ana.ejemplo@demo.local', '+595981111111') on conflict do nothing;
insert into public.appointments (patient_id, start_time, end_time, modality, status, source)
select id, now() + interval '20 days', now() + interval '20 days 1 hour', 'presencial', 'confirmed', 'admin' from public.patients where email = 'ana.ejemplo@demo.local';
insert into public.emotional_logs (patient_id, emotions, intensity) select id, array['triste'], 5 from public.patients where email = 'ana.ejemplo@demo.local';
commit;

-- ---------------------------------------------------------------------------
-- 1. Un paciente solo ve sus propios datos
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select count(*) from public.patients) = 1, 'paciente ve exactamente 1 ficha (la propia)');
select pg_temp.assert((select count(*) from public.patients where email = 'ana.ejemplo@demo.local') = 0, 'paciente no ve a otros pacientes');
select pg_temp.assert((select count(*) from public.appointments) = 3, 'paciente ve solo sus 3 turnos');
select pg_temp.assert((select count(*) from public.appointments a join public.patients p on p.id = a.patient_id where p.email = 'ana.ejemplo@demo.local') = 0, 'paciente no ve turnos ajenos');
select pg_temp.assert((select count(*) from public.emotional_logs) = 5, 'paciente ve solo sus registros emocionales');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'paciente ve solo su perfil');
select pg_temp.assert((select count(*) from public.blocked_slots) = 0, 'paciente no ve bloqueos de agenda');
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'paciente no ve auditoría');
select pg_temp.assert((select count(*) from public.whatsapp_messages) = 0, 'paciente no ve mensajes de WhatsApp');
select pg_temp.assert((select count(*) from public.settings where key = 'whatsapp') = 0, 'paciente no ve settings privados');
select pg_temp.assert((select count(*) from public.settings where key = 'site.identity') = 1, 'paciente ve settings públicos');
-- Materiales: públicos + asignados (2 asignados + 3 públicos = 5)
select pg_temp.assert((select count(*) from public.materials) = 5, 'paciente ve materiales públicos y asignados');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 2. Un paciente no puede escalar privilegios ni escribir datos ajenos
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
do $$
begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'ASSERTION FAILED: el paciente pudo cambiar su rol';
exception when insufficient_privilege then
  raise notice 'ok - paciente no puede escalar su rol';
end $$;
do $$
begin
  update public.patients set status = 'discharged' where profile_id = auth.uid();
  raise exception 'ASSERTION FAILED: el paciente pudo cambiar su estado administrativo';
exception when insufficient_privilege then
  raise notice 'ok - paciente no puede modificar campos administrativos';
end $$;
-- Puede actualizar su teléfono
update public.patients set phone = '+595981000001' where profile_id = auth.uid();
select pg_temp.assert((select phone from public.patients where profile_id = auth.uid()) = '+595981000001', 'paciente puede actualizar su teléfono');
-- No puede insertar registros emocionales para otro paciente
do $$
declare v_other uuid;
begin
  select id into v_other from public.patients where email = 'ana.ejemplo@demo.local';
  -- Con RLS, el paciente no ve a Ana, por eso buscamos el id como superusuario antes:
  if v_other is null then
    raise notice 'ok - paciente ni siquiera puede resolver el id de otro paciente';
  else
    insert into public.emotional_logs (patient_id, emotions, intensity) values (v_other, array['triste'], 3);
    raise exception 'ASSERTION FAILED: insertó registro para otro paciente';
  end if;
exception when insufficient_privilege or check_violation then
  raise notice 'ok - paciente no puede insertar registros para otro paciente';
end $$;
-- No puede insertar turnos directamente (solo vía RPC)
do $$
begin
  insert into public.appointments (patient_id, start_time, end_time) values (public.current_patient_id(), now() + interval '30 days', now() + interval '30 days 1 hour');
  raise exception 'ASSERTION FAILED: el paciente insertó un turno sin pasar por la RPC';
exception when insufficient_privilege then
  raise notice 'ok - paciente no puede insertar turnos directamente';
end $$;
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 3. RPC de reservas: autorización, anti double booking y bloqueos
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
-- Reserva válida
select pg_temp.assert(
  (select status from public.create_appointment_tx(public.current_patient_id(), now() + interval '30 days', now() + interval '30 days 1 hour', 'virtual', 'requested')) = 'requested',
  'paciente puede solicitar un turno vía RPC');
-- Mismo horario → rechazado
do $$
begin
  perform public.create_appointment_tx(public.current_patient_id(), now() + interval '30 days', now() + interval '30 days 1 hour', 'virtual', 'requested');
  raise exception 'ASSERTION FAILED: double booking permitido';
exception when exclusion_violation then
  raise notice 'ok - double booking rechazado';
end $$;
-- Solapamiento parcial → rechazado
do $$
begin
  perform public.create_appointment_tx(public.current_patient_id(), now() + interval '30 days 30 minutes', now() + interval '30 days 90 minutes', 'virtual', 'requested');
  raise exception 'ASSERTION FAILED: solapamiento parcial permitido';
exception when exclusion_violation then
  raise notice 'ok - solapamiento parcial rechazado';
end $$;
-- Reservar para otro paciente → rechazado
do $$
begin
  perform public.create_appointment_tx('00000000-0000-0000-0000-000000000001'::uuid, now() + interval '31 days', now() + interval '31 days 1 hour', 'virtual', 'requested');
  raise exception 'ASSERTION FAILED: reservó para otro paciente';
exception when insufficient_privilege then
  raise notice 'ok - no puede reservar para otro paciente';
end $$;
-- Horario pasado → rechazado
do $$
begin
  perform public.create_appointment_tx(public.current_patient_id(), now() - interval '1 day', now() - interval '23 hours', 'virtual', 'requested');
  raise exception 'ASSERTION FAILED: reservó en el pasado';
exception when invalid_parameter_value then
  raise notice 'ok - no puede reservar en el pasado';
end $$;
-- Estado inicial inválido → rechazado
do $$
begin
  perform public.create_appointment_tx(public.current_patient_id(), now() + interval '32 days', now() + interval '32 days 1 hour', 'virtual', 'completed');
  raise exception 'ASSERTION FAILED: estado inicial completed aceptado';
exception when insufficient_privilege then
  raise notice 'ok - estado inicial inválido rechazado';
end $$;
select pg_temp.logout();
rollback;

-- Bloqueo de agenda impide reservar
begin;
insert into public.blocked_slots (start_time, end_time, type, reason) values (now() + interval '40 days', now() + interval '41 days', 'vacation', 'Vacaciones');
select pg_temp.login('22222222-2222-4222-8222-222222222222');
do $$
begin
  perform public.create_appointment_tx(public.current_patient_id(), now() + interval '40 days 2 hours', now() + interval '40 days 3 hours', 'presencial', 'requested');
  raise exception 'ASSERTION FAILED: reservó sobre un bloqueo';
exception when exclusion_violation then
  raise notice 'ok - bloqueo de agenda respetado';
end $$;
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 4. Transiciones de estado del paciente (confirmar / cancelar) y ventana horaria
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
-- Confirmar el turno pendiente (en 9 días)
select pg_temp.assert(
  (select status from public.confirm_appointment_tx((select id from public.appointments where status = 'pending' limit 1))) = 'confirmed',
  'paciente puede confirmar asistencia de un turno pendiente');
-- Cancelar el turno dentro de la ventana (en 9 días)
select pg_temp.assert(
  (select status from public.cancel_appointment_tx((select id from public.appointments where start_time > now() + interval '8 days' limit 1), 'No puedo ese día')) = 'cancelled',
  'paciente puede cancelar con anticipación');
-- Historial registrado
select pg_temp.assert((select count(*) from public.appointment_history where new_status = 'cancelled') >= 1, 'historial de cancelación registrado');
-- No puede marcar como completado
do $$
begin
  update public.appointments set status = 'completed' where status = 'confirmed';
  raise exception 'ASSERTION FAILED: paciente marcó un turno como completado';
exception when insufficient_privilege then
  raise notice 'ok - paciente no puede marcar completado';
end $$;
select pg_temp.logout();
rollback;

-- Cancelación fuera de ventana (turno dentro de 2 horas) → rechazada
begin;
insert into public.appointments (patient_id, start_time, end_time, modality, status, source)
select id, now() + interval '2 hours', now() + interval '3 hours', 'virtual', 'confirmed', 'admin' from public.patients where email = 'juan.perez@demo.local';
select pg_temp.login('22222222-2222-4222-8222-222222222222');
do $$
begin
  perform public.cancel_appointment_tx((select id from public.appointments where start_time < now() + interval '3 hours' and start_time > now() limit 1), 'tarde');
  raise exception 'ASSERTION FAILED: canceló fuera de la ventana permitida';
exception when raise_exception then
  raise notice 'ok - cancelación fuera de ventana rechazada';
end $$;
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 5. Administrador: acceso completo y notificaciones automáticas
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.patients) >= 2, 'admin ve todos los pacientes');
select pg_temp.assert((select count(*) from public.appointments) >= 4, 'admin ve todos los turnos');
select pg_temp.assert((select count(*) from public.settings where key = 'whatsapp') = 1, 'admin ve settings privados');
select pg_temp.assert((select count(*) from public.emotional_logs) >= 6, 'admin ve registros compartidos');
-- Crear turno como admin (sin restricción de pasado) y verificar notificación al paciente
select pg_temp.assert(
  (select status from public.create_appointment_tx((select id from public.patients where email = 'juan.perez@demo.local'), now() + interval '15 days', now() + interval '15 days 1 hour', 'presencial', 'pending', 'admin')) = 'pending',
  'admin crea un turno pendiente');
-- Las notificaciones del paciente solo las ve el paciente (ni siquiera el admin): verificamos como superusuario.
select pg_temp.logout();
select pg_temp.assert(
  (select count(*) from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type = 'appointment_confirmed' and created_at > now() - interval '1 minute') >= 1,
  'el paciente recibe notificación in-app del nuevo turno');
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'admin no ve notificaciones ajenas');
-- Reprogramar: historial + reseteo de recordatorios
update public.appointments set reminder_24h_sent_at = now() where start_time > now() + interval '14 days' and start_time < now() + interval '16 days';
select pg_temp.assert(
  (select reminder_24h_sent_at is null from public.reschedule_appointment_tx(
      (select id from public.appointments where start_time > now() + interval '14 days' and start_time < now() + interval '16 days' limit 1),
      now() + interval '16 days', now() + interval '16 days 1 hour', 'rescheduled', 'Cambio del profesional', 'admin')),
  'reprogramar resetea el recordatorio de 24h');
select pg_temp.assert(
  (select count(*) from public.appointment_history h where h.new_status = 'rescheduled' and h.reason = 'Cambio del profesional') >= 1,
  'historial de reprogramación con motivo');
select pg_temp.logout();
select pg_temp.assert(
  (select count(*) from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type = 'appointment_updated') >= 1,
  'el paciente recibe notificación de cambio de horario');
rollback;

-- Si el paciente deja de compartir, el profesional no ve sus registros
begin;
update public.patients set share_records_with_professional = false where email = 'juan.perez@demo.local';
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.emotional_logs el join public.patients p on p.id = el.patient_id where p.email = 'juan.perez@demo.local') = 0,
  'profesional no ve registros si el paciente no comparte');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 6. Anónimo: solo contenido público
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login(null, 'anon');
select pg_temp.assert((select count(*) from public.therapy_plans where is_active) >= 2, 'anon ve planes activos');
select pg_temp.assert((select count(*) from public.faqs) >= 1, 'anon ve FAQs');
select pg_temp.assert((select count(*) from public.settings where key = 'site.identity') = 1, 'anon ve identidad pública');
select pg_temp.assert((select count(*) from public.settings where key = 'reminders') = 0, 'anon no ve settings privados');
select pg_temp.assert((select count(*) from public.patients) = 0, 'anon no ve pacientes');
select pg_temp.assert((select count(*) from public.appointments) = 0, 'anon no ve turnos');
select pg_temp.assert((select count(*) from public.materials) = 0, 'anon no ve materiales');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 7. Rate limiting
-- ---------------------------------------------------------------------------
begin;
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = true, 'rate limit: 1er intento permitido');
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = true, 'rate limit: 2do intento permitido');
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = false, 'rate limit: 3er intento bloqueado');
rollback;

\o
\echo 'RLS tests: todos los bloques pasaron'
