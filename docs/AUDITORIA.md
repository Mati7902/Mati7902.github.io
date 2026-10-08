# Auditoría interna del MVP

Fecha: 2026-10-05 · Alcance: estado del repositorio al cierre de la Fase 7.
Cada punto indica **estado** (✅ cubierto · ⚠️ cubierto con observaciones · ⏭️ pendiente/decisión de producto) y dónde está implementado.

## Seguridad

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Autenticación con Supabase Auth, cookies httpOnly, verificación `getUser()` en servidor | ✅ | `src/lib/auth/session.ts`, `src/lib/supabase/*` |
| Alta de pacientes solo por invitación; rol tomado de `app_metadata` (no editable por el usuario) y vínculo por email verificado | ✅ | `handle_new_user` en `0003_functions_and_triggers.sql`, `admin-patients.ts` |
| Rate limiting (login, recuperación, reservas) | ✅ | `check_rate_limit` + `actions/auth.ts`, `actions/appointments.ts` |
| Anti open-redirect en `next=` (incluye `/\host`, caracteres de control y URLs absolutas) | ✅ | `src/lib/safe-redirect.ts`, tests `safe-redirect.test.ts` |
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

Resultado: `pnpm test:db` → 89 aserciones OK sobre las migraciones reales (PostgreSQL 16 local con stub de `auth`/`storage`).

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
| Job cada 15 min, ventana configurable, horas de silencio | ✅ | `services/reminders.ts`, `.github/workflows/recordatorios.yml` |
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

