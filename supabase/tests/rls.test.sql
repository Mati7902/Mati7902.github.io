-- ============================================================================
-- Tests de Row Level Security y privilegios (SQL puro, sin dependencias).
-- Se ejecutan con el seed cargado. Cada bloque falla con una excepción si una
-- política o función permite algo indebido.
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

-- Turno válido de la grilla del seed (lunes a viernes, 14:00–20:00, 60 min) en America/Asuncion,
-- a p_days días de hoy (saltando fines de semana) y a la hora p_hour.
create or replace function pg_temp.slot(p_days int, p_hour int) returns timestamptz language plpgsql stable as $$
declare d date := (now() at time zone 'America/Asuncion')::date + p_days;
begin
  while extract(dow from d) in (0, 6) loop d := d + 1; end loop;
  return (d + make_time(p_hour, 0, 0)) at time zone 'America/Asuncion';
end $$;

-- Ejecuta una sentencia y verifica que falle con el SQLSTATE esperado.
create or replace function pg_temp.expect_error(p_sql text, p_states text[], p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = any (p_states) then
      raise notice 'ok - %', p_msg;
      return;
    end if;
    raise exception 'ASSERTION FAILED: % (SQLSTATE % inesperado: %)', p_msg, sqlstate, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % (la sentencia no falló)', p_msg;
end $$;

-- Las migraciones quitan el EXECUTE por defecto para PUBLIC: los helpers se otorgan explícitamente
-- para poder usarlos después de cambiar de rol.
grant execute on function pg_temp.login(uuid, text), pg_temp.logout(), pg_temp.assert(boolean, text),
  pg_temp.slot(int, int), pg_temp.expect_error(text, text[], text) to public;

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
select pg_temp.expect_error($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, array['42501'], 'paciente no puede escalar su rol');
select pg_temp.expect_error($q$update public.patients set status = 'discharged' where profile_id = auth.uid()$q$, array['42501'], 'paciente no puede modificar campos administrativos');
select pg_temp.expect_error($q$update public.patients set whatsapp_phone = '+595981999999' where profile_id = auth.uid()$q$, array['42501'], 'paciente no puede cambiar su identidad de WhatsApp');
-- Puede actualizar su teléfono de contacto
update public.patients set phone = '+595981000001' where profile_id = auth.uid();
select pg_temp.assert((select phone from public.patients where profile_id = auth.uid()) = '+595981000001', 'paciente puede actualizar su teléfono de contacto');
-- No puede insertar registros emocionales para otro paciente (ni siquiera resuelve su id)
select pg_temp.assert((select id from public.patients where email = 'ana.ejemplo@demo.local') is null, 'paciente no puede resolver el id de otro paciente');
-- No puede insertar turnos directamente (solo vía RPC)
select pg_temp.expect_error(
  $q$insert into public.appointments (patient_id, start_time, end_time) values (public.current_patient_id(), now() + interval '30 days', now() + interval '30 days 1 hour')$q$,
  array['42501'], 'paciente no puede insertar turnos directamente');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 3. RPC de reservas del paciente: grilla, estado, anticipación y double booking
-- ---------------------------------------------------------------------------
begin;
select set_config('test.ana_patient', (select id::text from public.patients where email = 'ana.ejemplo@demo.local'), true);
select pg_temp.login('22222222-2222-4222-8222-222222222222');
-- Reserva válida: el estado lo decide la configuración (approval → requested), no el cliente.
select pg_temp.assert(
  (select status from public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(30, 15), pg_temp.slot(30, 15) + interval '1 hour', 'virtual', 'confirmed')) = 'requested',
  'paciente solicita un turno de la grilla y no puede autoconfirmarlo');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(30, 15), pg_temp.slot(30, 15) + interval '1 hour', 'virtual')$q$,
  array['23P01'], 'double booking rechazado');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(31, 15) + interval '30 minutes', pg_temp.slot(31, 16) + interval '30 minutes', 'virtual')$q$,
  array['22023'], 'horario desfasado de la grilla rechazado');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(31, 14), pg_temp.slot(31, 14) + interval '365 days', 'virtual')$q$,
  array['22023'], 'rango ilimitado rechazado');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(31, 14), pg_temp.slot(31, 14) + interval '30 minutes', 'virtual')$q$,
  array['22023'], 'duración distinta a la regla rechazada');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(31, 21), pg_temp.slot(31, 22), 'virtual')$q$,
  array['22023'], 'horario fuera de la franja de atención rechazado');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(current_setting('test.ana_patient')::uuid, pg_temp.slot(31, 15), pg_temp.slot(31, 16), 'virtual')$q$,
  array['42501'], 'no puede reservar para otro paciente');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), now() - interval '1 day', now() - interval '23 hours', 'virtual')$q$,
  array['22023'], 'no puede reservar en el pasado');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(60, 15), pg_temp.slot(60, 16), 'virtual')$q$,
  array['22023'], 'no puede reservar más allá de la anticipación máxima');
