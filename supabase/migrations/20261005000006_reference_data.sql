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

  ('theme', jsonb_build_object('primary', '#2f6468', 'accent', '#27b088', 'background', '#fbfdfc'), 'Colores básicos de la interfaz.', true),

  ('legal', jsonb_build_object(
    'privacy_version', '2026-10-draft',
    'terms_version', '2026-10-draft',
    'consent_version', '2026-10-draft',
    'reviewed_by_professional', false
  ), 'Versiones de textos legales (requieren revisión profesional antes de producción).', true),

  ('landing', jsonb_build_object(
    'hero_title', 'Terapia desde *donde estés*, con el rigor de una consulta clínica.',
    'hero_subtitle', 'Acompañamiento psicológico profesional en modalidad virtual, con el mismo marco clínico, ético y basado en evidencia que en consultorio.',
    'specialties_title', 'Terapia basada en neurociencia aplicada',
    'specialties', jsonb_build_array(
      jsonb_build_object('title', 'Trastornos de ansiedad', 'text', 'Ansiedad generalizada, pánico, fobias y ansiedad social.'),
      jsonb_build_object('title', 'Depresión', 'text', 'Depresión mayor, distimia y episodios del estado de ánimo.'),
      jsonb_build_object('title', 'Estrés y burnout', 'text', 'Estrés crónico, agotamiento laboral e insomnio.'),
      jsonb_build_object('title', 'Trauma y duelo', 'text', 'Estrés postraumático, duelos y procesos de cambio vital.')
    ),
    'approach_label', 'Enfoque diferencial',
    'approach_text', 'Integración de psicoterapia clínica y neurociencia aplicada, con intervenciones respaldadas por evidencia actualizada.',
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
