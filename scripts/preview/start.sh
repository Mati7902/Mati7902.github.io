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
# Variables opcionales:
#   PREVIEW_PG_HOST / PREVIEW_PG_PORT  host y puerto TCP para PostgREST (por defecto, los de
#                                      PG_SUPERUSER_URL o 127.0.0.1:5432 si es un socket).
#   PREVIEW_POSTGREST_BIN              binario de PostgREST propio (macOS, ARM, etc.).
#
# Credenciales demo: admin@demo.local / DemoAdmin!2026 · juan.perez@demo.local / DemoPaciente!2026
# Limitaciones: no se envían emails ni WhatsApp, los archivos no se guardan y
# Google Calendar queda desconectado.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/../.."

SUPERUSER_URL="${PG_SUPERUSER_URL:-postgresql://postgres@localhost:5432/postgres}"
DB_NAME="psicologia_preview"
POSTGREST_VERSION="v12.2.3"
WORK_DIR=".preview"
GATEWAY_PORT=54321
POSTGREST_PORT=3001
mkdir -p "$WORK_DIR"

fail() { echo "✖ $*" >&2; exit 1; }
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
run_sql() { psql -v ON_ERROR_STOP=1 -q -X "$@"; }

for port in "$GATEWAY_PORT" "$POSTGREST_PORT" 3000; do
  if port_in_use "$port"; then
    fail "El puerto $port ya está en uso (¿quedó corriendo 'supabase start' u otra vista previa?). Liberalo y volvé a intentar."
  fi
done

