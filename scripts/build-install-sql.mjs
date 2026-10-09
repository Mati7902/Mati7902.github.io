// Une las migraciones en un solo archivo (supabase/instalar.sql) para crear la base de datos
// pegándolo una sola vez en Supabase › SQL Editor. Uso: pnpm db:instalar
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const INSTALL_SQL_PATH = path.join(ROOT, "supabase", "instalar.sql");

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

/** Devuelve el contenido de instalar.sql a partir de las migraciones, en orden. */
export function buildInstallSql(root = ROOT) {
  const dir = path.join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const parts = files.map((file) => {
    const sql = readFileSync(path.join(dir, file), "utf8").replace(/\s+$/, "");
    return `-- >>> supabase/migrations/${file}\n\n${sql}\n`;
  });
  return `${HEADER}\nbegin;\n\n${parts.join("\n")}\ncommit;\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(INSTALL_SQL_PATH, buildInstallSql());
  console.log(`✔ ${path.relative(ROOT, INSTALL_SQL_PATH)} actualizado`);
}
