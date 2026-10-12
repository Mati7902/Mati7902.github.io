-- ============================================================================
-- Testimonios anónimos para la portada
-- ----------------------------------------------------------------------------
-- Los carga el profesional en Configuración › Testimonios, con el texto que la
-- persona aprobó. Son anónimos por diseño: no se vinculan con ninguna ficha de
-- paciente y solo guardan 👩/👨, el texto y un contexto breve opcional.
-- Solo se publican si el profesional confirmó que tiene la autorización escrita
-- de la persona; la web anónima no ve los demás.
-- ============================================================================

create table public.testimonials (
  id                   uuid primary key default gen_random_uuid(),
  gender               text not null check (gender in ('mujer', 'hombre')),
  quote                text not null check (char_length(btrim(quote)) between 20 and 600),
  context              text check (context is null or char_length(context) <= 80),
  consent_confirmed    boolean not null default false,
  -- Cuándo se confirmó la autorización (la pone la base).
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

create or replace function public.stamp_testimonial_consent()
returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.consent_confirmed then
    new.consent_confirmed_at := null;
  elsif tg_op = 'INSERT' or not old.consent_confirmed then
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
create policy "testimonials: lectura pública" on public.testimonials for select to anon, authenticated
  using ((is_published and consent_confirmed) or public.is_admin());
create policy "testimonials: admin gestiona" on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete, truncate on public.testimonials from anon;
