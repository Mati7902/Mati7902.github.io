# Publicar la plataforma (paso a paso)

Guía para poner la página en internet con planes gratuitos: **Supabase** (base de datos, cuentas
y archivos) y **Vercel** (la página web). No hace falta instalar nada en tu computadora: todo se
hace desde el navegador. Tiempo estimado: 45 a 60 minutos.

> Para una instalación técnica completa (WhatsApp, Google Calendar, IA, scripts), ver el
> [README](README.md). Esta guía cubre lo mínimo para que la página funcione.

**Antes de empezar, tené a mano:**
- Una cuenta de GitHub con acceso a este repositorio.
- El email que vas a usar como administrador.
- Un servicio de envío de emails (ver paso 4). Sin él, las invitaciones a pacientes no llegan.

---

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y tocá **New project**.
2. Nombre: el que quieras (por ejemplo `psicologia`). Región: **South America (São Paulo)**.
   Guardá la contraseña de la base de datos en un lugar seguro.
3. Cuando el proyecto esté listo, andá a **Project Settings › API Keys** (o **API**) y anotá:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_…`) o, si tu proyecto la muestra, la **anon key**
   - **Secret key** (`sb_secret_…`) o la **service_role key**. Esta clave es secreta: no la
     compartas ni la pegues en ningún lado salvo en Vercel (paso 5).

## 2. Crear las tablas

1. En Supabase, abrí **SQL Editor › New query**.
2. Abrí en GitHub la carpeta [`supabase/migrations`](supabase/migrations). Hay seis archivos.
   **En orden** (del `…0001…` al `…0006…`): abrí cada uno, tocá *Raw*, copiá todo el texto,
   pegalo en el SQL Editor y tocá **Run**. Esperá el "Success" antes de pasar al siguiente.
3. No ejecutes `supabase/seed.sql`: son datos ficticios de demostración.

## 3. Configurar el inicio de sesión

En Supabase, **Authentication**:

1. **Sign In / Providers › Email**: dejá activado Email y **desactivá "Allow new users to sign up"**
   (los pacientes entran solo por invitación). Dejá activado *Confirm email*.
2. **URL Configuration**: por ahora poné cualquier valor; lo completás en el paso 6 cuando tengas
   la dirección de la página.
3. **Email Templates**: reemplazá el contenido de estas tres plantillas por el de los archivos de
   [`supabase/templates`](supabase/templates) (abrí cada archivo, *Raw*, copiá todo):
   - *Invite user* → `invite.html`
   - *Reset password* → `recovery.html`
   - *Magic link* → `magic_link.html`

   Así los enlaces de los emails funcionan aunque se abran en otro navegador o en el celular.

## 4. Configurar el envío de emails (obligatorio para invitar pacientes)

El email que trae Supabase solo envía a los miembros de tu equipo de Supabase y como máximo 2 por
hora. Para invitar pacientes hace falta un servicio propio de envío (SMTP):

1. Creá una cuenta en un servicio de envío de emails con plan gratuito (por ejemplo Resend o
   Brevo). Normalmente piden verificar un dominio propio o una dirección de envío.
2. En Supabase, **Authentication › Emails › SMTP Settings**: activá *Custom SMTP* y cargá el
   servidor, puerto, usuario y contraseña que te da el servicio, y el remitente (por ejemplo
   `turnos@tu-dominio.com`).
3. Revisá **Authentication › Rate Limits**: el límite de emails por hora tiene que alcanzar para
   las invitaciones que vayas a mandar.

## 5. Publicar la página en Vercel

1. Entrá a [vercel.com](https://vercel.com) y creá una cuenta **con tu cuenta de GitHub** (plan Hobby, gratis).
2. **Add New… › Project** e importá el repositorio `Mati7902.github.io`.
3. **Project Name**: elegí un nombre corto, por ejemplo `psicologia-matias`. La dirección de la
   página va a ser `https://psicologia-matias.vercel.app` (si ese nombre está libre).
4. En **Environment Variables** cargá estas cinco (nombre exacto a la izquierda, valor a la derecha):

   | Nombre | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL del paso 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la publishable (o anon) key del paso 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | la secret (o service_role) key del paso 1 |
   | `NEXT_PUBLIC_APP_URL` | la dirección de la página, sin barra al final (ej. `https://psicologia-matias.vercel.app`) |
   | `CRON_SECRET` | una contraseña larga inventada (por ejemplo 40 letras y números al azar). Guardala: la vas a usar en el paso 8 |