select pg_temp.logout();
rollback;

-- Bloqueo de agenda impide reservar; el admin tampoco puede solapar turnos (restricción de exclusión)
begin;
insert into public.blocked_slots (start_time, end_time, type, reason) values (pg_temp.slot(36, 0), pg_temp.slot(36, 0) + interval '1 day', 'vacation', 'Vacaciones');
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error(
  $q$select public.create_appointment_tx(public.current_patient_id(), pg_temp.slot(36, 15), pg_temp.slot(36, 16), 'presencial')$q$,
  array['23P01'], 'bloqueo de agenda respetado');
select pg_temp.logout();
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select set_config('test.juan_confirmed_start', (select start_time::text from public.appointments where status = 'confirmed' and start_time > now() order by start_time limit 1), true);
select pg_temp.expect_error(
  $q$select public.create_appointment_tx((select id from public.patients where email = 'juan.perez@demo.local'),
       current_setting('test.juan_confirmed_start')::timestamptz + interval '30 minutes',
       current_setting('test.juan_confirmed_start')::timestamptz + interval '90 minutes', 'presencial', 'pending', 'admin')$q$,
  array['23P01'], 'solapamiento parcial rechazado también para el admin');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 3b. Reprogramación por el paciente (RPC + trigger de guarda)
-- ---------------------------------------------------------------------------
begin;
select set_config('test.ana_appt', (select a.id::text from public.appointments a join public.patients p on p.id = a.patient_id where p.email = 'ana.ejemplo@demo.local' limit 1), true);
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select set_config('test.juan_pending', (select id::text from public.appointments where status = 'pending' limit 1), true);
select pg_temp.assert(
  (select start_time = pg_temp.slot(30, 16) and status = 'requested'
     from public.reschedule_appointment_tx(current_setting('test.juan_pending')::uuid, pg_temp.slot(30, 16), pg_temp.slot(30, 16) + interval '1 hour', 'confirmed', 'Cambio de horario', 'admin')),
  'paciente reprograma a un horario válido (queda pendiente de aprobación)');
select pg_temp.assert(
  (select change_source = 'app' from public.appointment_history where appointment_id = current_setting('test.juan_pending')::uuid and new_status = 'requested' order by created_at desc limit 1),
  'el historial registra el origen real (app), no el que envía el cliente');
select pg_temp.expect_error(
  $q$select public.reschedule_appointment_tx(current_setting('test.juan_pending')::uuid, pg_temp.slot(31, 15) + interval '10 minutes', pg_temp.slot(31, 16) + interval '10 minutes')$q$,
  array['22023'], 'reprogramación fuera de la grilla rechazada');
select pg_temp.expect_error(
  $q$select public.reschedule_appointment_tx(current_setting('test.ana_appt')::uuid, pg_temp.slot(32, 15), pg_temp.slot(32, 16))$q$,
  array['42501'], 'no puede reprogramar turnos ajenos');
select pg_temp.expect_error(
  $q$update public.appointments set start_time = start_time + interval '1 day', end_time = end_time + interval '1 day' where id = current_setting('test.juan_pending')::uuid$q$,
  array['42501'], 'no puede mover un turno con UPDATE directo');
select pg_temp.logout();
select pg_temp.assert(
  (select count(*) from public.notifications n join public.profiles pr on pr.id = n.user_id
    where pr.role = 'admin' and n.title = 'Solicitud de reprogramación' and (n.data ->> 'appointment_id') = current_setting('test.juan_pending')) >= 1,
  'el profesional recibe aviso cuando un paciente reprograma');
select pg_temp.assert(
  (select count(*) from public.notifications where user_id = '22222222-2222-4222-8222-222222222222'
    and title = 'Tu turno cambió de horario' and (data ->> 'appointment_id') = current_setting('test.juan_pending')) = 0,
  'al paciente no se le pide confirmar el cambio que él mismo pidió');
