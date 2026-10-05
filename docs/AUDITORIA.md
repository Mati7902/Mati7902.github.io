# Auditoría interna del MVP

Fecha: 2026-10-05 · Alcance: estado del repositorio al cierre de la Fase 7.
Cada punto indica **estado** (✅ cubierto · ⚠️ cubierto con observaciones · ⏭️ pendiente/decisión de producto) y dónde está implementado.

## Seguridad

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Autenticación con Supabase Auth, cookies httpOnly, verificación `getUser()` en servidor | ✅ | `src/lib/auth/session.ts`, `src/lib/supabase/*` |
| Alta de pacientes solo por invitación; rol tomado de `app_metadata` (no editable por el usuario) y vínculo por email verificado | ✅ | `handle_new_user` en `0003_functions_and_triggers.sql`, `admin-patients.ts` |
| Rate limiting (login, recuperación, reservas) | ✅ | `check_rate_limit` + `actions/auth.ts`, `actions/appointments.ts` |
| Anti open-redirect en `next=` | ✅ | `safeNext()` en `actions/auth.ts`, `auth/callback/route.ts` |
| Claves privadas nunca en el cliente; `service_role` solo en servidor con `server-only` | ✅ | `src/lib/supabase/admin.ts`, `src/lib/env.ts` |
| Firma HMAC de webhooks en tiempo constante + idempotencia | ✅ | `whatsapp/webhook.ts`, `api/webhooks/whatsapp/route.ts`, tests |
| Crons protegidos con `CRON_SECRET` (fallan cerrados si no está) | ✅ | `api/cron/*` |
| Tokens OAuth cifrados (AES-256-GCM) | ✅ | `src/lib/crypto.ts` |
| Headers de seguridad (HSTS, nosniff, X-Frame-Options, Referrer/Permissions-Policy) | ✅ | `next.config.ts` |
| 2FA para el administrador | ⚠️ | Infraestructura lista (Supabase MFA TOTP habilitable en el dashboard); el enrolamiento desde la UI de la app es la siguiente iteración. |
| Dependencias: sin SDKs pesados para Meta/Google/IA (fetch nativo), superficie reducida | ✅ | `package.json` |

## Row Level Security y permisos

| Punto | Estado | Evidencia |
| --- | --- | --- |
| RLS habilitado en las 30 tablas | ✅ | `0004_rls_policies.sql` |
| Paciente solo accede a sus datos (turnos, registros, materiales, notificaciones, perfil) | ✅ | tests SQL bloque 1 |
| Paciente no puede escalar rol ni editar campos administrativos (triggers `guard_*`) | ✅ | bloque 2 |
| Inserción de turnos solo vía RPC transaccional; double booking y solapamientos rechazados por exclusión GIST | ✅ | bloque 3 |
| Ventanas de cancelación/reprogramación aplicadas también en la base | ✅ | bloque 4 |
| Admin: acceso completo; notificaciones ajenas no visibles ni para admin | ✅ | bloque 5 |
| Privacidad: registros no compartidos invisibles para el profesional | ✅ | bloque 5b |
| Anónimo: solo planes, FAQs, settings públicos | ✅ | bloque 6 |
| Storage: bucket `materials` privado con política por material accesible | ✅ | `0005_storage.sql` |

Resultado: `pnpm test:db` → 46 aserciones OK sobre las migraciones reales (PostgreSQL 16 local con stub de `auth`/`storage`).

## Agenda

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Zona horaria `America/Asuncion` en cálculo, formato y jobs | ✅ | `lib/dates.ts`, `lib/scheduling/slots.ts` (12 tests) |
| Solo horarios realmente disponibles (reglas, bloqueos, turnos, Google free/busy, anticipación mínima, máximo de días) | ✅ | `services/appointments.ts › getAvailableSlots` |
| Segunda verificación antes de confirmar (app y WhatsApp) | ✅ | `assertSlotAvailable` + RPC con advisory lock |
| Modo auto / aprobación configurable | ✅ | `scheduling.booking_mode` |
| Estados e historial completos | ✅ | enum + trigger `log_appointment_history` |
| Reprogramación resetea recordatorios y re-sincroniza Google | ✅ | `reschedule_appointment_tx` |
| Vistas día/semana/mes sin información clínica | ✅ | `components/admin/agenda/*` |

## WhatsApp / chatbot

