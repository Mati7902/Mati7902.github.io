# Psicología Matías Sánchez

Plataforma web para la práctica psicológica del **Lic. Matías Sánchez** (Psicólogo, RP 14394-LP, Paraguay): página pública, portal privado del paciente, panel profesional, agenda con reservas, secretaria virtual por WhatsApp Business, recordatorios automáticos e integración con Google Calendar. Instalable como PWA.

> El nombre de la plataforma, la identidad profesional, precios, horarios, textos automáticos y recursos de emergencia se editan desde **Administración › Configuración**, sin tocar código.

---

## Índice

1. [Descripción y alcance](#1-descripción-y-alcance)
2. [Arquitectura](#2-arquitectura)
3. [Stack](#3-stack)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Instalación local](#5-instalación-local)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Supabase: proyecto, migraciones, seed y tipos](#7-supabase-proyecto-migraciones-seed-y-tipos)
8. [Meta WhatsApp Cloud API](#8-meta-whatsapp-cloud-api)
9. [Google Calendar](#9-google-calendar)
10. [IA del chatbot](#10-ia-del-chatbot)
11. [Deployment en Vercel](#11-deployment-en-vercel)
12. [Seguridad y privacidad](#12-seguridad-y-privacidad)
13. [Backups](#13-backups)
14. [Tests](#14-tests)
15. [Design System](#15-design-system)
16. [Troubleshooting](#16-troubleshooting)
17. [Roadmap y decisiones](#17-roadmap-y-decisiones)

---

## 1. Descripción y alcance

| Área | Qué incluye |
| --- | --- |
| **Landing pública** | Hero, sobre mí, modalidades, cómo funciona, planes (pricing cards sobrias), FAQs, solicitud de turno, acceso de pacientes, SEO (metadata, OpenGraph, JSON-LD `Psychologist`), páginas legales (borrador marcado para revisión profesional). |
| **Portal del paciente** | Inicio con próxima sesión y accesos rápidos; **Calmarme** (respiración diafragmática con animación y sonido, respiración cuadrada, grounding 5-4-3-2-1, pausa consciente); **registro emocional** con gráfico de evolución; **ejercicios** TCC (registro de pensamientos), ACT (valores, acción comprometida, defusión) y DBT (STOP, acción opuesta, TIPP, impulsos, mindfulness, DEAR MAN, PLEASE) en formato wizard; **materiales** (públicos y asignados, "recomendado para vos", visto/completado); **agenda** (solicitar, reprogramar, cancelar, confirmar asistencia, videollamada); **preparar mi sesión** 24 h antes; notificaciones; perfil y privacidad. |
| **Panel profesional** | Hoy (pacientes del día, confirmados, pendientes, cancelaciones, solicitudes por aprobar), agenda día/semana/mes con gestión completa del turno, pacientes (ficha administrativa, invitación segura, activar/desactivar, asignar materiales y ejercicios), materiales (subida a Storage privado), ejercicios, planes, WhatsApp (conversaciones, plantillas, configuración), actividad (auditoría, analytics administrativos), configuración (identidad, agenda, disponibilidad, bloqueos, Google Calendar, recordatorios, emergencia, FAQs, textos, colores, preferencias, legal). |
| **Automatizaciones** | Recordatorio 24 h antes (configurable) con botones Confirmar / Reprogramar / Cancelar, recordatorio adicional (p. ej. 2 h), aviso automático al modificar un turno, confirmación al reservar, mantenimiento diario. |
| **Secretaria virtual** | Webhook oficial de Meta con verificación de firma e idempotencia, chatbot híbrido (reglas + IA opcional) con intents estructurados, flujos de agenda seguros, detección de crisis con protocolo configurable, derivación al profesional. Nunca actúa como psicólogo. |
| **Integraciones** | Google Calendar (OAuth, eventos, free/busy, importación incremental sin bucles), capa de IA independiente del proveedor (Anthropic, OpenAI o solo reglas). |

Lo que **no** es: historia clínica electrónica, herramienta de diagnóstico, servicio de emergencia ni reemplazo de la psicoterapia. La ficha del paciente es estrictamente administrativa.

## 2. Arquitectura

```
Navegador / PWA                      Vercel (Next.js 16, App Router)                 Supabase
┌──────────────────┐   HTTPS   ┌──────────────────────────────────────────┐   ┌───────────────────────┐
│ Landing (ISR)    │ ───────▶  │ Server Components + Server Actions        │──▶│ PostgreSQL + RLS      │
│ Portal paciente  │           │  ├ src/server/services  (lógica negocio)  │   │  funciones SECURITY    │
│ Panel admin      │ ◀──────── │  ├ src/server/actions   (validación Zod)  │   │  DEFINER (reservas tx) │
│ Service worker   │           │  └ proxy.ts (sesión Supabase, guardas)    │   │ Auth (invitaciones)    │
└──────────────────┘           │ Route handlers                             │   │ Storage (privado)      │
                               │  ├ /api/webhooks/whatsapp ◀── Meta        │   └───────────────────────┘
Meta WhatsApp Cloud API ◀────▶ │  ├ /api/cron/reminders   ◀── Vercel Cron │
Google Calendar API     ◀────▶ │  ├ /api/cron/housekeeping                 │   IA (opcional, por fetch)
                               │  └ /api/integrations/google/*            │   Anthropic / OpenAI
                               └──────────────────────────────────────────┘
```

Principios:

* **La base de datos es la última línea de defensa.** Row Level Security en todas las tablas, triggers que impiden escalar privilegios y una restricción de exclusión (`tstzrange && `) que hace imposible el double booking aunque falle todo lo demás.
* **Acciones sensibles sólo en el backend.** Las reservas, reprogramaciones, cancelaciones y confirmaciones pasan por funciones transaccionales (`create_appointment_tx`, `reschedule_appointment_tx`, …) con *advisory lock*. La IA solo interpreta texto y devuelve JSON validado con Zod.
* **Mínimo privilegio.** El cliente del navegador usa la *publishable key* y RLS; el `service_role` vive únicamente en el servidor (webhooks, crons, invitaciones, cálculo de disponibilidad) y nunca devuelve datos de terceros al paciente.
* **Separación de capas.** `src/server/services/*` contiene la lógica de negocio (sin JSX); `src/server/actions/*` valida entradas y orquesta; los componentes solo presentan.

Flujo del webhook de WhatsApp:

```
META WEBHOOK → firma X-Hub-Signature-256 → Zod → normalización → idempotencia (whatsapp_webhook_events)
→ 200 inmediato → after(): crisis (reglas) → payload de botón → flujo activo → intent (IA/reglas)
→ validación → backend (disponibilidad / RPC transaccional) → respuesta Cloud API → registro
```

## 3. Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto, Tailwind CSS v4, componentes propios estilo shadcn/ui sobre Radix, Lucide, Recharts, Sonner |
| Backend | Supabase (PostgreSQL 15/16, Auth, RLS, Storage), Server Actions, Route Handlers |
| Validación | Zod 4 |
| Fechas | date-fns + date-fns-tz (`America/Asuncion`) |
| Tests | Vitest 5 + Testing Library; tests SQL de RLS contra PostgreSQL |
| Deploy | Vercel (frontend, crons) + Supabase (backend) |
| Mensajería | WhatsApp Cloud API (Graph API oficial de Meta) |
| Calendario | Google Calendar API v3 (REST) |
| IA | Capa `AIProvider` (Anthropic / OpenAI / reglas) |

## 4. Estructura del repositorio

```
.
├── src/
│   ├── app/
│   │   ├── (public)/            # landing, /planes, /privacidad, /terminos
│   │   ├── (auth)/              # /login, /recuperar, /restablecer, /bienvenida, /sin-ficha
│   │   ├── (patient)/app/       # portal del paciente (bottom nav / sidebar)
│   │   ├── (admin)/admin/       # panel profesional
│   │   ├── api/                 # webhooks, crons, integraciones, health
│   │   ├── auth/callback/       # enlaces de email de Supabase
│   │   ├── layout.tsx, manifest.ts, robots.ts, sitemap.ts, offline/
│   ├── components/
│   │   ├── ui/                  # primitivas del design system
│   │   ├── shell/               # AppShell paciente/admin, navegación, tema
│   │   ├── calm/ emotions/ exercises/ materials/ appointments/ patient/ plans/ public/ notifications/
│   │   └── admin/               # agenda, pacientes, materiales, planes, whatsapp, settings
│   ├── server/
│   │   ├── services/            # lógica de negocio (appointments, reminders, whatsapp/, ai/, google-calendar/, …)
│   │   └── actions/             # server actions con validación Zod
│   ├── lib/                     # env, supabase clients, auth/session, dates, errors, scheduling/slots, exercises/steps
│   ├── hooks/
│   ├── types/                   # database.ts (generado) y domain.ts
│   └── proxy.ts                 # refresco de sesión y protección de rutas (Next 16)
├── supabase/
│   ├── migrations/              # 0001 tipos · 0002 tablas · 0003 funciones/triggers · 0004 RLS · 0005 storage · 0006 datos de referencia
│   ├── seed.sql                 # datos de DEMOSTRACIÓN (Juan Pérez)
│   ├── tests/                   # tests SQL de RLS + stub para Postgres local
│   └── config.toml
├── scripts/                     # test-db.sh, generate-icons.mjs, create-admin.mjs
├── tests/                       # Vitest (unit + componentes)
├── public/                      # iconos PWA, sw.js, og.png
├── legacy/                      # contenido previo del repositorio (no forma parte de la app)
├── vercel.json                  # crons
└── .env.example
```

## 5. Instalación local

Requisitos: Node 20.9+ (recomendado 22), pnpm 10, cuenta de Supabase (o Supabase CLI con Docker).

```bash
pnpm install
cp .env.example .env.local        # completar al menos las variables de Supabase
pnpm dev                          # http://localhost:3000
```

Scripts:

| Comando | Descripción |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | desarrollo / build de producción / servidor |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | ESLint (flat config) · `tsc --noEmit` · Vitest |
| `pnpm check` | lint + typecheck + test + build |
| `pnpm test:db` | migraciones + seed + tests de RLS contra Postgres |
| `pnpm icons` | regenera iconos PWA y la imagen OpenGraph |
| `pnpm db:types` | regenera `src/types/database.ts` (requiere Supabase CLI) |
| `pnpm preview:local` | vista previa completa con datos ficticios, sin proyecto de Supabase (ver abajo) |

### 5.1 Vista previa sin proyecto de Supabase

Para ver la app funcionando con los datos de demostración sin crear un proyecto:

```bash
PG_SUPERUSER_URL=postgresql://postgres@localhost:5432/postgres pnpm preview:local
# http://localhost:3000 · admin@demo.local / DemoAdmin!2026 · juan.perez@demo.local / DemoPaciente!2026
```

El script crea la base `psicologia_preview` (stub de `auth`/`storage`, migraciones, seed), descarga PostgREST en `.preview/` (Linux x86_64; en otras plataformas instalalo y definí `PREVIEW_POSTGREST_BIN`), levanta una pasarela mínima que imita la API de Supabase (`scripts/preview/gateway.mjs`: inicio de sesión con contraseña, sesión y reenvío a PostgREST), espera a que respondan y compila la app contra ella. Acepta URL de socket (`postgresql:///postgres?host=/var/run/postgresql`); en ese caso PostgREST usa `127.0.0.1`. PostgREST se conecta por TCP al mismo servidor de `PG_SUPERUSER_URL` (o a `PREVIEW_PG_HOST`/`PREVIEW_PG_PORT`) con un rol `authenticator` cuya contraseña se regenera en cada ejecución (archivo `.preview/postgrest.conf` con permisos 600) y que queda sin inicio de sesión al cerrar la vista previa. Requiere PostgreSQL 15+ y los puertos 3000, 3001 y 54321 libres. **Es solo para desarrollo**: usa un secreto JWT fijo, no envía emails ni WhatsApp, no guarda archivos y deja Google Calendar desconectado. Ese build usa las claves de la vista previa: para tu entorno normal volvé a correr `pnpm build`.

## 6. Variables de entorno

Copiá `.env.example`. Nunca subas claves reales. Las variables con prefijo `NEXT_PUBLIC_` llegan al navegador; el resto solo al servidor.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | sí | URL pública (enlaces de email, OAuth, metadata) |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | no | `America/Asuncion` por defecto |
| `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sí | publishable key (o `NEXT_PUBLIC_SUPABASE_ANON_KEY` legacy) |
| `SUPABASE_SERVICE_ROLE_KEY` | sí (prod) | invitaciones, webhooks, crons, disponibilidad |
| `APP_ENCRYPTION_KEY` | para Google | 32 bytes base64 (`openssl rand -base64 32`), cifra tokens OAuth |
| `CRON_SECRET` | sí (prod) | autoriza los crons de Vercel |
| `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | para WhatsApp | credenciales de la Cloud API |
| `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` | para WhatsApp | verificación del webhook y de la firma |
| `META_GRAPH_API_VERSION` | no | `v23.0` por defecto; verificar la vigente |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | para Google | OAuth 2.0 |
| `AI_PROVIDER`, `AI_PROVIDER_API_KEY`, `AI_MODEL` | no | `rules` (por defecto), `anthropic` u `openai` |
| `LOG_LEVEL`, `SENTRY_DSN` | no | observabilidad |

## 7. Supabase: proyecto, migraciones, seed y tipos

### 7.1 Crear el proyecto

1. Creá un proyecto en [supabase.com](https://supabase.com) (región más cercana a Paraguay: `sa-east-1`).
2. **Authentication › Providers › Email**: dejá habilitado el email y **desactivá "Allow new users to sign up"** (el alta es por invitación). Activá *Confirm email* y *Secure email change*.
3. **Authentication › URL Configuration**: `Site URL = NEXT_PUBLIC_APP_URL` y agregá `https://TU-DOMINIO/auth/callback` a *Redirect URLs* (también `http://localhost:3000/auth/callback` para desarrollo).
4. **Authentication › Email Templates**: en *Invite user* y *Reset password* usá `{{ .ConfirmationURL }}` (ya apunta a `/auth/callback`). Opcional: SMTP propio para que los emails lleguen con tu dominio.
5. (Opcional) **Authentication › MFA**: habilitá TOTP para que el administrador pueda activar 2FA desde su cuenta de Supabase. *El enrolamiento desde la UI de la app queda como siguiente iteración; la infraestructura ya lo soporta.*

### 7.2 Aplicar migraciones

Con la CLI (recomendado):

```bash
npx supabase login
npx supabase link --project-ref TU_REF
npx supabase db push                 # aplica supabase/migrations/* en orden
```

Sin CLI: ejecutá los seis archivos de `supabase/migrations/` en el SQL Editor, en orden.

Las migraciones crean: extensiones (`pgcrypto`, `btree_gist`), enums, 30 tablas con UUID y `created_at/updated_at`, funciones transaccionales de agenda, triggers de historial/notificaciones/guardas, políticas RLS, buckets de Storage (`materials` privado, `avatars` y `branding` públicos) y datos de referencia (roles, configuración, categorías, planes precargados, FAQs, plantillas de mensajes, intents y 15 ejercicios).

### 7.3 Primer administrador

```bash
SUPABASE_URL=https://TU_REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO \
node scripts/create-admin.mjs --email vos@dominio.com --name "Matías Sánchez"
```

El rol se guarda en `app_metadata` (no editable por el usuario). Recibís un email para definir la contraseña.

### 7.4 Seed de demostración (solo local / staging)

`supabase/seed.sql` crea `admin@demo.local / DemoAdmin!2026` y el paciente ficticio **Juan Pérez** (`juan.perez@demo.local / DemoPaciente!2026`) con 3 turnos, 5 materiales, 4 ejercicios asignados y registros emocionales ficticios. **No ejecutar en producción.** Con Supabase CLI local se aplica automáticamente en `supabase start` / `supabase db reset`.

### 7.5 Tipos TypeScript

`src/types/database.ts` está generado desde el esquema. Tras cambiar migraciones:

```bash
npx supabase gen types typescript --project-id TU_REF --schema public > src/types/database.ts
# o local: pnpm db:types
```

### 7.6 Invitación de pacientes

Desde **Pacientes › Nuevo paciente** con "Enviar invitación" marcado (o "Enviar invitación" en la ficha). Se usa `auth.admin.inviteUserByEmail`; el trigger `handle_new_user` vincula el perfil con la ficha **por coincidencia de email verificado** (nunca por IDs enviados desde el cliente). El paciente define su contraseña y acepta el consentimiento en `/bienvenida`.

## 8. Meta WhatsApp Cloud API

> Verificá siempre la documentación vigente en [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api). Las versiones de Graph API, los límites de botones y las políticas de plantillas cambian.

1. **Meta for Developers**: creá una app de tipo *Business*, agregá el producto **WhatsApp** y vinculá (o creá) una cuenta de WhatsApp Business (WABA) con un número verificado.
2. Anotá `Phone Number ID`, `WhatsApp Business Account ID` y creá un **System User** con un token permanente (permisos `whatsapp_business_messaging`, `whatsapp_business_management`). Van a `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID` y `META_WHATSAPP_TOKEN`.
3. En **App Settings › Basic** copiá el **App Secret** → `META_APP_SECRET`. Definí un `META_WEBHOOK_VERIFY_TOKEN` arbitrario.
4. **WhatsApp › Configuration › Webhook**: URL `https://TU-DOMINIO/api/webhooks/whatsapp`, *Verify token* = `META_WEBHOOK_VERIFY_TOKEN`. Suscribí el campo `messages`.
5. **Plantillas**: fuera de la ventana de atención de 24 h (contada desde el último mensaje del paciente, con 15 min de margen) Meta solo acepta plantillas aprobadas. Si un aviso cae fuera de la ventana y no tiene plantilla cargada, **no se envía**: queda registrado como error y el panel muestra una advertencia. Creá en WhatsApp Manager estas plantillas (categoría *Utility*), con los parámetros en el mismo orden que las variables de **Admin › WhatsApp › Plantillas**, y cargá el nombre aprobado en "nombre de plantilla":

   | Clave interna | Plantilla sugerida | Parámetros | Botones de respuesta rápida (payload) |
   | --- | --- | --- | --- |
   | `booking_registered` | `turno_registrado` | nombre, fecha, hora, modalidad | Confirmar (`CONFIRM:<id>`), Reprogramar (`RESCHEDULE:<id>`) |
   | `booking_requested` | `solicitud_recibida` | nombre, fecha, hora | — |
   | `request_approved` | `turno_aprobado` | nombre, fecha, hora, modalidad | Confirmar, Reprogramar |
   | `reminder_24h` | `recordatorio_sesion_24h` | nombre, profesional, hora | Confirmar, Reprogramar, Cancelar (`CANCEL:<id>`) |
   | `reminder_2h` | `recordatorio_sesion_2h` | nombre, profesional, hora, acceso | — |
   | `appointment_changed` | `cambio_de_turno` | nombre, profesional, fecha, hora | Confirmar, Reprogramar, Cancelar |
   | `cancellation_done` | `turno_cancelado` | nombre, fecha, hora | — |

   Los recordatorios usan siempre la plantilla aprobada cuando está cargada, aunque la ventana esté abierta.
6. Activá la secretaria en **Admin › WhatsApp › Configuración**.

Derivación al profesional: cuando el contacto pide hablar con una persona (o ante una señal de crisis) la conversación queda **derivada** y la asistente deja de ofrecer menús; el contacto puede volver al menú con un botón, la derivación expira sola a las 24 h y el profesional puede reactivar la asistente desde **Admin › WhatsApp** ("Reactivar asistente"). En una derivación común, tocar un botón de un turno (confirmar, cancelar, reprogramar desde un recordatorio) retoma la conversación con la asistente; en una derivación por crisis solo se aceptan confirmar o cancelar (los cambios de horario los coordina el profesional) y el botón "Avisar al psicólogo" siempre recibe respuesta. Los horarios ofrecidos se identifican por su fecha y hora (no por su posición en la lista), derivar descarta la lista vigente y una pregunta de cancelación pendiente vence a los 30 minutos. **Un mensaje escrito nunca cancela un turno**: la cancelación se ejecuta solo con el botón "Sí, cancelar". Si la respuesta escrita a "¿Querés cancelar…?" suena a cancelar, la asistente muestra los botones para confirmarlo; si suena a mantener, lo mantiene; una pregunta sobre la política recibe la información. Esa respuesta escrita solo se interpreta si la pregunta es el último mensaje enviado, y un "sí" escrito a "¿Le aviso al profesional?" equivale a tocar ese botón. Los avisos al profesional se deduplican por conversación (no más de uno cada 10 minutos por el mismo motivo). Los números se vinculan a una ficha por `whatsapp_phone` (o `phone` si aquel está vacío); si hay ambigüedad, el bot no identifica a nadie. El número de WhatsApp de la ficha solo lo cambia el profesional.

Comportamiento: intents `BOOK_APPOINTMENT`, `RESCHEDULE_APPOINTMENT`, `CANCEL_APPOINTMENT`, `CONFIRM_APPOINTMENT`, `CHECK_AVAILABILITY`, `PRICING`, `PLANS`, `LOCATION`, `ONLINE_SESSION`, `LOGIN_HELP`, `SPEAK_TO_HUMAN`, `OTHER` (más `GREETING`/`THANKS`). Las reservas se confirman sólo tras una **segunda verificación** de disponibilidad y la RPC transaccional. Ante señales de crisis responde con el protocolo de emergencia configurado (recursos verificados por el profesional) y deriva; nunca hace psicoterapia. Los contactos pueden optar por no recibir mensajes (`STOP`).

## 9. Google Calendar

1. En Google Cloud Console creá un proyecto, habilitá **Google Calendar API** y configurá la pantalla de consentimiento OAuth (tipo *External*, en producción agregá tu cuenta como usuario de prueba mientras no esté verificada).
2. Credenciales → **OAuth client ID (Web application)**: URI de redirección `https://TU-DOMINIO/api/integrations/google/callback`. Copiá `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
3. Generá `APP_ENCRYPTION_KEY` (`openssl rand -base64 32`): los tokens se guardan cifrados con AES-256-GCM.
4. En **Admin › Configuración › Agenda › Integraciones** hacé clic en *Conectar Google Calendar*.

Scopes solicitados (mínimo privilegio): `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.freebusy`, `openid`, `email`.

Sincronización:

* **App → Google**: al crear, modificar, confirmar o cancelar un turno se crea/actualiza/elimina el evento (`google_event_id`). Por privacidad el evento solo lleva iniciales del paciente y modalidad.
* **Google → App**: `freeBusy` se consulta al calcular disponibilidad (los eventos externos no se ofrecen). El cron diario (o "Sincronizar ahora") importa cambios con `syncToken` como bloqueos `exception` con motivo `google:<eventId>`.
* **Sin bucles**: los eventos creados por la app llevan `extendedProperties.private.psms_origin = "app"` y se ignoran al importar. Cada operación queda en `calendar_sync_log`.

Pendiente de evolución: creación automática de enlaces Google Meet (requiere `conferenceData` y el scope `calendar.events`; el modelo de datos ya guarda `video_link`).

## 10. IA del chatbot

`src/server/services/ai/provider.ts` define la interfaz `AIProvider` y el esquema Zod de salida:

```json
{ "intent": "CHECK_AVAILABILITY", "confidence": 0.96, "requested_date": "2026-10-13", "time_preference": "afternoon", "modality": null, "clinical_content": false, "crisis_signal": false }
```

* `AI_PROVIDER=rules` (por defecto): clasificador por palabras clave y fechas relativas en español; no requiere claves.
* `AI_PROVIDER=anthropic` (`AI_MODEL=claude-haiku-4-5-20251001`) u `openai`: el modelo solo interpreta; si falla o devuelve JSON inválido, se degrada a reglas. La detección de crisis por reglas siempre tiene prioridad.
* El backend valida cada resultado, consulta la base y ejecuta; el modelo nunca llama acciones.

## 11. Deployment en Vercel

1. Importá el repositorio en Vercel (framework Next.js, Node 22). Región sugerida: `gru1` (São Paulo), ya definida en `vercel.json`.
2. Cargá todas las variables de entorno de producción (ver §6). Generá `CRON_SECRET` (`openssl rand -hex 32`).
3. Los crons de `vercel.json` quedan activos automáticamente: `/api/cron/reminders` cada 15 min y `/api/cron/housekeeping` diario a las 04:00 UTC. Vercel envía `Authorization: Bearer $CRON_SECRET`.
4. Dominio propio → actualizá `NEXT_PUBLIC_APP_URL`, la *Site URL*/Redirect URLs de Supabase, la URI de Google y el webhook de Meta.
5. Verificá `GET /api/health`.
6. PWA: en producción se registra `public/sw.js` (navegación *network-first* con página `/offline`; nunca cachea API ni datos). En iPhone: Safari › Compartir › *Agregar a pantalla de inicio*; en Android: *Instalar app*.

Checklist antes de abrir al público: textos legales revisados y marcados como revisados en **Configuración › Preferencias**; recursos de emergencia verificados y activados; `booking_mode`, horarios y precios confirmados; plantillas de WhatsApp aprobadas; backups configurados (§13).

## 12. Seguridad y privacidad

* **Autenticación**: Supabase Auth, cookies `httpOnly` gestionadas por `@supabase/ssr`, verificación con `getUser()` en el servidor, "mantener sesión" opcional (cookies de sesión), rate limiting en login/recuperación/reservas (`check_rate_limit`), sin enumeración de usuarios en "olvidé mi contraseña".
* **RBAC + RLS**: roles `admin`, `professional`, `receptionist`, `guardian`, `patient` (preparados para crecer). Un paciente solo ve y escribe sus propios datos; triggers impiden cambiar rol, estado administrativo o campos ajenos aunque el frontend falle. 86 aserciones SQL lo verifican (`pnpm test:db`).
* **Modelo de privilegios en la base**: `is_privileged()` es verdadero solo para conexiones directas sin JWT (migraciones, seed, cron interno), para `service_role` y para administradores; una petición anónima de la API **no** es privilegiada. Se revoca `EXECUTE` de todas las funciones a `public`/`anon`/`authenticated` y se otorga explícitamente lo necesario (p. ej. `check_rate_limit` y `cleanup_rate_limits` solo a `service_role`). También se quita el `EXECUTE` por defecto para `PUBLIC` en funciones futuras: **toda función nueva en una migración necesita su `grant execute` explícito**. Las RPC de agenda validan, para pacientes, que el horario pertenezca a la grilla publicada (`is_bookable_slot`), la anticipación mínima y el máximo de días; el estado inicial lo decide la base según `booking_mode`.
* **Notas administrativas**: viven en tablas separadas (`patient_admin_notes`, `appointment_admin_notes`) con RLS solo para administradores, de modo que nunca viajan en las consultas que hace el paciente sobre su ficha o sus turnos.
* **Consentimiento versionado**: si cambia `legal.consent_version`, el paciente debe aceptar de nuevo los textos en `/consentimiento` (donde también puede cerrar sesión) antes de seguir. Lo exigen tanto las páginas (`requirePatient`) como las acciones del servidor (`assertPatient`).
* **Accesos cruzados**: la disponibilidad se calcula en el servidor con `service_role` y devuelve únicamente horarios libres; las notificaciones son por usuario; los registros emocionales/ejercicios se comparten con el profesional solo si el paciente lo permite (`share_records_with_professional`).
* **Datos sensibles**: no se registran contenidos clínicos en logs (redacción automática en el logger); los eventos de Google solo llevan iniciales; los tokens OAuth van cifrados; el bucket de materiales es privado (URLs firmadas de 15 min).
* **Webhooks**: firma HMAC en tiempo constante, idempotencia por `wa_message_id`, procesamiento diferido. La tabla de idempotencia guarda solo metadatos (no el texto) y se purga a los 30 días (`/api/cron/housekeeping`).
* **IA opcional**: si se activa un proveedor de IA, recibe el mensaje entrante y los últimos mensajes de esa conversación de WhatsApp (nunca registros de la app) para clasificar el trámite; nunca ejecuta acciones y su salida se valida con Zod. La política de privacidad lo informa.
* **Headers**: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
* **Auditoría**: acciones críticas en `audit_logs` (inicios de sesión, cambios de turno, invitaciones, configuración, integraciones).
* **Legal**: `/privacidad`, `/terminos` y el consentimiento en `/bienvenida` son **borradores** que deben revisarse con un profesional competente en derecho paraguayo (protección de datos personales y sensibles, información sanitaria, consentimiento informado, menores, ejercicio profesional de la psicología) antes de producción. La app muestra un aviso hasta que se marque como revisado.

## 13. Backups

* Supabase realiza **backups diarios automáticos** en planes pagos (Pro: 7 días; PITR opcional). Activá PITR si el presupuesto lo permite.
* Backup lógico propio, por ejemplo semanal, desde una máquina de confianza:

  ```bash
  supabase db dump --db-url "$SUPABASE_DB_URL" -f backup-$(date +%F).sql --data-only
  # o pg_dump -Fc "$SUPABASE_DB_URL" > backup-$(date +%F).dump
  ```

  Guardalo cifrado (p. ej. `age`/`gpg`) en un almacenamiento distinto al de Supabase. Nunca dependas de una única copia.
* Storage: los archivos de `materials` no están incluidos en el dump SQL; copialos periódicamente con la CLI (`supabase storage cp -r ss:///materials ./backup-materials`).
* Probá la restauración en un proyecto de staging al menos una vez por trimestre.

## 14. Tests

```bash
pnpm test        # Vitest: 163 tests (motor de slots, reglas de agenda, clasificador, crisis,
                 # firma/normalización de webhook, deduplicación de recordatorios, plantillas,
                 # ventana de 24 h, redirecciones seguras, utilidades, esquemas de ejercicios,
                 # errores y componentes)
pnpm test:db     # Migraciones + seed + 86 aserciones de RLS/permisos/grilla/double booking
```

`pnpm test:db` funciona de dos formas:

* **Supabase local** (`supabase start`): `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db`
* **PostgreSQL local sin Docker**: `PG_SUPERUSER_URL=postgresql://postgres@localhost:5432/postgres pnpm test:db` (crea la base `psicologia_test` con un stub mínimo de `auth`/`storage`).

Qué cubren los tests SQL: aislamiento entre pacientes, imposibilidad de escalar rol o editar campos administrativos, reserva solo vía RPC y solo en horarios de la grilla publicada, double booking y solapamientos rechazados, bloqueos respetados, ventanas de cancelación y reprogramación, notificaciones automáticas, privacidad de registros no compartidos y de notas administrativas, RPC inaccesibles para `anon`, acceso anónimo limitado a contenido público y rate limiting.

## 15. Design System

Paleta (editable en **Configuración › Apariencia**):

| Token | HEX | Uso |
| --- | --- | --- |
| Azul petróleo (principal) | `#1F4E5F` | botones, enlaces, acentos de marca (escala `petrol-50…900`) |
| Off-white cálido (fondo) | `#FAF8F5` | fondo general; superficies `#FFFFFF` y `#F3F0EB` |
| Verde menta (acento) | `#A8DCCB` | estados positivos, Calmarme (escala `mint-50…700`, texto `#3E8E7A`) |
| Grises cálidos | `#1E2A2F` texto · `#5B6B70` secundario · `#8A979B` sutil · `#E6E2DC` bordes · `#EDE9E3` divisores |
| Semánticos | éxito `#3E8E7A` · aviso `#D9A441` · error `#C8554D` · info `#3A7CA5` |

Tipografía: **Fraunces** (títulos, ejes ópticos) + **Inter** (contenido y formularios). Radios de 16 px, sombras muy sutiles, transiciones de 200 ms, respeto de `prefers-reduced-motion`, targets táctiles ≥ 44 px, foco visible, contraste AA. Mobile-first: bottom navigation en el portal del paciente, sidebar en escritorio.

## 16. Troubleshooting

| Síntoma | Causa probable / solución |
| --- | --- |
| `Variables de entorno inválidas` al iniciar | Falta `NEXT_PUBLIC_SUPABASE_URL` o la clave publishable. Revisá `.env.local`. |
| Login correcto pero redirige a `/sin-ficha` | El usuario no tiene ficha de paciente con ese email. Creala en Pacientes (el trigger vincula por email) o reenviá la invitación. |
| El paciente invitado cae en "enlace inválido" | La *Redirect URL* `/auth/callback` no está autorizada en Supabase o el enlace expiró (reenviar). |
| "No se puede reservar" aunque el horario se ve libre | Otro turno/bloqueo se solapa, o la anticipación mínima lo excluye. Revisá Agenda y Configuración › Agenda. |
| Recordatorios no salen | `CRON_SECRET` ausente, cron no desplegado, `reminders.enabled=false`, WhatsApp desactivado o sin plantilla aprobada (fuera de la ventana de 24 h Meta rechaza texto libre). Revisá Actividad › Webhooks y `whatsapp_messages.error`. |
| Webhook responde 401 | Firma inválida: `META_APP_SECRET` incorrecto o un proxy modifica el cuerpo. 503: falta el secreto. |
| Google: "estado-invalido" | Cookie de estado expirada (10 min) o dominio distinto entre inicio y callback. Repetí la conexión. |
| Build falla con `Slot failed to slot` | Un `<Button asChild>` recibió más de un hijo. Debe envolver un único elemento. |
| `pnpm test:db`: "Peer authentication failed" | Usá una URL con usuario/contraseña (`postgresql://user:pass@127.0.0.1:5432/postgres`) o ejecutá como el usuario del sistema `postgres`. |

## 17. Roadmap y decisiones

Decisiones tomadas (documentadas para no re-discutirlas):

* **Modo de reserva** inicial: *aprobación profesional* (`booking_mode=approval`); se cambia en Configuración.
* **Estados**: `requested` (solicitado por el paciente), `pending` (agendado, falta confirmar asistencia), `confirmed`, `rescheduled` (cambió el horario, falta re-confirmar), `cancelled`, `completed`, `no_show`. Historial en `appointment_history`.
* **Recordatorio de 24 h** se envía a `pending`, `confirmed` y `rescheduled` (los que necesitan confirmación o aviso), marcando `reminder_24h_sent_at` de forma atómica antes de enviar.
* **Registros personales**: visibles para el profesional solo si el paciente lo permite (por defecto sí, revocable).
* **Recursos de emergencia**: precargados **inactivos** con la indicación de verificar antes de activar; nada hardcodeado en la UI.
* **Legacy**: el contenido previo del repositorio se preservó en `legacy/`.

Próximos pasos sugeridos: enrolamiento de 2FA desde la UI, creación automática de Google Meet, rol recepcionista/tutor con pantallas propias, exportación de datos a pedido del paciente, integración de Sentry, pagos en línea si la práctica lo requiere.

---

Hecho con cuidado para una práctica de salud mental: cada pantalla intenta responder en menos de cinco segundos “¿qué tengo que hacer ahora?”.