select pg_temp.assert(
  (select count(*) from public.notifications where user_id = '22222222-2222-4222-8222-222222222222'
    and title = 'Pedido de cambio registrado' and (data ->> 'appointment_id') = current_setting('test.juan_pending')) = 1,
  'el paciente recibe un aviso neutro de su pedido de cambio');
rollback;

-- ---------------------------------------------------------------------------
-- 4. Transiciones de estado del paciente (confirmar / cancelar) y ventana horaria
-- ---------------------------------------------------------------------------
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.assert(
  (select status from public.confirm_appointment_tx((select id from public.appointments where status = 'pending' limit 1))) = 'confirmed',
  'paciente puede confirmar asistencia de un turno pendiente');
select pg_temp.assert(
  (select status from public.cancel_appointment_tx((select id from public.appointments where start_time > now() + interval '8 days' limit 1), 'No puedo ese día')) = 'cancelled',
  'paciente puede cancelar con anticipación');
select pg_temp.assert((select count(*) from public.appointment_history where new_status = 'cancelled') >= 1, 'historial de cancelación registrado');
select pg_temp.expect_error($q$update public.appointments set status = 'completed' where status = 'confirmed'$q$, array['42501'], 'paciente no puede marcar completado');
select pg_temp.logout();
rollback;

-- Cancelación fuera de ventana (turno dentro de 2 horas) → rechazada
begin;
insert into public.appointments (patient_id, start_time, end_time, modality, status, source)
select id, now() + interval '2 hours', now() + interval '3 hours', 'virtual', 'confirmed', 'admin' from public.patients where email = 'juan.perez@demo.local';
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error(
  $q$select public.cancel_appointment_tx((select id from public.appointments where start_time < now() + interval '3 hours' and start_time > now() limit 1), 'tarde')$q$,
  array['P0001'], 'cancelación fuera de ventana rechazada');
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
select pg_temp.assert(
  (select status from public.create_appointment_tx((select id from public.patients where email = 'juan.perez@demo.local'), now() + interval '15 days', now() + interval '15 days 1 hour', 'presencial', 'pending', 'admin', null, null, null, null, 'Prefiere horarios de tarde')) = 'pending',
  'admin crea un turno pendiente fuera de la grilla, con nota administrativa');
select pg_temp.assert((select count(*) from public.appointment_admin_notes where notes = 'Prefiere horarios de tarde') = 1, 'la nota administrativa del turno se guarda aparte');
select pg_temp.logout();
select pg_temp.assert(
  (select count(*) from public.notifications where user_id = '22222222-2222-4222-8222-222222222222' and type = 'appointment_confirmed' and created_at > now() - interval '1 minute') >= 1,
  'el paciente recibe notificación in-app del nuevo turno');
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'admin no ve notificaciones ajenas');
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

-- Borradores de "Preparar mi sesión": invisibles para el profesional hasta que se envían
begin;
update public.session_preparations set submitted_at = null;
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.session_preparations) = 0, 'profesional no ve borradores de preparación');
select pg_temp.logout();
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select count(*) from public.session_preparations) = 1, 'el paciente sí ve su propio borrador');
select pg_temp.logout();
rollback;

-- Notas administrativas: solo para el profesional
begin;
insert into public.patient_admin_notes (patient_id, notes) select id, 'Abona por transferencia' from public.patients where email = 'juan.perez@demo.local';
insert into public.appointment_admin_notes (appointment_id, notes) select a.id, 'Confirmar sala' from public.appointments a join public.patients p on p.id = a.patient_id where p.email = 'juan.perez@demo.local' limit 1;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select count(*) from public.patient_admin_notes) = 0, 'paciente no ve las notas administrativas de su ficha');
select pg_temp.assert((select count(*) from public.appointment_admin_notes) = 0, 'paciente no ve las notas administrativas de sus turnos');
select pg_temp.logout();
select pg_temp.login('11111111-1111-4111-8111-111111111111');
select pg_temp.assert((select count(*) from public.patient_admin_notes) = 1 and (select count(*) from public.appointment_admin_notes) = 1, 'admin ve las notas administrativas');
select pg_temp.logout();
rollback;

