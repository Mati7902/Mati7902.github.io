#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Aplica las migraciones y ejecuta los tests SQL de RLS contra una base local.
#
# Modo 1 (recomendado): Supabase CLI
#   supabase start && SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
#
# Modo 2: PostgreSQL local "pelado" (sin Supabase). El script crea un stub mínimo
#   del esquema auth/storage para poder validar migraciones y políticas.
#   PG_SUPERUSER_URL=postgresql://postgres@localhost:5432/postgres pnpm test:db
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SUPABASE_DB_URL:-}"
SUPERUSER_URL="${PG_SUPERUSER_URL:-}"
DB_NAME="psicologia_test"

if [[ -z "$DB_URL" && -z "$SUPERUSER_URL" ]]; then
  echo "Definí SUPABASE_DB_URL (Supabase local) o PG_SUPERUSER_URL (Postgres local)." >&2
  exit 1
fi

run_sql() { psql -v ON_ERROR_STOP=1 -q -X "$1" -f "$2"; }

if [[ -n "$SUPERUSER_URL" ]]; then
  echo "▶ Preparando base de pruebas '$DB_NAME' en Postgres local…"
  psql -X -q "$SUPERUSER_URL" -c "drop database if exists $DB_NAME;" -c "create database $DB_NAME;"
  base="${SUPERUSER_URL%%\?*}"
  query=""
  if [[ "$SUPERUSER_URL" == *\?* ]]; then query="?${SUPERUSER_URL#*\?}"; fi
  DB_URL="${base%/*}/$DB_NAME$query"
  run_sql "$DB_URL" supabase/tests/_supabase_stub.sql
fi

echo "▶ Aplicando migraciones…"
for f in supabase/migrations/*.sql; do
  echo "   · $f"
  run_sql "$DB_URL" "$f"
done

echo "▶ Aplicando seed de demostración…"
run_sql "$DB_URL" supabase/seed.sql

echo "▶ Ejecutando tests de RLS…"
for f in supabase/tests/*.test.sql; do
  echo "   · $f"
  run_sql "$DB_URL" "$f"
done

echo "✔ Migraciones, seed y tests de RLS OK"