| Punto | Estado | Evidencia |
| --- | --- | --- |
| API oficial (Cloud API) únicamente; sin automatizaciones no permitidas | ✅ | `whatsapp/client.ts` |
| Pipeline: firma → validación → normalización → idempotencia → 200 → `after()` | ✅ | `api/webhooks/whatsapp/route.ts` |
| Intents estructurados; IA solo interpreta y devuelve JSON validado con Zod; fallback a reglas | ✅ | `services/ai/*` (tests) |
| Crisis detectada por reglas antes que nada; protocolo configurable y editable; derivación con aviso a admins | ✅ | `ai/crisis.ts`, `bot.ts › handleCrisis` |
| Límites: no diagnostica ni hace terapia; contenido clínico → reconducción breve | ✅ | `bot.ts › handleIntent OTHER` |
| Plantillas aprobadas para mensajes fuera de la ventana de 24 h | ⚠️ | Soportado (`sendTemplate`, campo `wa_template_name`); requiere crear y aprobar las plantillas en Meta (documentado en README §8). |
| Registro de cada mensaje con intent, confianza, estado y errores | ✅ | `whatsapp_messages`, `whatsapp_webhook_events` |
| Opt-out (`STOP`) | ✅ | `bot.ts › handlePayload` |

## Recordatorios

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Job cada 15 min, ventana configurable, horas de silencio | ✅ | `services/reminders.ts`, `vercel.json` |
| Sin duplicados: marca atómica (`update … is null`) antes de enviar; liberación si falla | ✅ | `claim()/release()` + tests |
| Resultado, `message_id` y error guardados | ✅ | `whatsapp_messages` |
| Aviso automático al modificar un turno con botones Confirmar / Solicitar otro horario | ✅ | `adminRescheduleAppointmentAction` → `appointment_changed` |

## Privacidad

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Mínimo almacenamiento: ficha administrativa, sin historia clínica; métricas de materiales solo asignado/visto/completado | ✅ | esquema |
| Logger redacta campos sensibles; no se registran contenidos clínicos | ✅ | `lib/logger.ts` |
| Eventos de Google con iniciales, sin notas | ✅ | `google-calendar/sync.ts` |
| Consentimiento versionado al aceptar la invitación; textos legales marcados como borrador hasta revisión profesional | ⚠️ | `/privacidad`, `/terminos`, `legal.reviewed_by_professional`. **Acción requerida antes de producción:** revisión por profesional competente en derecho paraguayo. |
| Control del paciente sobre compartir registros | ✅ | `share_records_with_professional` + RLS |

## UX y accesibilidad

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Una tarea por pantalla (wizards de registro, ejercicios, reserva, preparación) | ✅ | `exercise-runner.tsx`, `booking-wizard.tsx`, `emotional-log-form.tsx` |
| Estados loading / empty / success / error / offline | ✅ | `loading.tsx`, `EmptyState`, toasts, `error.tsx`, `/offline` |
| Teclado, `aria-*`, roles, foco visible, errores anunciados (`role="alert"`) | ✅ | `FormField`, componentes Radix |
| Targets ≥ 44 px, sliders grandes, botones grandes en móvil | ✅ | tokens de botón/slider |
| `prefers-reduced-motion` | ✅ | `globals.css`, `useReducedMotion` |
| Contraste AA en paleta base; aviso al cambiar colores | ✅/⚠️ | la edición libre de colores puede degradar contraste; se advierte en la UI. |
| Sin gamificación agresiva; resumen semanal neutro y desactivable | ✅ | `gamification` |

## Performance

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Landing y planes con ISR (5 min) y cliente anónimo sin cookies | ✅ | `revalidate = 300`, `createAnonClient` |
| Consultas en paralelo (`Promise.all`) en páginas de servidor; índices en columnas de filtro | ✅ | páginas admin, migraciones |
| Build de producción OK (39 rutas), Turbopack | ✅ | `pnpm build` |
| Service worker conservador (no cachea datos) | ✅ | `public/sw.js` |

## Arquitectura

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Separación servicios / acciones / componentes | ✅ | `src/server/services`, `src/server/actions` |
| Validación centralizada con Zod en cada acción y en settings | ✅ | `lib/validation.ts`, `services/settings.ts` |
| Manejo de errores consistente (`ActionResult`, `AppError`, traducción de códigos Postgres) | ✅ | `lib/errors.ts` (tests) |
| Capa de IA desacoplada del proveedor | ✅ | `services/ai/provider.ts` |
| Tipos generados desde la base | ✅ | `src/types/database.ts` |
| Preparado para nuevos roles (recepcionista, tutor, segundo profesional) | ✅ | enum `user_role`, tabla `roles`, helpers `is_staff()` |

## Verificación final

* `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ (74 tests) · `pnpm build` ✅ · `pnpm test:db` ✅ (46 aserciones)

## Pendientes recomendados antes de abrir al público

1. Revisión legal de privacidad, términos y consentimiento (Paraguay: datos personales y sensibles, salud, menores, ejercicio profesional).
2. Verificar y activar los recursos de emergencia en Configuración › Emergencia.
3. Crear y aprobar las plantillas de WhatsApp en Meta; probar el flujo completo con un número de prueba.
4. Configurar backups (PITR o dump cifrado periódico) y probar una restauración.
5. Habilitar MFA en Supabase para la cuenta del administrador.
6. Opcional: integrar Sentry (`SENTRY_DSN`) y dominio propio para emails de Supabase (SMTP).
