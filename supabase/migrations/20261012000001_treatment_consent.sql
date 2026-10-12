-- =============================================================================
-- Consentimiento informado y compromiso terapéutico (asistir a las primeras sesiones).
-- El paciente lo firma al crear su cuenta, antes de la ficha de ingreso.
--
--   · settings.treatment_consent: texto vigente (editable en Configuración › Consentimiento),
--     versión, título y cantidad de sesiones del compromiso. Público: lo leen los pacientes.
--   · treatment_consents: una fila por firma. Guarda la plantilla y los datos del consultorio
--     tal como estaban al firmar, así el documento firmado no cambia aunque después se edite
--     el texto. La base completa esos datos (el cliente solo manda la versión que leyó, su
--     nombre como firma y, si es menor, el de quien autoriza) y nadie puede modificar ni
--     borrar una firma desde la API.
-- El modelo de texto está en src/lib/consent/treatment.ts (tests/unit/consent.test.ts
-- comprueba que coincida con el de esta migración).
-- =============================================================================

insert into public.settings (key, value, description, is_public) values (
  'treatment_consent',
  jsonb_build_object(
    'enabled', true,
    'version', '2026-10',
    'title', 'Consentimiento informado y compromiso terapéutico',
    'sessions', 8,
    'body', $consent$Este documento explica cómo es el tratamiento psicológico con {{profesional}} ({{titulo}}, {{matricula}}), para que puedas decidir con información. Leelo con tranquilidad: si algo no queda claro, lo hablamos en la primera sesión.

**1. En qué consiste el tratamiento**

Es una psicoterapia basada en evidencia, que integra la terapia cognitivo-conductual con aportes de la neurociencia aplicada. Las sesiones duran alrededor de {{duracion}} minutos y pueden ser presenciales o virtuales.

En las primeras sesiones evaluamos juntos lo que te pasa, con la ayuda de tu ficha de ingreso, y acordamos objetivos. Después trabajamos con estrategias concretas, que vas a practicar también entre sesiones con los ejercicios y materiales de la app.

**2. Beneficios y posibles molestias**

La psicoterapia suele ayudar a entender lo que te pasa, a aliviar el malestar y a desarrollar herramientas propias. Los resultados dependen de muchos factores y no se pueden garantizar.

A veces, hablar de temas difíciles genera más malestar por un tiempo. Es parte del proceso y lo podés plantear en sesión.

**3. Confidencialidad y sus límites**

Lo que hablamos en sesión y lo que registrás en la app es confidencial y está protegido por el secreto profesional. Solo se puede compartir sin tu autorización:

- si hay un riesgo grave para tu vida o la de otras personas;
- si lo ordena una autoridad judicial;
- para proteger a una niña, un niño o un adolescente en riesgo.

En esos casos se comparte solo lo indispensable y, siempre que sea posible, lo hablamos antes con vos.

Si tenés menos de 18 años, tu madre, padre o tutor tiene que autorizar el tratamiento. Lo que contás en sesión se mantiene en reserva, salvo en las situaciones de riesgo de arriba.

**4. Sesiones virtuales y uso de la app**

Para las sesiones virtuales necesitás un lugar privado y una conexión estable. La app es un apoyo entre sesiones: no es un servicio de urgencias y lo que escribís ahí no se lee en el momento. Tus datos se tratan como explica la política de privacidad.

Si en algún momento estás en peligro o pensás en hacerte daño, no esperes a la sesión: en la sección Calmarme de la app está el recuadro «Si necesitás ayuda urgente», o acudí a la guardia del hospital más cercano.

**5. Compromiso de asistir a las primeras {{sesiones}} sesiones**

Te pedimos que te comprometas a asistir a las primeras {{sesiones}} sesiones. Estas son las razones:

- **Es el tiempo que suele necesitar un proceso para mostrar resultados.** Las investigaciones sobre psicoterapia muestran que alrededor de la mitad de las personas tiene una mejoría clara hacia la octava sesión (Howard y colaboradores, 1986).
- **El tratamiento tiene etapas.** En las primeras sesiones evaluamos y entendemos lo que te pasa; en las siguientes practicamos estrategias concretas; al final de este primer tramo revisamos juntos lo logrado.
- **El cerebro aprende con práctica repetida.** Formas de pensar, sentir y reaccionar que se repitieron durante años no cambian en una o dos sesiones: lo nuevo necesita practicarse durante varias semanas para consolidarse.
- **Dejar al principio es lo que menos ayuda.** Alrededor de una de cada cinco personas deja la terapia antes de tiempo (Swift y Greenberg, 2012), muchas veces justo cuando el trabajo empieza a tocar temas difíciles. Sostener el proceso permite atravesar esa etapa con acompañamiento.

En la sesión {{sesiones}} revisamos los objetivos y decidimos juntos si seguir, con qué frecuencia, o si el tratamiento puede terminar.

Este compromiso es una decisión tuya para darle una oportunidad real al proceso; no es una obligación legal. Podés interrumpir el tratamiento cuando quieras. Si lo decidís, te pedimos que lo hablemos en una sesión de cierre.

**6. Asistencia y cancelaciones**

Si no podés asistir, avisá con al menos {{cancelacion}} horas de anticipación desde la app, así el horario lo puede usar otra persona. Si las ausencias se repiten, lo vamos a hablar para ver juntos si es el momento adecuado para el tratamiento.

**7. Tus derechos**

Podés hacer preguntas sobre el tratamiento en cualquier momento, pedir una derivación a otro profesional, acceder a tus datos y retirar este consentimiento.

Al firmar, declarás que leíste este documento, que pudiste hacer preguntas y que aceptás iniciar el tratamiento y el compromiso de asistir a las primeras {{sesiones}} sesiones.

**Referencias**

- Howard, K. I., Kopta, S. M., Krause, M. S. y Orlinsky, D. E. (1986). The dose-effect relationship in psychotherapy. American Psychologist, 41(2), 159-164.
- Swift, J. K. y Greenberg, R. P. (2012). Premature discontinuation in adult psychotherapy: A meta-analysis. Journal of Consulting and Clinical Psychology, 80(4), 547-559.$consent$
  ),
  'Consentimiento informado y compromiso terapéutico que firma el paciente.',
  true
)
on conflict (key) do nothing;

