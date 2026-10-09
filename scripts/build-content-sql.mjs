// Genera la migración con los ejercicios y materiales de los cuadernillos a partir de
// supabase/content/ejercicios/*.json (un archivo por ejercicio). Uso: pnpm db:contenido
// Los ejercicios se insertan solo si su slug no existe y los materiales solo si el
// ejercicio todavía no tiene uno: nada de lo que se edite desde el panel se pisa.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONTENT_DIR = path.join(ROOT, "supabase", "content", "ejercicios");
export const CONTENT_SQL_PATH = path.join(ROOT, "supabase", "migrations", "20261009000003_cuadernillos.sql");

/** Lee los ejercicios ordenados por colección y orden. */
export function loadContent(dir = CONTENT_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => ({ file, ...JSON.parse(readFileSync(path.join(dir, file), "utf8")) }))
    .sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug));
}

const text = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const int = (v) => (Number.isInteger(v) ? String(v) : "null");
const json = (v) => {
  const body = JSON.stringify(v, null, 1).replace(/\n\s*/g, " ");
  if (body.includes("$steps$")) throw new Error("El contenido no puede incluir $steps$");
  return `$steps$${body}$steps$::jsonb`;
};

/** Devuelve el SQL de la migración. */
export function buildContentSql(items = loadContent()) {
  const templates = items
    .map(
      (e) =>
        `  (${text(e.slug)}, ${text(e.title)}, ${text(e.description)}, ${text(e.kind)}, ${text(e.approach)}, ${text(e.audience)}, ${text(e.collection)}, ${int(e.estimated_minutes)}, ${int(e.sort_order)},\n   ${json(e.steps)})`,
    )
    .join(",\n");
  const materials = items
    .filter((e) => e.material)
    .map((e) => `  (${text(e.slug)}, ${text(e.material.title)}, ${text(e.material.description)}, ${text(e.material.category)})`)
    .join(",\n");
  const sources = [...new Set(items.map((e) => e.source?.split(",")[0]).filter(Boolean))];

  return `-- =============================================================================
-- Ejercicios y materiales de los cuadernillos del Lic. Matías Sánchez
-- (${sources.join(" · ") || "sin contenido"}).
--
-- Archivo generado con \`pnpm db:contenido\` a partir de supabase/content/ejercicios/*.json.
-- No lo edites a mano: cambiá los JSON y volvé a generarlo.
-- Solo agrega lo que falta: no pisa ejercicios ni materiales editados desde el panel.
-- =============================================================================
${
  items.length === 0
    ? "\nselect 1; -- todavía no hay ejercicios cargados\n"
    : `
insert into public.exercise_templates (slug, title, description, kind, approach, audience, collection, estimated_minutes, sort_order, steps) values
${templates}
on conflict (slug) do nothing;
${
  materials
    ? `
-- Recursos de la biblioteca de Materiales (abren el ejercicio correspondiente).
insert into public.materials (title, description, type, category_id, exercise_template_id, duration_minutes, visibility, is_published)
select v.title, v.description, 'exercise', c.id, t.id, t.estimated_minutes, 'public', true
from (values
${materials}
) as v(slug, title, description, category)
join public.exercise_templates t on t.slug = v.slug
left join public.material_categories c on c.slug = v.category
where not exists (select 1 from public.materials m where m.exercise_template_id = t.id);
`
    : ""
}`
}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(CONTENT_SQL_PATH, buildContentSql());
  console.log(`✔ ${path.relative(ROOT, CONTENT_SQL_PATH)} actualizado (${loadContent().length} ejercicios)`);
}
