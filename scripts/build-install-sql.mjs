// Une las migraciones en un solo archivo (supabase/instalar.sql) para crear la base de datos
// pegándolo una sola vez en Supabase › SQL Editor, y arma supabase/actualizar.sql para las
// bases que ya se instalaron con la primera versión publicada. Uso: pnpm db:instalar
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const INSTALL_SQL_PATH = path.join(ROOT, "supabase", "instalar.sql");
export const UPDATE_SQL_PATH = path.join(ROOT, "supabase", "actualizar.sql");

// Última migración de la primera versión publicada (9 de octubre de 2026, rama main).
// actualizar.sql lleva las migraciones posteriores. Las de esa versión no se modifican:
// si hiciera falta, el cambio va en una migración nueva.
export const FIRST_RELEASE_LAST_MIGRATION = "20261005000006_reference_data.sql";
// Permisos por defecto: se agregó después, pero no depende de nada y se puede repetir.
const ALWAYS_IN_UPDATE = "20261005000000_default_privileges.sql";

const HEADER = `-- ============================================================================
-- Instalación completa de la base de datos (Supabase)
--
-- Cómo usarlo: en Supabase abrí SQL Editor › New query, pegá TODO este archivo y
-- tocá Run. Se ejecuta una sola vez, en un proyecto nuevo. Si algo falla no queda
-- nada a medias (todo va en una transacción): corregí el problema y volvé a correrlo.
--
-- Archivo generado con \`pnpm db:instalar\` a partir de supabase/migrations.
-- No lo edites a mano: cambiá las migraciones y volvé a generarlo.
-- No incluye supabase/seed.sql (datos ficticios de demostración).
-- ============================================================================
`;

const UPDATE_HEADER = `-- ============================================================================
-- Actualización de la base de datos (Supabase)
--
-- Solo para una base que ya instalaste con la primera versión de la plataforma (la
-- publicada el 9 de octubre de 2026). Agrega lo que vino después: identidad de la
-- marca, cuadernillos, ficha de ingreso, consentimiento informado y testimonios.
-- Si estás instalando de cero, no uses este archivo: usá instalar.sql.
--
-- Cómo usarlo: en Supabase abrí SQL Editor › New query, pegá TODO este archivo y
-- tocá Run. No borra pacientes, turnos ni nada de lo que cargaste: solo cambia los
-- colores y textos del inicio que seguían como venían de fábrica. Si algo falla no
-- queda nada a medias (todo va en una transacción). Si dice "already exists", la
-- base ya estaba actualizada.
--
-- Archivo generado con \`pnpm db:instalar\` a partir de supabase/migrations.
-- No lo edites a mano: cambiá las migraciones y volvé a generarlo.
-- ============================================================================
`;

// Las tablas de la primera versión solo se protegen con RLS (sus migraciones no quitan
// permisos de tabla). En los proyectos creados sin "Automatically expose new tables" esas
// tablas quedaron sin permisos y la página falla con "permission denied": acá se les da
// el mismo permiso que Supabase da por defecto. Donde ya lo tenían, no cambia nada.
const UPDATE_PRELUDE = `-- >>> Permisos de las tablas de la primera versión

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
`;

function migrationFiles(root) {
  const dir = path.join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(path.join(dir, file), "utf8").replace(/\s+$/, "") }));
}

const section = ({ file, sql }) => `-- >>> supabase/migrations/${file}\n\n${sql}\n`;

/** Devuelve el contenido de instalar.sql a partir de las migraciones, en orden. */
export function buildInstallSql(root = ROOT) {
  const parts = migrationFiles(root).map(section);
  return `${HEADER}\nbegin;\n\n${parts.join("\n")}\ncommit;\n`;
}

/** Devuelve el contenido de actualizar.sql: las migraciones posteriores a la primera versión. */
export function buildUpdateSql(root = ROOT) {
  const files = migrationFiles(root).filter(
    ({ file }) => file === ALWAYS_IN_UPDATE || file > FIRST_RELEASE_LAST_MIGRATION,
  );
  const parts = [UPDATE_PRELUDE, ...files.map(section)];
  return `${UPDATE_HEADER}\nbegin;\n\n${parts.join("\n")}\ncommit;\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(INSTALL_SQL_PATH, buildInstallSql());
  writeFileSync(UPDATE_SQL_PATH, buildUpdateSql());
  console.log(`✔ ${path.relative(ROOT, INSTALL_SQL_PATH)} y ${path.relative(ROOT, UPDATE_SQL_PATH)} actualizados`);
}
