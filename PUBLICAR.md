# Publicar la plataforma con tu dominio (paso a paso)

Con esta guía la página queda en internet en tu propia dirección (por ejemplo
`https://psicologiamatias.com`). Todo se hace desde el navegador, sin instalar nada.
Tiempo estimado: entre 1 y 2 horas, más la espera de que el dominio quede activo (normalmente
minutos; a veces unas horas).

> **Asistente:** si querés los valores exactos para copiar y pegar con tu dominio, pedile a
> Claude el enlace del asistente de publicación. Esta guía explica cada paso y qué hacer si algo
> falla.

**Qué servicios se usan y cuánto cuestan** (datos revisados en octubre de 2026; los precios y
límites cambian, confirmalos en la página de cada servicio antes de contratar):

| Para qué | Servicio | Plan |
| --- | --- | --- |
| La dirección (`tudominio.com`) | Un registrador de dominios (paso 1) | Pago anual; el precio depende de la terminación |
| La página web | [Vercel](https://vercel.com/pricing) | **Pro** (alrededor de US$ 20 por mes). El plan gratuito *Hobby* es solo para uso personal y no comercial: una página que ofrece consultas pagas necesita Pro ([condiciones de uso de Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). |
| Base de datos, cuentas y archivos | [Supabase](https://supabase.com/pricing) | Gratis para empezar (ver abajo). Pro (desde US$ 25 por mes) suma copias de seguridad diarias |
| Envío de emails (invitaciones, contraseñas) | [Resend](https://resend.com/pricing) | Gratis: 3.000 emails por mes y 100 por día |

**Sobre el plan gratuito de Supabase:** pausa el proyecto si pasa una semana sin actividad (los
recordatorios del paso 9 consultan la base cada 15 minutos y la mantienen activa) y **no incluye
copias de seguridad automáticas**. Antes de cargar datos de pacientes reales, pasá a Pro o hacé
copias periódicas (README §13).

**Antes de empezar, tené a mano:** tu cuenta de GitHub, el email que vas a usar como
administrador y una tarjeta para pagar el dominio y Vercel.

> Para una instalación técnica completa (WhatsApp, Google Calendar, IA, scripts), ver el
> [README](README.md).

---

## 0. Unir los cambios a `main`

Vercel publica la rama `main` del repositorio. Si todavía no uniste el pull request con la
plataforma, entrá al pull request en GitHub y tocá **Merge pull request** (o pedíselo a Claude).
La calculadora de hidratación que estaba en la raíz queda en `legacy/hidratacion-basal/`.

## 1. Elegir y comprar el dominio

1. **Elegí el nombre.** Corto, fácil de dictar por teléfono y sin guiones ni acentos (por ejemplo
   `psicologiamatias.com`). Antes de pagar, buscá que no sea una marca de otra persona.
2. **Elegí la terminación.**
   - `.com`: la más conocida; la venden todos los registradores.
   - `.com.py`: muestra que la práctica es de Paraguay. La registra
     [NIC-PY](https://www.nic.py) (no la venden Vercel ni Cloudflare). Pueden pedirla las personas
     con domicilio o residencia legal en Paraguay; NIC-PY aprueba la solicitud en 24 a 48 horas
     hábiles y después hay 15 días para pagar. Revisá en su página los requisitos y el costo
     vigentes.
3. **Elegí dónde comprarlo.** Las tres opciones funcionan con esta guía:

   | Opción | Ventaja | Qué cambia en el paso 5 |
   | --- | --- | --- |
   | **En Vercel** (lo más simple) | Desde **Domains › Buy** en el panel de Vercel. Queda conectado solo, sin tocar DNS. Según Vercel, el plan Pro incluye un dominio gratis el primer año (no durante la prueba gratuita): fijate si te lo ofrece al comprar. | Nada: Vercel lo configura |
   | Otro registrador ([Cloudflare](https://www.cloudflare.com/products/registrar/), [Namecheap](https://www.namecheap.com), [Porkbun](https://porkbun.com)) | Cloudflare cobra el precio de costo; Namecheap y Porkbun incluyen privacidad WHOIS gratis | Hay que copiar dos registros DNS |
   | `.com.py` en [NIC-PY](https://www.nic.py) | Terminación paraguaya | Hay que copiar los registros DNS en el servicio de DNS que uses con NIC-PY |

4. Al comprar:
   - Activá la **renovación automática** y la **privacidad WHOIS** si la ofrecen. Fijate el precio
     de renovación, no solo el del primer año.
   - Usá un email que revises: el registrador te va a pedir **confirmar tus datos por email**. Si
     no lo confirmás (en general hay 15 días), el dominio se suspende y la página deja de verse.
   - Las compras de dominios casi nunca se reembolsan: revisá bien el nombre antes de pagar.

## 2. Crear la base de datos en Supabase

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y tocá **New project**.
2. Nombre: el que quieras (por ejemplo `psicologia`). Región: **South America (São Paulo)**.
   Guardá la contraseña de la base de datos en un lugar seguro.
3. Cuando el proyecto esté listo, andá a **Project Settings › API Keys** (o **API**) y anotá:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_…`) o, si tu proyecto la muestra, la **anon key**
   - **Secret key** (`sb_secret_…`) o la **service_role key**. Es secreta: no la compartas ni la
     pegues en ningún lado salvo en Vercel (paso 4).
4. Abrí **SQL Editor › New query**. En GitHub abrí el archivo
   [`supabase/instalar.sql`](supabase/instalar.sql), tocá *Raw*, copiá **todo** el texto, pegalo
   en el SQL Editor y tocá **Run**. Tiene que terminar con *Success* (tarda unos segundos).
   Si muestra un error no queda nada a medias: revisá que pegaste el archivo completo y volvé a
   correrlo.
5. No ejecutes `supabase/seed.sql`: son datos ficticios de demostración.

## 3. Configurar el inicio de sesión

En Supabase, **Authentication**:

1. **Sign In / Providers › Email**: dejá activado Email y **desactivá "Allow new users to sign up"**
   (los pacientes entran solo por invitación). Dejá activado *Confirm email*.
2. **Emails › Templates**: reemplazá el contenido de estas tres plantillas por el de los archivos
   de [`supabase/templates`](supabase/templates) (abrí cada archivo, *Raw*, copiá todo):
   - *Invite user* → `invite.html`
   - *Reset password* → `recovery.html`
   - *Magic link* → `magic_link.html`

   Así los enlaces de los emails funcionan aunque se abran en otro navegador o en el celular.

La dirección de la página (*URL Configuration*) se completa en el paso 7, cuando el dominio ya
esté funcionando.

## 4. Publicar la página en Vercel

1. Entrá a [vercel.com](https://vercel.com) y creá una cuenta **con tu cuenta de GitHub**.
   Elegí el plan **Pro** (podés empezar con la prueba gratuita y pasar a Pro antes de abrir al
   público).
2. **Add New… › Project** e importá el repositorio `Mati7902.github.io`.
3. **Project Name**: un nombre corto, por ejemplo `psicologia-matias`.
4. En **Environment Variables** cargá estas cuatro (nombre exacto a la izquierda, valor a la derecha):

   | Nombre | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL del paso 2 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la publishable (o anon) key del paso 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | la secret (o service_role) key del paso 2 |
   | `CRON_SECRET` | una contraseña larga inventada (40 letras y números al azar). Guardala: la usás en el paso 9 |

   No hace falta cargar `NEXT_PUBLIC_APP_URL`: la página toma sola la dirección de Vercel y,
   cuando conectes el dominio, la del dominio. Para eso, dejá activada la opción
   **Automatically expose System Environment Variables** (viene activada).
5. Tocá **Deploy** y esperá unos minutos. Al terminar vas a tener una dirección provisoria del tipo
   `https://psicologia-matias.vercel.app`. Abrila para comprobar que la página carga.

## 5. Conectar el dominio

En Vercel, dentro del proyecto: **Settings › Domains**.

**Si compraste el dominio en Vercel:** agregalo desde la lista. Vercel configura todo.

**Si lo compraste en otro lado:**

1. Escribí tu dominio (`tudominio.com`) y tocá **Add**. Vercel te ofrece agregar también
   `www.tudominio.com` con una redirección: aceptá, así las dos direcciones llevan a la misma
   página.
2. Vercel muestra los registros que tenés que crear: normalmente un registro **A** para el dominio
   (nombre `@`) y un **CNAME** para `www`. **Copiá los valores que muestra tu panel de Vercel**:
   cambian según el proyecto (por ejemplo, el registro A puede ser `76.76.21.21` o `216.198.79.1`).
3. En el panel de tu registrador, en la sección **DNS** (a veces "Zona DNS" o "Registros"), creá
   esos registros copiando **exactamente** tipo, nombre y valor. Antes, borrá los registros `A`,
   `AAAA` o `CNAME` que ya hubiera para `@` o `www` (por ejemplo, los de una página de "dominio
   estacionado"). Si el dominio está en Cloudflare, dejá los registros con la nube gris
   (*DNS only*), sin proxy.
4. Volvé a Vercel y esperá a que el dominio diga **Valid Configuration**. Suele tardar minutos;
   puede llegar a tardar hasta 48 horas. El certificado de seguridad (el candado, `https`) lo
   genera Vercel solo cuando los registros están bien.

**Después, en los dos casos:** andá a **Deployments**, abrí el último, tocá **⋯ › Redeploy** y
esperá a que termine. Así la página empieza a usar tu dominio en los emails y enlaces. Para
comprobarlo, abrí `https://tudominio.com/api/health`: el valor `app_url` tiene que ser
`https://tudominio.com`.

## 6. Emails con tu dominio

El email que trae Supabase solo envía a los miembros de tu equipo de Supabase y como máximo 2 por
hora: para invitar pacientes hace falta un servicio de envío. Con tu dominio, los emails salen
desde una dirección como `turnos@tudominio.com` y llegan mejor (menos spam). No hace falta crear
esa casilla: alcanza con verificar el dominio.

1. Creá una cuenta en [Resend](https://resend.com).
2. **Domains › Add Domain**: escribí tu dominio. Resend muestra en la pestaña **Records** los
   registros DNS que tenés que crear: normalmente un `MX` y un `TXT` con nombre `send` y un `TXT`
   con nombre `resend._domainkey` (algunos dominios nuevos reciben registros `CNAME`). Copiá
   **exactamente** lo que muestra Resend, escribiendo solo el nombre corto (por ejemplo `send`, no
   `send.tudominio.com`).
   - Si el dominio está en Vercel, Resend ofrece **Auto Configure** y los crea solo.
   - Si no, crealos en el mismo lugar que los del paso 5.
   - Recomendado: agregá también un `TXT` con nombre `_dmarc` y valor `v=DMARC1; p=none;`.

   Tocá **Verify** y esperá a que diga *Verified* (suele tardar unos minutos; puede tardar hasta 72
   horas).
3. **API Keys › Create API Key** (permiso *Sending access*). Copiala: se muestra una sola vez.
4. En Supabase, **Authentication › Emails › SMTP Settings**: activá **Enable custom SMTP** y cargá:

   | Campo | Valor |
   | --- | --- |
   | Sender email address | `turnos@tudominio.com` (cualquier nombre @ tu dominio) |
   | Sender name | el nombre de la práctica (por ejemplo `Lic. Matías Sánchez`) |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` |
   | Password | la API key del punto 3 |

   (Otra forma: en Resend, **Integrations › Supabase** configura este paso solo.)
5. Al activar el SMTP propio, Supabase empieza con un límite bajo de emails por hora. En
   **Authentication › Rate Limits** subilo según las invitaciones que vayas a mandar (Resend
   gratis permite 100 por día).

## 7. Conectar Supabase con tu dominio

En Supabase, **Authentication › URL Configuration**:
- **Site URL**: `https://tudominio.com` (sin barra al final; acá no se usan comodines).
- **Redirect URLs**: agregá `https://tudominio.com/**` y, si activaste `www`,
  `https://www.tudominio.com/**`.

## 8. Crear tu cuenta de administrador

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

3. Entrá a `https://tudominio.com`, tocá **Ingresar** y usá ese email y contraseña. Tenés que
   llegar al panel del profesional. Si el panel muestra el aviso "Falta terminar de conectar…",
   repetí el *Redeploy* del paso 5.

## 9. Activar los recordatorios automáticos

Los recordatorios de turnos se envían cada 15 minutos. Los dispara GitHub (gratis en repositorios
públicos) y, de paso, esas consultas mantienen activa la base de datos.

1. En GitHub, en el repositorio: **Settings › Secrets and variables › Actions › New repository secret**.
2. Creá dos secretos:
   - `APP_URL`: `https://tudominio.com`
   - `CRON_SECRET`: el mismo valor que pusiste en Vercel
3. En la pestaña **Actions**, abrí *Recordatorios de turnos* y tocá **Run workflow** para probarlo:
   tiene que terminar en verde.

> Con Vercel Pro también podés dispararlos desde Vercel: agregá a `vercel.json` la tarea
> `{"path": "/api/cron/reminders", "schedule": "*/15 * * * *"}` y desactivá el workflow de GitHub
> (Actions › Recordatorios de turnos › ⋯ › Disable workflow). No uses los dos a la vez.

## 10. Probar todo antes de invitar pacientes

- [ ] `https://tudominio.com` abre la página con el candado.
- [ ] `https://www.tudominio.com` lleva a la misma página (si lo agregaste).
- [ ] `https://tudominio.com/api/health` muestra `"app_url":"https://tudominio.com"`.
- [ ] Entrás al panel del profesional con tu cuenta.
- [ ] **Pacientes › Nuevo paciente** con "Enviar invitación" a un email tuyo: el email llega desde
      `@tudominio.com`, el enlace abre tu dominio y te deja crear la contraseña.
- [ ] "Olvidé mi contraseña" manda el email y el enlace funciona.
- [ ] El workflow *Recordatorios de turnos* termina en verde.

## 11. Antes de abrir al público

En el panel del profesional:
1. **Configuración**: tu nombre, matrícula, foto, horarios de atención, modalidades, precios y
   textos de la página.
2. **Configuración › Emergencia**: verificá y activá los recursos de emergencia.
3. **Textos legales**: la política de privacidad y los términos están en borrador. Hacelos revisar
   por un profesional del derecho (incluido dónde se guardan los datos: Supabase y Vercel) y
   marcalos como revisados en **Configuración › Preferencias**.
4. **Copias de seguridad**: Supabase Pro o copias periódicas propias (README §13).

## 12. La página de GitHub Pages

Este repositorio también publicaba la calculadora de hidratación basal en
`https://mati7902.github.io`. La plataforma vive en Vercel con tu dominio; si ya no usás GitHub
Pages, desactivalo en **Settings › Pages**. No conectes tu dominio a GitHub Pages.

---

### Opcional, cuando quieras

- **WhatsApp**, **Google Calendar** e **IA del chatbot**: ver el [README](README.md) (§8, §9 y §10).
  Usá tu dominio en las direcciones que piden: el webhook de Meta es
  `https://tudominio.com/api/webhooks/whatsapp` y la URI de Google,
  `https://tudominio.com/api/integrations/google/callback`.
- **Cambiar de dominio más adelante**: agregá el nuevo en Vercel, hacé *Redeploy* y repetí los
  pasos 6 (dominio en Resend), 7 y 9 con la dirección nueva.

### Si algo falla

| Síntoma | Qué revisar |
| --- | --- |
| El despliegue de Vercel falla | Que las cuatro variables estén cargadas con el nombre exacto. Los detalles están en **Deployments › (el despliegue) › Build Logs**. |
| Vercel dice *Invalid Configuration* en el dominio | Que los registros DNS sean exactamente los que muestra Vercel y que no queden registros `A`, `AAAA` o `CNAME` viejos para `@` o `www`. Puede tardar en actualizarse. |
| El dominio abre otra página o "dominio en venta" | Los cambios de DNS todavía se están propagando, o quedó un registro viejo. |
| El dominio dejó de funcionar de un día para otro | ¿Confirmaste tus datos en el email del registrador? Sin esa confirmación el dominio se suspende. |
| Los emails y enlaces siguen con la dirección `.vercel.app` | Falta el *Redeploy* del paso 5. Si cargaste `NEXT_PUBLIC_APP_URL`, cambiala por tu dominio o borrala y volvé a publicar. |
| "Enlace inválido" al abrir una invitación | La *Site URL* y las *Redirect URLs* del paso 7 y las plantillas del paso 3. Los enlaces se pueden usar una sola vez y vencen. |
| No llegan los emails | Que el dominio diga *Verified* en Resend, los datos SMTP del paso 6, el límite de *Rate Limits* y la carpeta de spam. |
| No podés entrar al panel del profesional | Que el `update` del paso 8 haya cambiado una fila (el email tiene que coincidir exactamente). |
| El workflow de recordatorios falla | Que `APP_URL` no termine en `/` y que `CRON_SECRET` sea idéntico en GitHub y en Vercel. |
| Supabase avisa que va a pausar el proyecto | Que el workflow de recordatorios esté activo y en verde; o entrá al panel de Supabase para reactivarlo. |
