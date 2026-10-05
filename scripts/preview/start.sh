#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# VISTA PREVIA LOCAL SIN PROYECTO SUPABASE · NO USAR EN PRODUCCIÓN
#
# Levanta la app completa con datos de demostración:
#   PostgreSQL local (migraciones + seed) → PostgREST → pasarela que emula
#   Supabase Auth/Storage (scripts/preview/gateway.mjs) → Next.js.
#
# Uso:
#   PG_SUPERUSER_URL=postgresql://postgres@localhost:5432/postgres pnpm preview:local
#
# Credenciales demo: admin@demo.local / DemoAdmin!2026 · juan.perez@demo.local / DemoPaciente!2026
# Limitaciones: no se envían emails ni WhatsApp, los archivos no se guardan y
# Google Calendar queda desconectado.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/../.."

SUPERUSER_URL="${PG_SUPERUSER_URL:-postgresql://postgres@localhost:5432/postgres}"
DB_NAME="psicologia_preview"
PG_HOST="${PREVIEW_PG_HOST:-127.0.0.1}"
PG_PORT="${PREVIEW_PG_PORT:-5432}"
POSTGREST_VERSION="v12.2.3"
WORK_DIR=".preview"
mkdir -p "$WORK_DIR"

run_sql() { psql -v ON_ERROR_STOP=1 -q -X "$1" -f "$2"; }

echo "▶ Creando la base '$DB_NAME' con migraciones y datos de demostración…"
psql -X -q "$SUPERUSER_URL" -c "drop database if exists $DB_NAME with (force);" -c "create database $DB_NAME;"
base="${SUPERUSER_URL%%\?*}"
query=""
if [[ "$SUPERUSER_URL" == *\?* ]]; then query="?${SUPERUSER_URL#*\?}"; fi
DB_URL="${base%/*}/$DB_NAME$query"
run_sql "$DB_URL" supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do run_sql "$DB_URL" "$f"; done
run_sql "$DB_URL" supabase/seed.sql
run_sql "$DB_URL" scripts/preview/setup.sql

if [[ ! -x "$WORK_DIR/postgrest" ]]; then
  echo "▶ Descargando PostgREST $POSTGREST_VERSION…"
  curl -sSL -o "$WORK_DIR/postgrest.tar.xz" "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz"
  tar -xJf "$WORK_DIR/postgrest.tar.xz" -C "$WORK_DIR"
fi

JWT_SECRET="preview-local-jwt-secret-solo-para-desarrollo-0001"
cat > "$WORK_DIR/postgrest.conf" <<EOF
db-uri = "postgresql://authenticator:preview-local@$PG_HOST:$PG_PORT/$DB_NAME"
db-schemas = "public,preview"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
EOF

eval "$(PREVIEW_JWT_SECRET="$JWT_SECRET" node scripts/preview/gateway.mjs --print-keys)"

pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

"$WORK_DIR/postgrest" "$WORK_DIR/postgrest.conf" > "$WORK_DIR/postgrest.log" 2>&1 &
pids+=($!)
PREVIEW_JWT_SECRET="$JWT_SECRET" node scripts/preview/gateway.mjs > "$WORK_DIR/gateway.log" 2>&1 &
pids+=($!)
sleep 2

export NEXT_PUBLIC_APP_URL="http://localhost:3000"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PREVIEW_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$PREVIEW_SERVICE_ROLE_KEY"
export AI_PROVIDER="rules"

echo "▶ Compilando y arrancando la app en http://localhost:3000 …"
pnpm build > "$WORK_DIR/build.log" 2>&1 || { tail -40 "$WORK_DIR/build.log"; exit 1; }
pnpm start