* `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ (263 tests) · `pnpm test:bot` ✅ (33 recorridos) · `pnpm build` ✅ · `pnpm test:db` ✅ (89 aserciones)

## Segunda ronda de auditoría (revisión adversarial)

Una revisión adversarial posterior encontró problemas reales que ya están corregidos y cubiertos por tests:

| Hallazgo | Severidad | Corrección |
| --- | --- | --- |
| `is_privileged()` consideraba privilegiada a cualquier petición sin `auth.uid()`, incluida la API anónima: un visitante podía confirmar, cancelar o crear turnos por RPC | Crítica | Solo son privilegiadas las conexiones sin JWT, `service_role` y administradores; `EXECUTE` revocado a `public`/`anon`/`authenticated` y otorgado explícitamente. Tests "anon no puede…" |
| `check_rate_limit` invocable por usuarios con claves arbitrarias (bloqueo del login de otra cuenta) | Alta | Solo `service_role` (`allowAttempt` en `services/rate-limit.ts`) |
| Un paciente podía reservar por RPC fuera de la grilla publicada, con duración arbitraria o elegir el estado inicial | Alta | `is_bookable_slot` + `assert_patient_bookable` en SQL; el fin del turno lo decide el servidor; estado según `booking_mode` |
| Reprogramación del paciente bloqueada por su propio trigger de guarda | Media | Bandera transaccional `app.trusted_rpc` solo dentro de la RPC |
| Notas administrativas legibles por el paciente (columnas en sus filas) | Alta | Tablas `patient_admin_notes` / `appointment_admin_notes` solo admin |
| `audit_log` aceptaba actor anónimo y tamaños ilimitados | Media | Actor obligatorio y límites de tamaño |
| El paciente podía cambiar su `whatsapp_phone` y suplantar a otro ante el bot; identificación por teléfono no determinística | Alta | Campo solo editable por el profesional; búsqueda determinística que descarta ambigüedades |
| Conversaciones derivadas sin salida (bot mudo indefinidamente) | Media | Expiración a 24 h, botón "Volver al menú", reenvío del protocolo ante crisis y "Reactivar asistente" en el panel |
| Avisos fuera de la ventana de 24 h enviados como texto libre (Meta los rechaza) | Media | Plantilla obligatoria fuera de la ventana; si falta, se informa en el panel |
| Webhooks guardaban el payload completo (texto del paciente) sin retención | Media | Solo metadatos y purga a 30 días |
| Agenda: turnos fuera del horario habitual invisibles en vistas día/semana; contador de cancelaciones siempre 0 | Baja | Rango de horas dinámico; uso de `count` |
| Asistente de reserva: cambio de modalidad conservaba un horario de otra grilla | Baja | Se limpia la selección y se recarga ante conflicto o validación |
| Accesibilidad: texto secundario con contraste 2,8:1, lector de pantalla saturado por la cuenta regresiva, áreas táctiles de 36 px, escala sin tocar bloqueaba "Continuar" | Media | Contraste ≥ 4,5:1, `aria-live` solo en el cambio de fase, objetivos de 44 px, escala con valor medio por defecto |
| Privacidad: la política no mencionaba el proveedor de IA opcional ni Google Calendar; sin re-consentimiento al cambiar la versión legal | Media | Texto actualizado (pendiente de revisión profesional) y página `/consentimiento` |
| Logs con `details` de Postgres (pueden incluir valores de filas) | Baja | `errorMeta` ya no los registra |

## Tercera ronda (revisión de las correcciones)

Revisión adversarial de las dos rondas anteriores: cuatro revisores por área (base de datos, servidor, interfaz, flujos) y dos verificadores independientes por hallazgo. Se corrigieron los 12 confirmados por ambos verificadores y los de veredicto dividido con impacto real:

| Hallazgo | Severidad | Corrección |
| --- | --- | --- |
| `safeInternalPath` devolvía `//evil.com` para `/..//evil.com` (la normalización de la URL resuelve los puntos): open redirect después del login | Alta | Se valida la ruta ya normalizada; tests con segmentos `.`/`..` literales y codificados |
| El botón "Avisar al psicólogo" del mensaje de crisis no tenía respuesta ni aviso | Alta | En conversaciones derivadas, un pedido explícito de hablar con el profesional siempre se confirma y notifica |
| Los horarios de WhatsApp se identificaban por posición: tocar una lista vieja reservaba otro horario | Media | Id derivado de la fecha y hora (`SLOT:20261007T2100`) y verificación contra la lista vigente |
| "Ver horarios" → modalidad pedía identificarse a quien no es paciente y perdía el día pedido | Media | El botón de modalidad continúa el flujo activo |
| Con una cancelación pendiente, "confirmo que voy" cancelaba y "No voy a poder ir" mantenía el turno; la pregunta no vencía | Media | Reglas puras con tests (`answers.ts`), confirmar asistencia nunca cancela, vencimiento a 30 min |
| Conversaciones derivadas ignoraban los botones de recordatorios (confirmar/cancelar) | Media | Esos botones se procesan aunque la conversación esté derivada |
| Reprogramación por WhatsApp sin volver a validar estado y ventana del turno | Media | Se recarga el turno y se aplica `canPatientModify` antes de moverlo |
| Una crisis ya atendida marcaba como crisis toda derivación posterior | Baja | Solo es crisis si la señal es de la derivación vigente (mismo instante) |
| El panel "Hoy" cargaba solicitudes sin notas: guardar detalles desde ahí borraba la nota | Alta | Misma selección que la agenda y el formulario no borra notas que no cargó |
| La política de privacidad decía que la IA no recibe historial (recibe los últimos mensajes) | Media | Texto corregido (pendiente de revisión profesional) |
| En `/consentimiento` no se podía cerrar sesión | Media | Botón para salir; el consentimiento se exige también en páginas y acciones |
| Reprogramar desde la app pedía al paciente confirmar su propio cambio y no avisaba al profesional | Baja | Aviso neutro al paciente y notificación al profesional (tests SQL) |
| El `revoke` de privilegios por defecto para `PUBLIC` por esquema no tenía efecto | Baja | Forma global del `alter default privileges`; test que crea una función y verifica que `anon` no puede ejecutarla |
| Reglas de negocio (P0001) llegaban como error de validación: el asistente de reserva reintentaba sin fin | Baja | Se informan como "no permitido" y el asistente vuelve a la agenda |
| Vista semanal en móvil sin nombres; solicitudes del panel sin fecha | Baja | Nombre oculto solo en la vista mensual; fecha visible |
| Vista previa local: puerto fijo, sin verificación de arranque, rol con clave fija, refresco de sesión sin margen | Baja | Host/puerto de `PG_SUPERUSER_URL`, espera activa, clave por ejecución y acceso solo a la base de vista previa, ventana de reutilización de 10 s |

