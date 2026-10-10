-- ============================================================================
-- SEED DE DEMOSTRACIÓN · SOLO PARA ENTORNOS LOCALES / STAGING
-- Crea un administrador y un paciente ficticio (Juan Pérez) con datos de ejemplo.
-- NUNCA ejecutar en producción. NUNCA usar pacientes reales.
--
-- Credenciales demo:
--   admin@demo.local         / DemoAdmin!2026
--   juan.perez@demo.local    / DemoPaciente!2026   (adulto)
--   sofia.benitez@demo.local / DemoAdolescente!2026 (15 años: ve el cuadernillo Brújula)
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

  -- Ficha de ingreso enviada (respuestas ficticias) --------------------------------
  update public.patients set emergency_contact_name = 'Marta Pérez, mi mamá', emergency_contact_phone = '+595981000010' where id = v_patient_id;
  insert into public.patient_intakes (patient_id, answers, submitted_at, created_at, updated_at)
  values (v_patient_id, '{
    "nombre": "Juan Pérez",
    "fecha_nacimiento": "2004-05-12",
    "estado_civil": "Soltero",
    "hijos": "No",
    "ocupacion": "Estudiante de Ingeniería (3.er año)",
    "residencia": "Encarnación, con mis padres y mi hermano",
    "telefono": "+595981000000",
    "contacto_emergencia": {"nombre": "Marta Pérez, mi mamá", "telefono": "+595981000010"},
    "motivo": "Me pongo muy nervioso antes de los exámenes y me cuesta dormir. Últimamente discuto mucho en casa.",
    "consultas_previas": "Fui a una psicóloga en el colegio, unos meses.",
    "diagnosticos": "Ninguno",
    "medicacion": "Ninguna",
    "hospitalizaciones": "Ninguna",
    "autolesion": "No",
    "eventos_estresantes": "La separación de mis abuelos el año pasado me afectó bastante.",
    "enfermedades_cronicas": "Ninguna",
    "alergias": "Penicilina",
    "cirugias": "Apendicitis a los 12",
    "historia_neurologica": "Ninguna",
    "dolencias_actuales": "Dolores de cabeza en época de exámenes",
    "antecedentes_familiares": "Una tía tuvo depresión",
    "relacion_familia": "Buena con mis padres; con mi hermano discutimos seguido",
    "conflictos_familiares": "Discusiones por la compu y las tareas de la casa",
    "alcohol": "Los fines de semana, con amigos",
    "cannabis": "Nunca",
    "tabaco": "No",
    "estimulantes": "Mucho café en época de exámenes",
    "sueno": "Unas 6 horas; me cuesta dormirme",
    "apetito": "Normal",
    "conductas_alimentarias": "Salteo el desayuno",
    "conductas_problematicas": "Dejo todo para último momento",
    "conductas_estres": "Me quedo con el celular hasta tarde",
    "cambios_rutinas": "Desde que empezó el semestre duermo menos",
    "evitacion": "Evito estudiar las materias que más me cuestan",
    "impulsividad": "Contesto mal cuando me enojo",
    "reaccion_enojo": "Grito y me encierro en mi cuarto",
    "emociones_predominantes": "Ansiedad, cansancio",
    "picos_emocionales": "Me enojo rápido y después se me pasa",
    "regulacion_emocional": "Me cuesta bastante calmarme cuando me enojo",
    "estado_animo": 6,
    "ansiedad_irritabilidad": "Bastante, sobre todo antes de los exámenes",
    "anhedonia": "No, sigo disfrutando del fútbol",
    "sensaciones_estres": "Nudo en el estómago y me transpiran las manos",
    "variaciones_energia": "Más cansado en época de exámenes",
    "dolores_tensiones": "Tensión en el cuello",
    "energia_general": "Media",
    "cambios_fisicos": "Ninguno",
    "imagenes_malestar": "Me imagino desaprobando y teniendo que contarlo en casa",
    "recuerdos_intrusivos": "A veces, un examen que me fue muy mal",
    "fantasias_negativas": "Que no voy a terminar la carrera",
    "imagenes_idealizadas": "Recibido y trabajando en lo que me gusta",
    "proyeccion": "Más organizado y durmiendo mejor",
    "pensamientos_negativos": "«No voy a llegar», «soy un desastre»",
    "pensamientos_acelerados": "De noche, cuando me acuesto",
    "autocritica": "Bastante",
    "culpa_desesperanza": "A veces culpa por no estudiar lo suficiente",
    "ideas_obsesivas": "No",
    "atencion": "Me distraigo con el celular",
    "relaciones_importantes": "Mis padres, mi hermano y dos amigos de la facultad",
    "conflictos_pareja": "Con mi hermano",
    "confianza_limites": "Me cuesta decir que no cuando me piden favores",
    "soledad": "En general, acompañado",
    "reaccion_criticas": "Me cuesta, me lo tomo personal",
    "autopercepcion_social": "Creo que me ven tranquilo, aunque por dentro no lo esté",
    "bio_medicacion": "Ninguna",
    "bio_alcohol": "Los fines de semana, con amigos",
    "bio_otras_sustancias": "Cannabis: Nunca · Tabaco: No",
    "bio_sueno": "Unas 6 horas; me cuesta dormirme",
    "bio_apetito": "Normal",
    "salud_general": "Buena",
    "actividad_fisica": "Fútbol los sábados",
    "objetivos": "Manejar mejor los nervios antes de los exámenes, dormir mejor y discutir menos en casa.",
    "compromiso": "Alto",
    "frecuencia": "1 vez por semana"
  }'::jsonb, now() - interval '55 days', now() - interval '56 days', now() - interval '55 days')
  on conflict (patient_id) do nothing;
  -- El aviso al profesional se generó recién: se lo fecha con el envío y se marca como leído.
  update public.notifications set created_at = now() - interval '55 days', read_at = now() - interval '54 days'
  where data ->> 'patient_id' = v_patient_id::text and data ->> 'intake' = 'true';

  -- Contacto de WhatsApp vinculado --------------------------------------------------
  insert into public.whatsapp_contacts (phone, display_name, patient_id) values ('+595981000000', 'Juan Pérez', v_patient_id)
  on conflict (phone) do nothing;
