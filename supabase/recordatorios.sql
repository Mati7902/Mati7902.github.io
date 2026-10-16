-- ============================================================================
-- Recordatorios de turnos: programación en Supabase (Integrations › Cron)
--
-- Cada 15 minutos la base llama a /api/cron/reminders de la página publicada.
-- Funciona en cualquier plan de Supabase y de Vercel, y de paso mantiene activa
-- la base del plan gratuito (que se pausa tras una semana sin actividad).
--
-- Cómo usarlo: reemplazá las dos marcas (TU-DOMINIO y TU-CRON-SECRET, el mismo
-- valor de la variable CRON_SECRET de Vercel), pegá todo en SQL Editor › New query
-- y tocá Run. Si cambiás de dominio o de secreto, volvé a correrlo con los valores
-- nuevos: el trabajo se reemplaza (tiene siempre el mismo nombre).
--
-- No va en instalar.sql porque necesita la dirección y el secreto de tu página.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'recordatorios-turnos',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://TU-DOMINIO/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer TU-CRON-SECRET'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Para comprobarlo después de 15 minutos (status 200 = funcionó; 401 = el secreto no coincide):
--   select status_code, content, created from net._http_response order by created desc limit 5;
-- Para pausarlo:
--   select cron.unschedule('recordatorios-turnos');
