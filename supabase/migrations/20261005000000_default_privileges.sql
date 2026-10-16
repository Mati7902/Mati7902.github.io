-- ============================================================================
-- 0000 · Permisos de las tablas nuevas
-- ----------------------------------------------------------------------------
-- Supabase solía dar a anon, authenticated y service_role permiso sobre cada
-- tabla nueva de "public". Desde 2026 los proyectos nuevos pueden venir sin ese
-- permiso automático (opción "Automatically expose new tables" al crear el
-- proyecto), y sin él la plataforma falla con "permission denied". Acá se declara
-- explícitamente, así la instalación no depende de esa opción.
--
-- Quién ve y modifica cada fila lo siguen decidiendo las políticas RLS de cada
-- tabla, y las migraciones siguientes quitan los permisos de más donde
-- corresponde (por ejemplo, anon no accede a las fichas de pacientes).
-- Los permisos de funciones se otorgan uno por uno en 0003.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