## Cuarta ronda (revisión de la tercera)

Una nueva revisión adversarial de la tercera ronda encontró regresiones en las propias correcciones, ya resueltas:

| Hallazgo | Severidad | Corrección |
| --- | --- | --- |
| Un "Sí" escrito a "¿Querés cancelar?" confirmaba asistencia (el clasificador etiqueta "sí" como confirmación) | Alta | La respuesta se interpreta por el texto; tests con la intención real del clasificador por reglas |
| "No voy a cancelar" o "no quiero cancelarla" cancelaban; "No voy a ir" confirmaba | Alta | Negación del verbo cancelar, "no puedo/voy a ir" como cancelación y dudas ("no sé si…") que vuelven a preguntar |
| Tras derivar en medio de una reprogramación, tocar la lista vieja creaba un segundo turno | Alta | Derivar descarta la lista y un horario solo se reserva con un flujo activo |
| En derivaciones, los botones posteriores (por ejemplo "Pedir otro turno") quedaban sin respuesta | Media | Derivación común: los botones de turno retoman la conversación; crisis: solo confirmar/cancelar, el resto recibe acuse inmediato |
| El botón de modalidad podía reservar una modalidad deshabilitada | Baja | Se valida contra las modalidades habilitadas y el menú solo muestra esas |
| Toques repetidos de "Avisar al psicólogo" notificaban cada vez | Baja | Una notificación cada 10 minutos por esa vía; la persona siempre recibe respuesta |
| `/app/notificaciones` no exigía el consentimiento vigente | Baja | Usa `requirePatient` |
| Vista previa: URL de socket rechazadas, archivo de configuración legible por otros usuarios, binario de PostgREST del PATH no aceptado, rol activo después de cerrar | Baja | Parser tolerante, permisos 600, `command -v` y rol sin inicio de sesión al salir |

## Quinta ronda (diseño seguro de la cancelación por texto)

La revisión de la cuarta ronda confirmó 16 hallazgos. Ocho venían de la misma causa: inferir la intención de un texto libre antes de cancelar es frágil ("No, voy a ir" pierde la coma al normalizarse y se lee "No voy a ir"; "llego tarde", "si no puedo ir te aviso" o "te confirmo mañana" se malinterpretaban). Se cambió el diseño en lugar de seguir afinando expresiones regulares:

| Cambio | Efecto |
| --- | --- |
| El texto nunca cancela ni confirma por sí solo | Si suena a cancelar, se muestran los botones "Sí, cancelar / No, mantener"; solo el botón ejecuta la acción. Mantener sí se acepta por texto porque no cambia nada |
| La respuesta escrita solo cuenta si la pregunta de cancelación es el último mensaje enviado (y tiene menos de 30 min) | Un "ok, gracias" posterior a otro mensaje ya no se toma como respuesta a una pregunta vieja |
| "Sí" escrito a "¿Le aviso al profesional?" ejecuta ese botón | Antes se interpretaba como confirmar asistencia |
| Avisos al profesional deduplicados por conversación y motivo, con el registro real de notificaciones | Un acuse sin aviso ya no silencia un pedido explícito ni los mensajes escritos posteriores |
| "Otros días", "Ver horarios" y listas viejas respetan la reprogramación en curso | Ya no se crea un segundo turno en lugar de mover el existente |
| Una fecha de una lista vieja sin flujo activo inicia una reserva para ese día | Antes ofrecía horarios que después rechazaba |

## Sexta ronda (revisión de la quinta)

La revisión de la quinta ronda encontró 11 hallazgos más en el chatbot. Se corrigieron todos y, para no depender solo de pruebas de funciones sueltas, se agregó `pnpm test:bot`: recorridos de conversación completos contra la base de la vista previa local.

