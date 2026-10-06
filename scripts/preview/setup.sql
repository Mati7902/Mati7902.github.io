-- ============================================================================
-- VISTA PREVIA LOCAL · NO USAR EN PRODUCCIÓN
-- Complementos para servir la base local con PostgREST y la pasarela de
-- scripts/preview/gateway.mjs (emula lo mínimo de Supabase Auth/Storage).
-- Se aplica DESPUÉS de las migraciones y el seed, solo en la base de vista previa.
-- ============================================================================

-- Rol con el que se conecta PostgREST (como en Supabase). La contraseña la genera start.sh en
-- cada ejecución (variable psql :authenticator_password); nunca queda una clave fija conocida.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator nologin noinherit;
  end if;
end $$;
alter role authenticator with login noinherit password :'authenticator_password';
grant anon, authenticated, service_role to authenticator;

-- Solo puede conectarse a la base de vista previa.
revoke connect on database psicologia_preview from public;
grant connect on database psicologia_preview to authenticator;

-- En Supabase, service_role tiene acceso completo al esquema public.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Funciones que usa la pasarela para el inicio de sesión (solo service_role).
create schema if not exists preview;
grant usage on schema preview to service_role;

create or replace function preview.verify_password(p_email text, p_password text)
returns uuid language sql stable security definer set search_path = auth, public, extensions as $$
  select id from auth.users
  where lower(email) = lower(p_email)
    and encrypted_password is not null
    and encrypted_password = crypt(p_password, encrypted_password)
  limit 1;
$$;

create or replace function preview.get_user(p_id uuid)
returns jsonb language sql stable security definer set search_path = auth, public as $$
  select jsonb_build_object(
    'id', u.id,
    'aud', 'authenticated',
    'role', 'authenticated',
    'email', u.email,
    'email_confirmed_at', u.email_confirmed_at,
    'app_metadata', coalesce(u.raw_app_meta_data, '{}'::jsonb),
    'user_metadata', coalesce(u.raw_user_meta_data, '{}'::jsonb),
    'identities', '[]'::jsonb,
    'created_at', u.created_at,
    'updated_at', u.updated_at
  )
  from auth.users u where u.id = p_id;
$$;

revoke all on function preview.verify_password(text, text) from public;
revoke all on function preview.get_user(uuid) from public;
grant execute on function preview.verify_password(text, text) to service_role;
grant execute on function preview.get_user(uuid) to service_role;