# Host y puerto TCP para PostgREST: los mismos del servidor donde se crea la base. Las URL de
# socket (postgresql:///db?host=/run/postgresql, postgres@/db, %2Frun%2F…) no sirven para el
# rol authenticator (pg_hba local suele ser peer): en ese caso se usa 127.0.0.1.
read -r URL_HOST URL_PORT < <(node -e '
  const raw = process.argv[1];
  let host = "", port = "";
  try {
    const u = new URL(raw);
    host = decodeURIComponent(u.hostname);
    port = u.port || u.searchParams.get("port") || "";
  } catch {
    const m = /^[a-z]+:\/\/(?:[^@/]*@)?([^/:?]*)(?::(\d+))?/i.exec(raw);
    host = m ? decodeURIComponent(m[1] || "") : "";
    port = (m && m[2]) || (/[?&]port=(\d+)/.exec(raw) || [])[1] || "";
  }
  if (!host || host.startsWith("/")) host = "-";
  console.log(`${host} ${port || "5432"}`);
' "$SUPERUSER_URL")
PG_HOST="${PREVIEW_PG_HOST:-$([[ "$URL_HOST" == "-" ]] && echo 127.0.0.1 || echo "$URL_HOST")}"
PG_PORT="${PREVIEW_PG_PORT:-$URL_PORT}"

# Contraseña nueva en cada ejecución para el rol de PostgREST.
AUTH_PASSWORD="$(node -e 'console.log(require("node:crypto").randomBytes(18).toString("base64url"))')"

echo "▶ Creando la base '$DB_NAME' con migraciones y datos de demostración…"
psql -X -q "$SUPERUSER_URL" -c "drop database if exists $DB_NAME with (force);" -c "create database $DB_NAME;"
base="${SUPERUSER_URL%%\?*}"
query=""
if [[ "$SUPERUSER_URL" == *\?* ]]; then query="?${SUPERUSER_URL#*\?}"; fi
DB_URL="${base%/*}/$DB_NAME$query"
run_sql "$DB_URL" -f supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do run_sql "$DB_URL" -f "$f"; done
run_sql "$DB_URL" -f supabase/seed.sql
run_sql "$DB_URL" -v authenticator_password="$AUTH_PASSWORD" -f scripts/preview/setup.sql

if [[ -n "${PREVIEW_POSTGREST_BIN:-}" ]]; then
  # Acepta una ruta o un comando del PATH (p. ej. "postgrest" instalado con Homebrew).
  POSTGREST_BIN="$(command -v "$PREVIEW_POSTGREST_BIN" || true)"
  [[ -n "$POSTGREST_BIN" && -x "$POSTGREST_BIN" ]] || fail "No se encontró el ejecutable de PostgREST indicado en PREVIEW_POSTGREST_BIN ($PREVIEW_POSTGREST_BIN)."
else
  POSTGREST_BIN="$WORK_DIR/postgrest"
fi
if [[ ! -x "$POSTGREST_BIN" ]]; then
  if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
    fail "El binario automático de PostgREST es para Linux x86_64. Instalá PostgREST $POSTGREST_VERSION y definí PREVIEW_POSTGREST_BIN."
  fi
  echo "▶ Descargando PostgREST $POSTGREST_VERSION…"
  curl -fsSL -o "$WORK_DIR/postgrest.tar.xz" "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz"
  tar -xJf "$WORK_DIR/postgrest.tar.xz" -C "$WORK_DIR"
fi

JWT_SECRET="preview-local-jwt-secret-solo-para-desarrollo-0001"
umask 077
cat > "$WORK_DIR/postgrest.conf" <<EOF
db-uri = "postgresql://authenticator:$AUTH_PASSWORD@$PG_HOST:$PG_PORT/$DB_NAME"
db-schemas = "public,preview"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $POSTGREST_PORT
EOF
umask 022
chmod 600 "$WORK_DIR/postgrest.conf" # también si el archivo ya existía de una ejecución anterior

KEYS="$(PREVIEW_JWT_SECRET="$JWT_SECRET" node scripts/preview/gateway.mjs --print-keys)"
PREVIEW_ANON_KEY="$(sed -n 's/^PREVIEW_ANON_KEY=//p' <<<"$KEYS")"
PREVIEW_SERVICE_ROLE_KEY="$(sed -n 's/^PREVIEW_SERVICE_ROLE_KEY=//p' <<<"$KEYS")"
[[ -n "$PREVIEW_ANON_KEY" && -n "$PREVIEW_SERVICE_ROLE_KEY" ]] || fail "No se pudieron generar las claves de la vista previa."

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  # El rol authenticator es de todo el servidor: al terminar deja de poder iniciar sesión.
  psql -X -q "$SUPERUSER_URL" -c "alter role authenticator nologin;" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

"$POSTGREST_BIN" "$WORK_DIR/postgrest.conf" > "$WORK_DIR/postgrest.log" 2>&1 &
pids+=($!)
PREVIEW_JWT_SECRET="$JWT_SECRET" PREVIEW_GATEWAY_PORT="$GATEWAY_PORT" PREVIEW_POSTGREST_URL="http://127.0.0.1:$POSTGREST_PORT" \
  node scripts/preview/gateway.mjs > "$WORK_DIR/gateway.log" 2>&1 &
pids+=($!)

# Espera a que PostgREST (con la base cargada) y la pasarela respondan.
ready=""
for _ in $(seq 1 60); do
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null || { tail -20 "$WORK_DIR/postgrest.log" "$WORK_DIR/gateway.log" >&2; fail "PostgREST o la pasarela se cerraron al iniciar (ver arriba)."; }
  done
  if curl -fs -o /dev/null "http://127.0.0.1:$GATEWAY_PORT/auth/v1/health" \
    && curl -fs -o /dev/null -H "Authorization: Bearer $PREVIEW_ANON_KEY" "http://127.0.0.1:$GATEWAY_PORT/rest/v1/therapy_plans?select=id&limit=1"; then
    ready=1
    break
  fi
  sleep 0.5
done
[[ -n "$ready" ]] || { tail -20 "$WORK_DIR/postgrest.log" "$WORK_DIR/gateway.log" >&2; fail "La API local no respondió a tiempo."; }

export NEXT_PUBLIC_APP_URL="http://localhost:3000"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$GATEWAY_PORT"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PREVIEW_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$PREVIEW_SERVICE_ROLE_KEY"
export AI_PROVIDER="rules"

echo "▶ Compilando y arrancando la app en http://localhost:3000 …"
echo "  (este build usa las claves de la vista previa; para tu entorno normal volvé a correr pnpm build)"
pnpm build > "$WORK_DIR/build.log" 2>&1 || { tail -40 "$WORK_DIR/build.log"; exit 1; }
pnpm start