| Hallazgo | Corrección |
| --- | --- |
| Un "sí" o "confirmo" escrito confirmaba el próximo turno aunque respondiera a otra cosa (por ejemplo, a una pregunta de cancelación ya vencida) | Un "sí" suelto confirma solo si lo último enviado fue un recordatorio o pedido de confirmación de ese turno (24 h). En otro caso se muestra el turno con el botón "Confirmar asistencia" |
| Respuestas como "Estoy apurado, cancelala" o "Me equivoqué de día, cancelala" se leían como "mantener" | Las señales de cancelar o de no asistir se evalúan antes que las de mantener, por cláusula ("No, voy a ir" mantiene; "No, ya no voy a ir" pide los botones) |
| En una derivación por crisis, un "sí" escrito a "¿Le aviso?" respondía "Ya le avisé" sin avisar | El "sí" escrito equivale al botón también en derivaciones, y el mensaje de crisis acepta un "sí" a "Avisar al psicólogo". El aviso al profesional indica el motivo (cancelación, cambio, sin horarios) |
| "¿Le aviso?" ante falta de horarios borraba la reprogramación en curso | Esas preguntas conservan el flujo |
| Un toque en una lista de días vieja podía crear un segundo turno en lugar de mover el existente | Sin un flujo activo, si el paciente tiene una sesión próxima, se pregunta "¿Sesión nueva o cambiar esa?" |
| "Ver horarios" del menú continuaba una reprogramación abandonada | Siempre es una consulta nueva; un flujo sin actividad por 2 horas se descarta |
| Los recordatorios no contaban como "último mensaje" y la respuesta automática a audios sí | Se mira el último mensaje enviado al contacto (incluidos los avisos del sistema), sin contar la respuesta a audios ni los envíos fallidos |
| El primer mensaje después de derivar recibía un acuse duplicado | El mensaje de derivación y el de crisis cuentan como acuse |
| Un "sí" a "¿Le aviso?" vencía a los 30 minutos | Vale durante 24 h |

## Séptima ronda (revisión de la sexta)

Cuatro revisores independientes (estados y agenda, interpretación de texto, crisis y avisos, datos y documentación) encontraron 27 hallazgos. Cada corrección del bot quedó cubierta por un recorrido de `pnpm test:bot` que falla con el código anterior y pasa con el nuevo (20 recorridos nuevos o actualizados).

