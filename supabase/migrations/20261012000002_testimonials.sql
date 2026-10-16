-- ============================================================================
-- Testimonios anónimos para la portada
-- ----------------------------------------------------------------------------
-- Los carga el profesional en Configuración › Testimonios, con el texto que la
-- persona aprobó. Son anónimos por diseño: no se vinculan con ninguna ficha de
-- paciente y solo guardan 👩/👨, el texto y un contexto breve opcional.
-- Solo se publican si el profesional confirmó que tiene la autorización escrita
-- de la persona. La tabla la lee solo el profesional; la web usa
-- published_testimonials(), que devuelve los publicados sin fechas ni datos internos.
-- ============================================================================

create table public.testimonials (
  id                   uuid primary key default gen_random_uuid(),
  gender               text not null check (gender in ('mujer', 'hombre')),
  quote                text not null check (char_length(btrim(quote)) between 20 and 600),
  context              text check (context is null or char_length(context) <= 80),
  consent_confirmed    boolean not null default false,
  -- Cuándo se confirmó la autorización del texto actual (la pone la base).
  consent_confirmed_at timestamptz,
  is_published         boolean not null default false,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint testimonials_published_needs_consent check (not is_published or consent_confirmed)
);

create index testimonials_order_idx on public.testimonials (sort_order, created_at);

create trigger testimonials_set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

-- La fecha corresponde al texto que se autorizó: si cambia el texto, el contexto o 👩/👨,
-- se vuelve a registrar (la app pide confirmar otra vez la autorización antes de guardar).
create or replace function public.stamp_testimonial_consent()
returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.consent_confirmed then
    new.consent_confirmed_at := null;
  elsif tg_op = 'INSERT'
     or not old.consent_confirmed
     or (new.gender, new.quote, new.context) is distinct from (old.gender, old.quote, old.context) then
    new.consent_confirmed_at := now();
  else
    new.consent_confirmed_at := old.consent_confirmed_at;
  end if;
  return new;
end;
$$;

create trigger testimonials_stamp_consent before insert or update on public.testimonials
  for each row execute function public.stamp_testimonial_consent();

revoke execute on function public.stamp_testimonial_consent() from public, anon, authenticated;

alter table public.testimonials enable row level security;
create policy "testimonials: admin gestiona" on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.testimonials from anon;

-- Lo único que ve la web: los publicados con autorización, sin fechas ni datos internos.
create or replace function public.published_testimonials()
returns table (id uuid, gender text, quote text, context text)
language sql stable security definer set search_path = public as $$
  select t.id, t.gender, t.quote, t.context
  from public.testimonials t
  where t.is_published and t.consent_confirmed
  order by t.sort_order, t.created_at, t.id;
$$;

revoke execute on function public.published_testimonials() from public;
grant execute on function public.published_testimonials() to anon, authenticated;