create table public.treatment_consents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  version       text not null,
  title         text not null,
  body_template text not null,
  -- Datos del consultorio con los que se completa la plantilla: {profesional, titulo, ...}.
  params        jsonb not null default '{}'::jsonb,
  sessions      smallint not null,
  signed_name   text not null,
  guardian_name text,
  is_minor      boolean not null default false,
  accepted_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint treatment_consents_version_len check (char_length(version) between 1 and 40),
  constraint treatment_consents_title_len check (char_length(title) between 1 and 200),
  constraint treatment_consents_body_len check (char_length(body_template) between 1 and 20000),
  constraint treatment_consents_params_object check (jsonb_typeof(params) = 'object'),
  constraint treatment_consents_sessions_range check (sessions between 1 and 40),
  constraint treatment_consents_signed_name_len check (char_length(btrim(signed_name)) between 3 and 160),
  constraint treatment_consents_guardian_len check (guardian_name is null or char_length(btrim(guardian_name)) between 3 and 160),
  constraint treatment_consents_minor_guardian check (not is_minor or guardian_name is not null)
);
create index treatment_consents_patient_idx on public.treatment_consents (patient_id, accepted_at desc);

comment on table public.treatment_consents is 'Firmas del consentimiento informado y compromiso terapéutico (inmutables).';