| Hallazgo | Corrección |
| --- | --- |
| "A las 15 no puedo, ¿tenés otro día?" reservaba o movía el turno a las 15 | Un horario se elige por texto solo si el mensaje es únicamente la hora; si no, se vuelve a mostrar la lista (que ahora incluye "Otros días") |
| "Quiero cambiar mi turno" durante una reserva (o "otro turno" durante una reprogramación) creaba un segundo turno o movía el existente | Se pregunta "¿sesión nueva o cambiar la que tenés?" conservando el día pedido |
| Un horario de una lista vieja sin flujo activo llevaba a reservar un segundo turno; confirmar otro turno cortaba la reprogramación en curso | La lista vieja pregunta igual que los días; confirmar solo cierra el flujo de ese mismo turno |
| "Agendar virtual" durante una reprogramación movía un turno presencial validándolo como virtual | Reprogramar conserva la modalidad del turno; el cambio de modalidad lo coordina el profesional |
| Doble toque simultáneo del mismo horario revivía el flujo con una lista nueva | Si el horario ya quedó a nombre de la persona, se informa y no se ofrece otra lista |
| Botones viejos sobre turnos cancelados o pasados respondían "por la cercanía de la fecha" y avisaban al profesional | "Ese turno ya está cancelado / ya no está vigente" en confirmar, cancelar y reprogramar |
| En crisis, "necesito hablar con el psicólogo" con una pregunta de cancelación pendiente volvía a preguntar si cancelaba | Se toma como pedido al profesional y se le avisa |
| En una derivación, "sí, confirmo" a un recordatorio no confirmaba | La regla del recordatorio vale también durante una derivación |
| Escribir la modalidad perdía el día ya pedido | Igual que el botón: se muestran los horarios de ese día |
| El clasificador tomaba "Gracias por avisar, pero no voy a poder ir" como agradecimiento y "Te confirmo que no voy" como confirmación | Cancelar y cambiar tienen prioridad sobre agradecer y confirmar |
| "No, la voy a tener que cancelar", "Sí, la reservé por error", "No la puedo mantener" se tomaban como "mantener" (y un "bueno" posterior confirmaba) | "Mantener" se reconoce por gramática cerrada: todo el mensaje tiene que ser frases inequívocas; lo demás muestra los botones |
| "Sí, quiero" o "Sí, avisale por favor" a "Avisar al psicólogo" quedaban sin respuesta y sin aviso; "Sí, avisale" podía confirmar un turno si en el medio llegaba un aviso | Se ignoran cortesías, emojis y repeticiones; "avisale" responde a la pregunta de avisar aunque no sea el último mensaje y nunca confirma un turno |
| Las respuestas a un aviso de cambio actuaban sobre el próximo turno y no sobre el del aviso | Se usa el turno del último aviso (si sigue vigente) |
| En crisis, cualquier respuesta a "¿Le aviso?" que no fuera "sí" recibía "Ya le avisé" sin aviso | Un "no" se respeta; otra cosa vuelve a preguntar con el botón |
| Un pedido al profesional tapaba otro distinto durante 10 minutos (por ejemplo, una cancelación fuera de plazo) | Deduplicación por motivo y tema |
| "Avisar al psicólogo" de un mensaje de crisis viejo llegaba como aviso común | Sigue siendo urgente y la derivación vuelve a ser por crisis |
| La derivación por crisis vencía a las 24 h aunque la persona siguiera escribiendo | Vence tras 24 h sin mensajes |
| Un contacto dado de baja que escribía un mensaje de crisis no recibía nada | Recibe el protocolo y se avisa al profesional |
| Un audio después del mensaje de crisis quedaba sin respuesta | Los audios y archivos siempre reciben respuesta; en crisis, con el mensaje de emergencia |
| Un botón con el turno de otra persona actuaba sobre el próximo turno propio; un número compartido entre dos fichas identificaba a una | Con un id ajeno no se actúa; un número que corresponde a dos fichas no identifica a nadie |
| Una cancelación por WhatsApp no avisaba al profesional y al paciente le llegaba "Turno cancelado" como si lo hubiera cancelado otro | El trigger reconoce la cancelación del propio paciente por WhatsApp (3 aserciones SQL nuevas) |
| La limpieza de `test:bot` dejaba avisos; un test podía fallar según la hora; un test unitario era tautológico | Limpieza completa con verificación de errores, horarios que se corren si chocan y aserciones con contenido |

## Preparación para publicar (planes gratuitos)

| Problema | Corrección |
| --- | --- |
| Con la plantilla por defecto de Supabase, la invitación vuelve con la sesión en el fragmento (`#access_token`), que el servidor no ve: el paciente terminaba en "enlace inválido" | Plantillas propias con `token_hash` (`supabase/templates`) y, como respaldo, una página intermedia en `/auth/callback` que entrega el fragmento a `/auth/callback/session` (solo mismo origen y JSON) |
| La recuperación de contraseña (PKCE) fallaba si el email se abría en otro navegador o en el celular | La plantilla de recuperación usa `token_hash`, que no depende del navegador |
| El plan Hobby de Vercel solo admite tareas programadas diarias: el cron de recordatorios cada 15 min hacía fallar el despliegue | `vercel.json` queda con el mantenimiento diario y los recordatorios los dispara `.github/workflows/recordatorios.yml` |
| El email incluido en Supabase solo envía a los miembros del equipo (2 por hora) | Documentado como paso obligatorio: SMTP propio |

Guía para publicar sin instalar nada: [`PUBLICAR.md`](../PUBLICAR.md).

## Pendientes recomendados antes de abrir al público

1. Revisión legal de privacidad, términos y consentimiento (Paraguay: datos personales y sensibles, salud, menores, ejercicio profesional).
2. Verificar y activar los recursos de emergencia en Configuración › Emergencia.
3. Crear y aprobar las plantillas de WhatsApp en Meta; probar el flujo completo con un número de prueba.
4. Configurar backups (PITR o dump cifrado periódico) y probar una restauración.
5. Habilitar MFA en Supabase para la cuenta del administrador.
6. Opcional: integrar Sentry (`SENTRY_DSN`) y dominio propio para emails de Supabase (SMTP).