end $$;

-- ----------------------------------------------------------------------------
-- Paciente adolescente ficticia (Sofía Benítez, 15 años) para ver el cuadernillo
-- Brújula, que se ofrece según la edad. La fecha de nacimiento se calcula para que
-- siempre tenga 15 años.
-- ----------------------------------------------------------------------------
do $$
declare
  v_admin_id uuid := '11111111-1111-4111-8111-111111111111';
  v_sofia_id uuid := '44444444-4444-4444-8444-444444444444';
  v_patient_id uuid;
  v_t_detector uuid; v_t_partida uuid; v_t_plan uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values
  (v_sofia_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sofia.benitez@demo.local',
   crypt('DemoAdolescente!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"first_name":"Sofía","last_name":"Benítez"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;

  if to_regclass('auth.identities') is not null then
    execute $q$
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      select gen_random_uuid(), u.id, u.id::text, 'email',
             jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
             now(), now(), now()
      from auth.users u
      where u.id = '44444444-4444-4444-8444-444444444444'
        and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
    $q$;
  end if;

  insert into public.profiles (id, role, email, first_name, last_name)
  values (v_sofia_id, 'patient', 'sofia.benitez@demo.local', 'Sofía', 'Benítez')
  on conflict (id) do nothing;

  insert into public.patients (profile_id, first_name, last_name, email, phone, whatsapp_phone, birth_date, guardian_name, modality, status, admission_date, consent_accepted_at, consent_version, created_by)
  values (v_sofia_id, 'Sofía', 'Benítez', 'sofia.benitez@demo.local', '+595981000044', '+595981000044',
          (current_date - interval '15 years 4 months')::date, 'Laura Benítez (madre)', 'virtual', 'active', current_date - 21, now() - interval '21 days', '2026-10-draft', v_admin_id)
  on conflict do nothing;
  select id into v_patient_id from public.patients where profile_id = v_sofia_id;

  -- Brújula: un ejercicio sugerido y dos respuestas ficticias (punto de partida y plan),
  -- para ver «Mis respuestas» y la tarjeta del plan en Calmarme.
  select id into v_t_detector from public.exercise_templates where slug = 'brujula-detector-de-pensamientos';
  select id into v_t_partida from public.exercise_templates where slug = 'brujula-punto-de-partida';
  select id into v_t_plan from public.exercise_templates where slug = 'brujula-plan-momentos-dificiles';

  if v_t_detector is not null then
    insert into public.exercise_assignments (patient_id, template_id, assigned_by, note, assigned_at)
    values (v_patient_id, v_t_detector, v_admin_id, 'Probalo con algo que te haya pasado en el colegio esta semana.', now() - interval '3 days');
  end if;
  if v_t_partida is not null then
    insert into public.exercise_responses (patient_id, template_id, answers, completed_at) values
      (v_patient_id, v_t_partida, '{"como_me_dicen":"Sofi","me_pasa":["Nervios o ansiedad","El colegio"],"diferente":"Poder dar una lección oral sin que me tiemble la voz","tres_cosas":["Los nervios antes de las pruebas","Pedir ayuda cuando no entiendo"],"hoy_animo":6,"hoy_nervios":3,"hoy_relaciones":7,"hoy_familia":7,"hoy_colegio":4,"hoy_confianza":5,"hoy_emociones":5}'::jsonb, now() - interval '20 days');
  end if;
  if v_t_plan is not null then
    insert into public.exercise_responses (patient_id, template_id, answers, completed_at) values
      (v_patient_id, v_t_plan, '{"senales":["Me encierro en la pieza y no contesto mensajes","No puedo dormir"],"cosas_solo":["Escuchar mi lista de música tranquila","Salir al patio y respirar lento","Dibujar"],"lugares_personas":["La casa de mi abuela","Mi prima Ana"],"adultos":["Mamá (Laura)","Tía Rocío","Profe Martín, el orientador"],"psicologo":"Lic. Matías Sánchez, por la app o WhatsApp","entorno":"Lo acordé con mamá","importa":"Mi perro Toby y el vóley"}'::jsonb, now() - interval '7 days');
  end if;
end $$;

