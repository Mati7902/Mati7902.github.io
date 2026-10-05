-- ============================================================================
-- SEED DE DEMOSTRACIÓN · SOLO PARA ENTORNOS LOCALES / STAGING
-- Crea un administrador y un paciente ficticio (Juan Pérez) con datos de ejemplo.
-- NUNCA ejecutar en producción. NUNCA usar pacientes reales.
--
-- Credenciales demo:
--   admin@demo.local       / DemoAdmin!2026
--   juan.perez@demo.local  / DemoPaciente!2026
-- ============================================================================
do $$
declare
  v_admin_id   uuid := '11111111-1111-4111-8111-111111111111';
  v_juan_id    uuid := '22222222-2222-4222-8222-222222222222';
  v_patient_id uuid;
  v_tz         text := 'America/Asuncion';
  v_base       timestamptz;
  v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid;
  v_t_thought uuid; v_t_values uuid; v_t_stop uuid; v_t_breath uuid;
  v_cat_ansiedad uuid; v_cat_regulacion uuid; v_cat_sueno uuid; v_cat_psico uuid; v_cat_autoestima uuid;
begin
  -- Usuarios de auth (el trigger handle_new_user crea los perfiles). -----------
  -- GoTrue no admite NULL en las columnas de tokens/cambios: se inicializan con cadena vacía.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values
  (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@demo.local',
   crypt('DemoAdmin!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
   '{"first_name":"Matías","last_name":"Sánchez"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  (v_juan_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juan.perez@demo.local',
   crypt('DemoPaciente!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Juan","last_name":"Pérez"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;

  -- Identidades de email (requeridas por GoTrue para iniciar sesión con contraseña).
  if to_regclass('auth.identities') is not null then
    execute $q$
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      select gen_random_uuid(), u.id, u.id::text, 'email',
             jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
             now(), now(), now()
      from auth.users u
      where u.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')
        and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
    $q$;
  end if;

  -- Si el trigger no corrió (entornos de prueba), asegurar perfiles. ---------
  insert into public.profiles (id, role, email, first_name, last_name)
  values (v_admin_id, 'admin', 'admin@demo.local', 'Matías', 'Sánchez')
  on conflict (id) do update set role = 'admin';
  insert into public.profiles (id, role, email, first_name, last_name)
  values (v_juan_id, 'patient', 'juan.perez@demo.local', 'Juan', 'Pérez')
  on conflict (id) do nothing;

  -- Paciente ficticio ----------------------------------------------------------
  insert into public.patients (profile_id, first_name, last_name, email, phone, whatsapp_phone, birth_date, modality, status, admission_date, consent_accepted_at, consent_version, created_by)
  values (v_juan_id, 'Juan', 'Pérez', 'juan.perez@demo.local', '+595981000000', '+595981000000', '2004-05-12', 'mixta', 'active', current_date - 60, now() - interval '60 days', '2026-10-draft', v_admin_id)
  on conflict do nothing;
  select id into v_patient_id from public.patients where profile_id = v_juan_id;

  -- Turnos: uno completado, uno confirmado próximo, uno pendiente -------------------
  v_base := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  insert into public.appointments (patient_id, start_time, end_time, modality, status, source, completed_at, created_by)
  values (v_patient_id, v_base - interval '7 days' + interval '18 hours', v_base - interval '7 days' + interval '19 hours', 'presencial', 'completed', 'admin', v_base - interval '7 days' + interval '19 hours', v_admin_id);

  insert into public.appointments (patient_id, start_time, end_time, modality, status, source, video_link, confirmed_at, created_by)
  values (v_patient_id, v_base + interval '2 days' + interval '18 hours', v_base + interval '2 days' + interval '19 hours', 'virtual', 'confirmed', 'admin', 'https://meet.google.com/demo-link', now(), v_admin_id);

  insert into public.appointments (patient_id, start_time, end_time, modality, status, source, created_by)
  values (v_patient_id, v_base + interval '9 days' + interval '17 hours', v_base + interval '9 days' + interval '18 hours', 'presencial', 'pending', 'admin', v_admin_id);

  -- Materiales --------------------------------------------------------------------
  select id into v_cat_ansiedad from public.material_categories where slug = 'ansiedad';
  select id into v_cat_regulacion from public.material_categories where slug = 'regulacion-emocional';
  select id into v_cat_sueno from public.material_categories where slug = 'sueno';
  select id into v_cat_psico from public.material_categories where slug = 'psicoeducacion';
  select id into v_cat_autoestima from public.material_categories where slug = 'autoestima';
  select id into v_t_thought from public.exercise_templates where slug = 'registro-pensamientos';
  select id into v_t_values from public.exercise_templates where slug = 'valores';
  select id into v_t_stop from public.exercise_templates where slug = 'dbt-stop';
  select id into v_t_breath from public.exercise_templates where slug = 'respiracion-diafragmatica';

  insert into public.materials (title, description, type, category_id, external_url, visibility, is_published, created_by)
  values ('¿Qué es la ansiedad y por qué aparece?', 'Una explicación breve y clara sobre cómo funciona la respuesta de ansiedad en el cuerpo.', 'link', v_cat_ansiedad, 'https://example.org/ansiedad', 'public', true, v_admin_id)
  returning id into v_m1;
  insert into public.materials (title, description, type, category_id, external_url, visibility, is_published, created_by)
  values ('Higiene del sueño: 7 hábitos', 'Pautas simples para dormir mejor.', 'pdf', v_cat_sueno, 'https://example.org/sueno.pdf', 'public', true, v_admin_id)
  returning id into v_m2;
  insert into public.materials (title, description, type, category_id, exercise_template_id, visibility, is_published, created_by)
  values ('Ejercicio: ordenar mis pensamientos', 'Registro cognitivo guiado dentro de la app.', 'exercise', v_cat_regulacion, v_t_thought, 'assigned', true, v_admin_id)
  returning id into v_m3;
  insert into public.materials (title, description, type, category_id, external_url, duration_minutes, visibility, is_published, created_by)
  values ('Audio: relajación muscular progresiva', 'Audio guiado de 12 minutos.', 'audio', v_cat_regulacion, 'https://example.org/relajacion.mp3', 12, 'assigned', true, v_admin_id)
  returning id into v_m4;
  insert into public.materials (title, description, type, category_id, external_url, visibility, is_published, created_by)
  values ('Hablarte como a alguien que querés', 'Psicoeducación sobre autocompasión y diálogo interno.', 'link', v_cat_autoestima, 'https://example.org/autocompasion', 'public', true, v_admin_id)
  returning id into v_m5;

  insert into public.patient_materials (patient_id, material_id, assigned_by, note, viewed_at)
  values (v_patient_id, v_m3, v_admin_id, 'Probalo después de alguna situación que te haya movilizado.', null),
         (v_patient_id, v_m4, v_admin_id, 'Ideal antes de dormir.', now() - interval '3 days');

  -- Ejercicios asignados y respuestas ---------------------------------------------
  insert into public.exercise_assignments (patient_id, template_id, assigned_by, note, assigned_at, completed_at) values
    (v_patient_id, v_t_thought, v_admin_id, 'Una vez esta semana.', now() - interval '6 days', now() - interval '4 days'),
    (v_patient_id, v_t_values, v_admin_id, null, now() - interval '6 days', null),
    (v_patient_id, v_t_stop, v_admin_id, 'Para los momentos de enojo con tu hermano.', now() - interval '2 days', null),
    (v_patient_id, v_t_breath, v_admin_id, 'Tres minutos por día.', now() - interval '6 days', now() - interval '1 day');

  insert into public.exercise_responses (patient_id, template_id, answers, emotion_before, emotion_after, completed_at) values
    (v_patient_id, v_t_thought, '{"situation":"Mi profesor no respondió mi mensaje","thought":"Seguro piensa que soy un desastre","emotion":"ansioso","evidence_for":"No respondió en todo el día","evidence_against":"Suele tardar; la semana pasada respondió al día siguiente","friend":"Le diría que probablemente esté ocupado","alternative":"No tengo pruebas de que piense mal de mí; quizás solo está ocupado"}'::jsonb, 8, 4, now() - interval '4 days'),
    (v_patient_id, v_t_breath, '{"duration_minutes":3,"pattern":"4-6"}'::jsonb, 6, 3, now() - interval '1 day');

  -- Registros emocionales ficticios ------------------------------------------------
  insert into public.emotional_logs (patient_id, logged_at, emotions, intensity, situation, thought, behavior, need) values
    (v_patient_id, now() - interval '6 days', array['ansioso','cansado'], 7, 'Examen de matemáticas mañana', 'No voy a llegar a estudiar todo', 'Me quedé mirando el celular', 'Organizar el tiempo'),
    (v_patient_id, now() - interval '5 days', array['tranquilo'], 3, 'Salí a caminar con un amigo', null, null, null),
    (v_patient_id, now() - interval '3 days', array['enojado','frustrado'], 8, 'Discusión con mi hermano por la compu', 'Siempre me pasa a mí', 'Grité y me encerré', 'Que me escuchen'),
    (v_patient_id, now() - interval '2 days', array['triste'], 5, 'Domingo a la noche', 'Otra semana igual', 'Me acosté temprano', 'Compañía'),
    (v_patient_id, now() - interval '1 day', array['esperanzado','motivado'], 4, 'Aprobé el examen', 'Capaz sí puedo', 'Le conté a mi mamá', null);

  -- Preparación de sesión para el próximo turno -----------------------------------
  insert into public.session_preparations (appointment_id, patient_id, week_rating, hardest, better, topics, practiced, important, submitted_at)
  select a.id, v_patient_id, 6, 'La discusión con mi hermano', 'Aprobar el examen', 'Cómo no explotar cuando me enojo', 'Respiración, 3 veces', null, now()
  from public.appointments a where a.patient_id = v_patient_id and a.status = 'confirmed' order by a.start_time limit 1;

  -- Contacto de WhatsApp vinculado --------------------------------------------------
  insert into public.whatsapp_contacts (phone, display_name, patient_id) values ('+595981000000', 'Juan Pérez', v_patient_id)
  on conflict (phone) do nothing;
end $$;
