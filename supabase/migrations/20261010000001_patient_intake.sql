-- =============================================================================
-- Ficha de ingreso del paciente («Cuestionario clínico completo – Datos + Historial
-- + BASIC I.D.»). La completa el propio paciente al crear su cuenta.
--
-- Es la información de salud más sensible y la única que el profesional ve sin que el
-- paciente decida compartirla (los registros personales siguen share_records_with_professional),
-- por eso va en una tabla aparte con reglas propias:
--   · el paciente ve, crea y actualiza solo la suya (no la puede borrar: se la pide al profesional);
--   · el profesional (admin/professional) la lee solo cuando el paciente la envía: el borrador
--     es privado; recepción no la ve nunca;
--   · nadie más: la secretaria virtual de WhatsApp y el proveedor de IA no la leen.
-- Las preguntas están definidas en src/lib/intake/form.ts; answers = { id de pregunta: valor }.
-- =============================================================================

create table public.patient_intakes (
  patient_id         uuid primary key references public.patients (id) on delete cascade,
  form_version       text not null default '2026-10',
  answers            jsonb not null default '{}'::jsonb,
  -- Último envío al profesional y primer envío (lo completa el trigger, no el cliente).
  submitted_at       timestamptz,
  first_submitted_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint patient_intakes_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint patient_intakes_answers_size check (octet_length(answers::text) <= 200000),
  constraint patient_intakes_form_version_len check (char_length(form_version) <= 20)
);

comment on table public.patient_intakes is 'Ficha de ingreso que completa el paciente. Datos de salud: solo el paciente y el profesional (una vez enviada).';
comment on column public.patient_intakes.answers is 'Respuestas por id de pregunta (ver src/lib/intake/form.ts).';
comment on column public.patient_intakes.submitted_at is 'Último envío al profesional. null = borrador privado del paciente.';

create trigger patient_intakes_set_updated_at
  before update on public.patient_intakes
  for each row execute function public.set_updated_at();

-- Lo que el paciente no puede decidir: de quién es la ficha, las fechas de envío (las pone el
-- servidor de la base) ni volverla a borrador una vez enviada.
create or replace function public.guard_patient_intake_write()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged() then
    if tg_op = 'UPDATE' then
      new.first_submitted_at := coalesce(old.first_submitted_at, new.first_submitted_at, new.submitted_at);
    else
      new.first_submitted_at := coalesce(new.first_submitted_at, new.submitted_at);
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.submitted_at is not null then
      new.submitted_at := now();
    end if;
    new.first_submitted_at := new.submitted_at;
    return new;
  end if;

  if new.patient_id is distinct from old.patient_id then
    raise exception 'No podés cambiar de quién es la ficha' using errcode = '42501';
  end if;
  if old.submitted_at is not null and new.submitted_at is null then
    raise exception 'La ficha ya fue enviada: no puede volver a borrador' using errcode = '42501';
  end if;
  if new.submitted_at is distinct from old.submitted_at then
    new.submitted_at := now();
  end if;
  new.created_at := old.created_at;
  new.first_submitted_at := coalesce(old.first_submitted_at, new.submitted_at);
  return new;
end;
$$;

create trigger patient_intakes_guard_write
  before insert or update on public.patient_intakes
  for each row execute function public.guard_patient_intake_write();

-- Aviso in-app al profesional cuando el paciente envía (o vuelve a enviar) la ficha.
-- Sin contenido clínico en la notificación: solo quién y un enlace.
create or replace function public.notify_patient_intake_submitted()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_first boolean;
begin
  if new.submitted_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.submitted_at is not distinct from old.submitted_at then
    return new;
  end if;
  v_first := tg_op = 'INSERT' or old.submitted_at is null;
  select nullif(btrim(first_name || ' ' || last_name), '') into v_name from public.patients where id = new.patient_id;
  perform public.notify_admins(
    'system',
    case when v_first then 'Ficha de ingreso completa' else 'Ficha de ingreso actualizada' end,
    coalesce(v_name, 'Un paciente') || case when v_first then ' completó su ficha de ingreso.' else ' actualizó su ficha de ingreso.' end,
    jsonb_build_object('patient_id', new.patient_id, 'intake', true)
  );
  return new;
end;
$$;

create trigger patient_intakes_notify_submitted
  after insert or update of submitted_at on public.patient_intakes
  for each row execute function public.notify_patient_intake_submitted();

-- Funciones de trigger: sin EXECUTE para roles de cliente (las invoca la base).
revoke execute on function public.guard_patient_intake_write() from public, anon, authenticated;
revoke execute on function public.notify_patient_intake_submitted() from public, anon, authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.patient_intakes enable row level security;

create policy "intake: paciente ve la propia" on public.patient_intakes for select to authenticated
  using (patient_id = public.current_patient_id());
create policy "intake: paciente crea la propia" on public.patient_intakes for insert to authenticated
  with check (patient_id = public.current_patient_id());
create policy "intake: paciente actualiza la propia" on public.patient_intakes for update to authenticated
  using (patient_id = public.current_patient_id()) with check (patient_id = public.current_patient_id());
-- El profesional solo la ve cuando el paciente la envía (el borrador es privado). is_admin()
-- incluye admin y professional, no recepción.
create policy "intake: profesional lee las enviadas" on public.patient_intakes for select to authenticated
  using (public.is_admin() and submitted_at is not null);

-- Sin DELETE para clientes: la ficha se borra con la del paciente (on delete cascade) o a pedido,
-- desde la base.
revoke all on public.patient_intakes from anon;
revoke delete, truncate on public.patient_intakes from authenticated;