-- ---------------------------------------------------------------------------
-- 6. Anónimo: solo contenido público y ninguna RPC
-- ---------------------------------------------------------------------------
begin;
select set_config('test.juan_appt', (select id::text from public.appointments where status = 'pending' limit 1), true);
select set_config('test.juan_patient', (select id::text from public.patients where email = 'juan.perez@demo.local'), true);
select pg_temp.login(null, 'anon');
select pg_temp.assert((select count(*) from public.therapy_plans where is_active) >= 2, 'anon ve planes activos');
select pg_temp.assert((select count(*) from public.faqs) >= 1, 'anon ve FAQs');
select pg_temp.assert((select count(*) from public.settings where key = 'site.identity') = 1, 'anon ve identidad pública');
select pg_temp.assert((select count(*) from public.settings where key = 'reminders') = 0, 'anon no ve settings privados');
select pg_temp.assert((select count(*) from public.patients) = 0, 'anon no ve pacientes');
select pg_temp.assert((select count(*) from public.appointments) = 0, 'anon no ve turnos');
select pg_temp.assert((select count(*) from public.materials) = 0, 'anon no ve materiales');
select pg_temp.assert(public.is_privileged() = false, 'una petición anónima (JWT sin sub) no es privilegiada');
select pg_temp.expect_error($q$select public.confirm_appointment_tx(current_setting('test.juan_appt')::uuid)$q$, array['42501'], 'anon no puede confirmar turnos');
select pg_temp.expect_error($q$select public.cancel_appointment_tx(current_setting('test.juan_appt')::uuid)$q$, array['42501'], 'anon no puede cancelar turnos');
select pg_temp.expect_error($q$select public.reschedule_appointment_tx(current_setting('test.juan_appt')::uuid, now() + interval '1 hour', now() + interval '2 hours', 'confirmed')$q$, array['42501'], 'anon no puede reprogramar turnos');
select pg_temp.expect_error($q$select public.create_appointment_tx(current_setting('test.juan_patient')::uuid, now() + interval '1 hour', now() + interval '2 hours', 'virtual', 'confirmed')$q$, array['42501'], 'anon no puede crear turnos');
select pg_temp.expect_error($q$select public.notify_admins('system', 'spam', 'spam', '{}'::jsonb)$q$, array['42501'], 'anon no puede notificar a los administradores');
select pg_temp.expect_error($q$select public.audit_log('forged')$q$, array['42501'], 'anon no puede escribir auditoría');
select pg_temp.expect_error($q$select public.check_rate_limit('login:admin@demo.local', 1, 900)$q$, array['42501'], 'anon no puede manipular el rate limit');
select pg_temp.expect_error($q$select public.setting_value('whatsapp')$q$, array['42501'], 'anon no puede leer configuración privada por RPC');
select pg_temp.expect_error($q$select public.cleanup_rate_limits()$q$, array['42501'], 'anon no puede limpiar el rate limit');
select pg_temp.logout();
rollback;

-- Paciente autenticado: helpers internos no expuestos
begin;
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_error($q$select public.check_rate_limit('login:admin@demo.local', 1, 900)$q$, array['42501'], 'paciente no puede bloquear el login de otra cuenta');
select pg_temp.expect_error($q$select public.setting_value('whatsapp')$q$, array['42501'], 'paciente no puede leer configuración privada por RPC');
select pg_temp.expect_error($q$select public.notify_admins('system', 'spam', 'spam', '{}'::jsonb)$q$, array['42501'], 'paciente no puede notificar a los administradores');
select public.audit_log('patient.test');
select pg_temp.logout();
select pg_temp.assert((select actor_id from public.audit_logs where action = 'patient.test') = '22222222-2222-4222-8222-222222222222', 'la auditoría registra siempre al actor real');
select pg_temp.login('22222222-2222-4222-8222-222222222222');
select pg_temp.assert((select total from public.admin_monthly_stats(now() - interval '1 year', now() + interval '1 year')) = 0, 'las métricas administrativas no revelan datos a un paciente');
select pg_temp.logout();
rollback;

-- Funciones futuras: el default global ya no otorga EXECUTE a PUBLIC.
begin;
create function public.tmp_probe_default_privileges() returns integer language sql as 'select 1';
select pg_temp.assert(not has_function_privilege('anon', 'public.tmp_probe_default_privileges()', 'execute'), 'una función nueva no queda ejecutable por anon');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.tmp_probe_default_privileges()', 'execute'), 'una función nueva no queda ejecutable por authenticated');
rollback;

-- ---------------------------------------------------------------------------
-- 7. Rate limiting (solo servidor)
-- ---------------------------------------------------------------------------
begin;
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = true, 'rate limit: 1er intento permitido');
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = true, 'rate limit: 2do intento permitido');
select pg_temp.assert(public.check_rate_limit('test:key', 2, 60) = false, 'rate limit: 3er intento bloqueado');
rollback;

\o
\echo 'RLS tests: todos los bloques pasaron'