5. Tocá **Deploy** y esperá unos minutos. Al terminar, Vercel muestra la dirección real de la
   página. Si es distinta de la que pusiste en `NEXT_PUBLIC_APP_URL`, corregí esa variable en
   **Settings › Environment Variables** y volvé a publicar (**Deployments › ⋯ › Redeploy**).

> Vercel publica la rama que elijas como *Production Branch* (por defecto `main`). Si todavía no
> mezclaste el pull request con los cambios, mezclalo primero o elegí esa rama en
> **Settings › Git**.

## 6. Conectar Supabase con la dirección de la página

En Supabase, **Authentication › URL Configuration**:
- **Site URL**: la dirección de la página (ej. `https://psicologia-matias.vercel.app`).
- **Redirect URLs**: agregá `https://psicologia-matias.vercel.app/auth/callback`.

## 7. Crear tu cuenta de administrador

1. En Supabase, **Authentication › Users › Add user › Create new user**: tu email, una contraseña
   segura y marcá **Auto Confirm User**.
2. En **SQL Editor**, ejecutá esto (con tu email y tu nombre):

   ```sql
   update public.profiles
      set role = 'admin', first_name = 'Matías', last_name = 'Sánchez'
    where email = 'tu-email@ejemplo.com';
   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
    where email = 'tu-email@ejemplo.com';
   ```

3. Entrá a la página, tocá **Ingresar** y usá ese email y contraseña. Tenés que llegar al panel
   del profesional.

## 8. Activar los recordatorios automáticos

El plan gratuito de Vercel solo permite tareas automáticas una vez por día, así que los
recordatorios de turnos los dispara GitHub cada 15 minutos (gratis en repositorios públicos):

1. En GitHub, en el repositorio: **Settings › Secrets and variables › Actions › New repository secret**.
2. Creá dos secretos:
   - `APP_URL`: la dirección de la página (ej. `https://psicologia-matias.vercel.app`)
   - `CRON_SECRET`: el mismo valor que pusiste en Vercel
3. En la pestaña **Actions**, abrí *Recordatorios de turnos* y tocá **Run workflow** para probarlo:
   tiene que terminar en verde.

Cada recordatorio aparece como aviso dentro de la plataforma del paciente y, cuando conectes
WhatsApp (ver README), también le llega por WhatsApp.

## 9. Antes de invitar pacientes

En el panel del profesional:
1. **Configuración**: tu nombre, matrícula, foto, horarios de atención, modalidades, precios y
   textos de la página.
2. **Configuración › Emergencia**: verificá y activá los recursos de emergencia.
3. **Textos legales**: la política de privacidad y los términos están en borrador. Hacelos revisar
   por un profesional del derecho y marcalos como revisados en **Configuración › Preferencias**.
4. **Pacientes › Nuevo paciente** con "Enviar invitación": probalo primero con un email tuyo.

## 10. La página de GitHub Pages

Este repositorio también publicaba la calculadora de hidratación basal en
`https://mati7902.github.io`. Con estos cambios la calculadora quedó en
`legacy/hidratacion-basal/` y la plataforma vive en Vercel. Si ya no usás GitHub Pages,
desactivalo en **Settings › Pages**.

---

### Opcional, cuando quieras

- **Dominio propio** (ej. `psicologia-matias.com`): en Vercel, **Settings › Domains**. Después
  actualizá `NEXT_PUBLIC_APP_URL`, la *Site URL* y las *Redirect URLs* de Supabase y el secreto
  `APP_URL` de GitHub.
- **WhatsApp**, **Google Calendar** e **IA del chatbot**: ver el [README](README.md) (§8, §9 y §10).
- **Plan Pro de Vercel**: si lo contratás, podés pasar los recordatorios a Vercel agregando a
  `vercel.json` la tarea `{"path": "/api/cron/reminders", "schedule": "*/15 * * * *"}`.
- **Copias de seguridad**: ver README §13.

### Si algo falla

| Síntoma | Qué revisar |
| --- | --- |
| El despliegue de Vercel falla | Que las cinco variables estén cargadas con el nombre exacto. Los detalles están en **Deployments › (el despliegue) › Build Logs**. |
| "Enlace inválido" al abrir una invitación | Que la *Site URL* y las *Redirect URLs* de Supabase tengan la dirección correcta y que las plantillas del paso 3 estén cargadas. Los enlaces se pueden usar una sola vez y vencen. |
| No llegan los emails | Paso 4 (SMTP propio) y la carpeta de spam. |
| No podés entrar al panel del profesional | Que el `update` del paso 7 haya cambiado una fila (el email tiene que coincidir exactamente). |
| El workflow de recordatorios falla | Que `APP_URL` no termine en `/` duplicado y que `CRON_SECRET` sea idéntico en GitHub y en Vercel. |