-- Número de la configuración como lo lee una persona (12 → "12", 1.5 → "1,5"), igual que
-- consentParams() en src/lib/consent/treatment.ts.
create or replace function public.consent_number(p_value jsonb)
returns text
language sql immutable set search_path = public as $$
  select case
    when v is null then null
    when v = trunc(v) then trunc(v)::bigint::text
    else replace(rtrim(v::text, '0'), '.', ',')
  end
  from (select case when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric end as v) s;
$$;

-- Al firmar, la base completa el documento con la configuración vigente: el cliente no puede
-- elegir el texto, la fecha ni si es menor de edad.
create or replace function public.prepare_treatment_consent()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_consent  jsonb := coalesce(public.setting_value('treatment_consent'), '{}'::jsonb);
  v_identity jsonb := coalesce(public.setting_value('site.identity'), '{}'::jsonb);
  v_sched    jsonb := coalesce(public.setting_value('scheduling'), '{}'::jsonb);
  v_tz       text  := coalesce(v_sched ->> 'timezone', 'America/Asuncion');
  v_birth    date;
  v_sessions smallint := coalesce((v_consent ->> 'sessions')::smallint, 8);
begin
  if not public.is_privileged() then
    if coalesce((v_consent ->> 'enabled')::boolean, true) is false then
      raise exception 'El consentimiento informado no está habilitado.' using errcode = 'P0001';
    end if;
    -- Firmó lo que leyó: si el texto cambió mientras lo leía, tiene que volver a leerlo.
    if new.version is distinct from (v_consent ->> 'version') then
      raise exception 'El consentimiento se actualizó mientras lo leías. Recargá la página para ver la versión vigente.' using errcode = 'P0001';
    end if;
    new.title := v_consent ->> 'title';
    new.body_template := v_consent ->> 'body';
    new.sessions := v_sessions;
    new.params := '{}'::jsonb;
    new.accepted_at := now();
    new.created_at := now();
    new.is_minor := null;
  end if;

  new.title := coalesce(new.title, v_consent ->> 'title', 'Consentimiento informado y compromiso terapéutico');
  new.body_template := coalesce(new.body_template, v_consent ->> 'body');
  new.sessions := coalesce(new.sessions, v_sessions);
  if new.params is null or new.params = '{}'::jsonb then
    new.params := jsonb_build_object(
      'profesional', v_identity ->> 'professional_name',
      'titulo', v_identity ->> 'professional_title',
      'matricula', v_identity ->> 'license',
      'sesiones', new.sessions::text,
      'duracion', public.consent_number(v_sched -> 'default_duration_minutes'),
      'cancelacion', public.consent_number(v_sched -> 'cancel_min_hours')
    );
  end if;
  if new.is_minor is null then
    select birth_date into v_birth from public.patients where id = new.patient_id;
    new.is_minor := v_birth is not null and v_birth + interval '18 years' > (now() at time zone v_tz)::date;
  end if;
  new.signed_name := btrim(new.signed_name);
  new.guardian_name := nullif(btrim(coalesce(new.guardian_name, '')), '');
  if new.is_minor and new.guardian_name is null then
    raise exception 'Si tenés menos de 18 años, falta el nombre de tu madre, padre o tutor.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger treatment_consents_prepare
  before insert on public.treatment_consents
  for each row execute function public.prepare_treatment_consent();

revoke execute on function public.prepare_treatment_consent() from public, anon, authenticated;
revoke execute on function public.consent_number(jsonb) from public, anon, authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.treatment_consents enable row level security;

create policy "consents: paciente ve las propias" on public.treatment_consents for select to authenticated
  using (patient_id = public.current_patient_id());
create policy "consents: paciente firma" on public.treatment_consents for insert to authenticated
  with check (patient_id = public.current_patient_id());
create policy "consents: profesional lee" on public.treatment_consents for select to authenticated
  using (public.is_admin());

-- Una firma no se edita ni se borra desde la API (se borra con la ficha del paciente).
revoke all on public.treatment_consents from anon;
revoke update, delete, truncate on public.treatment_consents from authenticated;
