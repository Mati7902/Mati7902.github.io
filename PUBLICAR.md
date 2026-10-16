# Publicar la plataforma paso a paso

Esta guía te lleva de cero a tener la plataforma funcionando en internet con tu propia
dirección (por ejemplo `https://psicologiamatias.com`). No hace falta instalar nada ni saber
programar: todo se hace desde el navegador, copiando y pegando. Tiempo estimado: entre 2 y 3
horas, que podés repartir en varios días.

> **Versión interactiva:** pedile a Claude el enlace de la guía «Publicar tu web paso a paso».
> Tiene los mismos pasos, arma los valores con tus datos y trae botones para copiar el
> instalador de la base y las plantillas de email.

## Cómo funciona, en simple

| Pieza | Para qué sirve | Como si fuera… |
| --- | --- | --- |
| **GitHub** | Donde está guardado el código. Ya lo tenés. | Los planos de la casa |
| **Supabase** | Guarda lo privado: cuentas, turnos, fichas, ejercicios. | El archivero con llave |
| **Vercel** | La computadora que muestra tu página a quien la visite. | El consultorio abierto al público |
| **Resend** | Envía los emails: invitaciones y cambios de contraseña. | El cartero |
| **Tu dominio** | Tu dirección en internet. | La dirección en la puerta |

**¿Por qué no sirve `mati7902.github.io`?** Es GitHub Pages, que solo muestra páginas sencillas,
sin cuentas ni base de datos. En el paso 2 la apagamos.

## Qué vas a necesitar

- Una computadora (desde el celular es muy incómodo).
- Tu cuenta de GitHub y un email que revises.
- Una tarjeta que acepte pagos internacionales (Vercel y el dominio).
- Un lugar seguro para contraseñas y claves: el gestor de contraseñas del navegador o una app como
  Bitwarden. No las guardes en WhatsApp, en un email ni en un papel a la vista.

## Cuánto cuesta

Precios revisados en octubre de 2026; confirmalos antes de pagar.

| Servicio | Plan | Costo |
| --- | --- | --- |
| [Vercel](https://vercel.com/pricing) | **Pro**, obligatorio para uso profesional | US$ 20 por mes más impuestos |
| [Supabase](https://supabase.com/pricing) | Free para empezar; Pro recomendado con pacientes reales | US$ 0 · Pro US$ 25 por mes |
| [Resend](https://resend.com/pricing) | Free: 3.000 emails por mes, 100 por día | US$ 0 |
| Dominio `.com` | Pago anual | ≈ US$ 11 a 15 por año |
| Dominio `.com.py` ([NIC-PY](https://www.nic.py)) | Pago anual | ≈ G. 160.000 por año |

**¿Por qué Vercel Pro?** Sus condiciones dicen que el plan gratuito (*Hobby*) es solo para uso
personal y no comercial, y una página que ofrece consultas pagas es uso comercial
([condiciones de uso](https://vercel.com/docs/limits/fair-use-guidelines)). Además, en el plan
gratis y en la prueba, Vercel puede usar el contenido para entrenar inteligencia artificial.
Podés empezar con la prueba gratuita de 14 días y pasar a Pro antes de invitar pacientes.

## Palabras que vas a ver

- **Repositorio:** la carpeta en GitHub donde está el código.
- **Rama y `main`:** versiones del código; `main` es la que se publica.
- **Pull request:** un pedido para unir una versión nueva a `main`.
- **Deploy / Redeploy:** publicar (o volver a publicar) la página.
- **Variable de entorno:** un dato de configuración que Vercel le pasa a la página sin mostrarlo.
- **Key (clave):** una contraseña larga entre servicios. Las que dicen *secret* no se comparten.
- **SQL:** instrucciones para la base de datos; acá solo se copian y pegan.
- **DNS:** la guía telefónica de internet: dice a dónde lleva tu dominio.

---

## Etapa 1 · Preparar

### Paso 1. Unir la versión nueva a la rama principal (GitHub)

La versión más nueva (tu foto, ficha de ingreso, consentimiento, testimonios, cuadernillos) está
en una rama de trabajo; la página se publica desde `main`.

- **Lo más fácil:** escribile a Claude «Abrí el pull request con los últimos cambios y unilo a
  main».
- **Por tu cuenta:** en GitHub, pestaña **Pull requests**, abrí el pedido, tocá **Merge pull
  request** (o **Squash and merge**) y después **Confirm merge**. Tiene que aparecer el cartel
  violeta **Merged**.

Hacé este paso antes que los demás: el instalador de la base corresponde a esta versión. Si tu
página ya estaba publicada, Vercel la actualiza solo en uno o dos minutos; después corré la
actualización de la base (paso 4).

### Paso 2. Apagar la página vieja de GitHub

En el repositorio: **Settings › Pages**, al lado de *Your site is live at…* tocá **⋯ › Unpublish
site**. No borra nada del código.

## Etapa 2 · La base de datos (Supabase)

### Paso 3. Crear tu cuenta y el proyecto

1. Entrá a [supabase.com](https://supabase.com/dashboard) con **Continue with GitHub**.
2. Si te pide una organización: tu nombre, tipo **Personal**, plan **Free**.
3. Proyecto: nombre `psicologia`; **Database Password** con **Generate a password** (guardala en
   tu gestor); en **Region**, dentro de *Specific regions*, **South America (São Paulo)** (no la
   opción general *Americas*). Si aparecen **Enable Data API** y **Automatically expose new
   tables**, dejalas marcadas. Tocá **Create new project** y esperá.
4. Buscá tres datos:
   - **Project URL** (`https://abcd1234.supabase.co`): botón **Connect** de arriba.
   - **Publishable key** (`sb_publishable_…`): en **Connect** o en **Settings › API Keys**.
   - **Secret key** (`sb_secret_…`): en **Settings › API Keys** (si no hay ninguna, creá una).
     **Es secreta:** solo se pega en Vercel (paso 6).

Las claves viejas también funcionan: *anon* equivale a la publishable y *service_role* a la secret.

### Paso 4. Instalar la base de datos

1. Abrí [`supabase/instalar.sql`](supabase/instalar.sql) en GitHub y copiá **todo** el contenido
   con el botón de copiar del archivo (o el botón «Copiar el instalador» de la guía interactiva).
2. En Supabase: **SQL Editor › New query**, pegá y tocá **Run**. Si aparece *Potential issue
   detected*, es esperable: tocá **Run query**.
3. Tiene que decir **Success. No rows returned**.

**¿Ya la habías instalado con una versión anterior?** No la instales de nuevo: corré igual
[`supabase/actualizar.sql`](supabase/actualizar.sql). Agrega lo nuevo (cuadernillos, ficha de
ingreso, consentimiento, testimonios) sin borrar pacientes, turnos ni nada de lo que cargaste.

Si el instalador dice *already exists*, la base ya estaba instalada: corré la actualización. Si
la actualización también dice *already exists*, la base ya está al día. Si hay otro error, no
queda nada a medias: revisá que se haya pegado completo (termina con `commit;`) y corrélo de
nuevo. Si dice *Query is too large*, la guía interactiva tiene el instalador en tres partes (para
actualizar, alcanza con la 2 y la 3). **Nunca** corras `supabase/seed.sql`: son datos inventados
de demostración.

### Paso 5. Cerrar el registro libre

**Authentication › Sign In / Providers:** en *User Signups* apagá **Allow new users to sign up** y
tocá **Save changes** (los pacientes entran solo por invitación). Los textos de los emails van en
el paso 11: Supabase no deja editarlos hasta configurar tu propio envío de emails.

## Etapa 3 · La página (Vercel)

### Paso 6. Publicar la página

1. Entrá a [vercel.com](https://vercel.com/signup) con **Continue with GitHub**.
2. **Add New… › Project** e **Import** del repositorio `Mati7902.github.io` (si no aparece:
   **Adjust GitHub App Permissions**).
3. **Project Name:** `psicologia-matias-sanchez`.
4. **Environment Variables:** cargá estas cuatro, sin espacios y sin dejar ninguna vacía:

   | Nombre | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | la secret key |
   | `CRON_SECRET` | una contraseña larga inventada (40 letras y números al azar; la guía interactiva la genera). Guardala: se usa en el paso 13 |

5. **Deploy** y esperá unos minutos. Después **Continue to Dashboard**: tu dirección provisoria
   aparece en *Domains* (algo como `psicologia-matias-sanchez.vercel.app`). Abrila: tiene que verse
   tu portada.

Si dice *Build failed*, casi siempre es una variable mal copiada: corregila en **Settings ›
Environment Variables** y hacé **Deployments › ⋯ › Redeploy**. Cada cambio de variable necesita
un *Redeploy*.

### Paso 7. Decirle a Supabase dónde está tu página

**Authentication › URL Configuration:** en **Site URL** reemplazá `http://localhost:3000` por
`https://TU-PROYECTO.vercel.app` y en **Redirect URLs** agregá `https://TU-PROYECTO.vercel.app/**`.

### Paso 8. Crear tu cuenta de profesional

1. **Authentication › Users › Add user › Create new user:** tu email (*Email address*), una
   contraseña segura (*User Password*), dejá marcada **Auto confirm user?** y tocá **Create user**.
2. **SQL Editor › New query**, con tu email y tu nombre, y **Run**:

   ```sql
   update public.profiles
      set role = 'admin', first_name = 'Matías', last_name = 'Sánchez'
    where lower(email) = lower('tu-email@ejemplo.com');

   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
    where lower(email) = lower('tu-email@ejemplo.com');

   select email, role from public.profiles where lower(email) = lower('tu-email@ejemplo.com');
   ```

   Tiene que mostrar una fila con `admin`.
3. En tu página: **Acceso pacientes › Ingresar**. Llegás al **Panel profesional**. Si aparece «Tu
   cuenta todavía no está vinculada», corré el SQL, cerrá sesión y volvé a entrar.

**Tu plataforma ya está en internet.** Todavía no invites pacientes: faltan tu dirección y los
emails.

## Etapa 4 · Tu dirección y los emails

### Paso 9. Comprar tu dominio

Corto, fácil de dictar, sin acentos ni guiones. Lo más simple es comprarlo en Vercel (**Domains ›
Buy**), que lo conecta solo y cobra el precio de costo (unos US$ 11 por año para `.com`). Activá la
renovación automática y **confirmá tus datos en el email** que te llega: si no, a los 15 días se
suspende. Las compras de dominios casi nunca se reembolsan.

- Otros registradores: Porkbun (unos US$ 11 por año, también al renovar) o Namecheap (promoción el
  primer año, más caro al renovar).
- `.com.py`: en [NIC-PY](https://www.nic.py) (unos G. 160.000 por año). Pide RUC, servidores DNS
  configurados antes de la solicitud, confirmar un email en 8 días y pagar dentro de los 15 días
  de aprobado. El vencimiento es el día 25 del mes en que se activó.

### Paso 10. Conectar el dominio

1. En Vercel, en el proyecto: **Settings › Domains › Add Domain** y escribí tu dominio.
2. Aceptá agregar también `www` y elegí que **`www` redirija al dominio sin `www`** (los
   recordatorios usan la dirección sin `www`).
3. Si lo compraste en Vercel, en minutos dice **Valid Configuration**. Si lo compraste en otro
   lado, creá en su panel de DNS los registros que muestra Vercel (normalmente un **A** con nombre
   `@` y un **CNAME** con nombre `www`; copiá los valores de tu panel, cambian según el proyecto) y
   borrá registros viejos de `@` o `www`. Puede tardar hasta 48 horas.
4. **Deployments › ⋯ › Redeploy.** Después, `https://tudominio.com/api/health` tiene que mostrar
   `"app_url":"https://tudominio.com"`.

### Paso 11. Emails desde tu dominio

El email que trae Supabase solo le escribe a tu propio equipo: para invitar pacientes hace falta
este paso.

1. Creá una cuenta en [Resend](https://resend.com/signup).
2. **Domains › Add Domain:** tu dominio, región **São Paulo (sa-east-1)**.
3. Registros DNS: si el dominio está en Vercel, **Auto Configure**; si no, crealos copiando
   exactamente y con el nombre corto (`send`, `resend._domainkey`).
4. **Verify DNS Records** hasta que diga **Verified** (minutos; puede tardar hasta 72 horas).
5. **API Keys › Create API Key** con permiso **Sending access**. Copiala en el momento (se
   muestra una sola vez).
6. En Supabase, **Authentication › Emails › SMTP Settings**, activá **Enable custom SMTP**:

   | Campo | Valor |
   | --- | --- |
   | Sender email address | `turnos@tudominio.com` |
   | Sender name | `Lic. Matías Sánchez` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` |
   | Password | la API key de Resend |

   Tocá **Save changes**.
7. En Resend, si ves *Click Tracking* u *Open Tracking*, dejalos apagados: cambian los enlaces y
   las invitaciones dejarían de funcionar.
8. **Authentication › Emails › Templates:** en cada plantilla reemplazá el asunto (*Subject*) y
   el cuerpo por los de [`supabase/templates`](supabase/templates) y tocá **Save changes**:

   | Plantilla | Subject | Cuerpo |
   | --- | --- | --- |
   | Invite user | Tu invitación a la plataforma de pacientes | `invite.html` |
   | Reset password | Cambiar tu contraseña | `recovery.html` |
   | Magic link or OTP | Tu enlace de acceso | `magic_link.html` |

Resend gratis envía 100 emails por día. Supabase empieza con un máximo de 30 por hora
(**Authentication › Rate Limits**).

### Paso 12. Pasar Supabase a tu dominio

**Authentication › URL Configuration:** **Site URL** `https://tudominio.com`; en **Redirect URLs**
agregá `https://tudominio.com/**` y `https://www.tudominio.com/**`.

### Paso 13. Activar los recordatorios automáticos

Cada 15 minutos la base le avisa a la página que revise los turnos próximos (y de paso mantiene
activa la base del plan gratuito). En **SQL Editor › New query** pegá
[`supabase/recordatorios.sql`](supabase/recordatorios.sql) con tu dominio y tu `CRON_SECRET` en
lugar de `TU-DOMINIO` y `TU-CRON-SECRET`, y tocá **Run**. A los 15 minutos, comprobalo:

```sql
select status_code, content, created from net._http_response order by created desc limit 5;
```

Tiene que aparecer **200**. Un **401** significa que el `CRON_SECRET` no coincide con el de Vercel;
un **307** o **308**, que la dirección redirige (usá la que abre sin cambiar). Sin WhatsApp, los
recordatorios llegan como avisos dentro de la app.

## Etapa 5 · Antes de abrir al público

### Paso 14. Pasar Vercel al plan Pro

**Settings › Billing › Upgrade.** US$ 20 por mes, con US$ 20 de uso incluidos.

### Paso 15. Probar todo con un paciente de prueba

Con otro email tuyo: **Pacientes › Nuevo paciente**, marcá **Enviar invitación de acceso por
email** y guardá. Tiene que llegar «Tu invitación a la plataforma de pacientes» desde tu dominio;
el enlace te deja crear la contraseña, aceptar los términos y firmar el consentimiento. Probá
también **Olvidé mi contraseña**.

### Paso 16. Completar tu información y revisar los textos

En **Configuración**:

- **Identidad:** email de contacto y WhatsApp (sin esto, la portada no muestra cómo contactarte) y
  la dirección del consultorio.
- **Agenda:** días y horarios (vienen de lunes a viernes, de 14 a 20 h), duración y modo de reserva.
- **Emergencia:** los números 911 y 141 vienen apagados: verificalos y activalos.
- **Consentimiento:** viene activado con un texto modelo; leelo y adaptalo.
- **Preferencias › Textos legales:** hacé revisar privacidad y términos por un abogado y marcá
  «Textos revisados por un profesional competente».
- **Testimonios** (opcional): solo reales y autorizados.

En **Planes**, revisá los precios. **Copias de seguridad:** Supabase Free no las hace; antes de
cargar pacientes reales pasá a Supabase Pro (copia diaria de los últimos 7 días y sin pausas).

---

## Después de publicar

- Vercel cobra cada mes; el dominio se renueva cada año.
- Si Supabase avisa que va a pausar el proyecto, entrá a su panel y restauralo.
- Si cambiás de dominio, repetí los pasos 10 a 13.

## Si algo falla

| Lo que ves | Qué hacer |
| --- | --- |
| *Build failed* en Vercel | Una variable mal copiada o vacía (paso 6). Corregila y hacé *Redeploy*. El detalle está en **Deployments › (el despliegue) › Build Logs**. |
| *already exists* al instalar la base | Ya estaba instalada, quizás con una versión anterior: corré `supabase/actualizar.sql` (paso 4). Si también dice *already exists*, está al día. |
| *Query is too large* | Usá el instalador en tres partes de la guía interactiva (para actualizar, la 2 y la 3). |
| *Set up custom SMTP to edit templates* | Es normal hasta el SMTP del paso 11: hacé eso primero. |
| Tu dominio muestra la página con otro diseño o sin tu foto nueva | En `main` quedó una versión vieja: hacé el paso 1 (Vercel publica solo en uno o dos minutos) y la actualización del paso 4. Recargá con Ctrl + F5. |
| Tu dominio muestra textos técnicos o un 404 de GitHub | Apunta a GitHub Pages: hacé el paso 2 y dejá en tu DNS solo los registros que muestra Vercel (borrá los de `github.io` o `185.199.…`). |
| *permission denied for table* | Corré `supabase/actualizar.sql`: da a las tablas los permisos que faltan. |
| «Tu cuenta todavía no está vinculada» al entrar | Corré el SQL del paso 8 con tu email exacto y volvé a entrar. |
| «Demasiados intentos» | Esperá 15 minutos. |
| *Invalid Configuration* en el dominio | Registros DNS distintos de los de Vercel o registros viejos para `@` o `www`. Puede tardar hasta 48 horas. |
| El dominio dejó de funcionar | ¿Confirmaste tus datos en el email del registrador? |
| No llegan los emails | Dominio *Verified* en Resend, datos SMTP del paso 11, carpeta de spam, límite de 100 por día. |
| «Enlace inválido» en una invitación | *Site URL* del paso 12 y plantillas del paso 11. Los enlaces se usan una sola vez: reenviá la invitación. |
| Los emails siguen con `.vercel.app` | Falta el *Redeploy* del paso 10. |
| Los recordatorios dan 401 | El `CRON_SECRET` de Vercel y el del paso 13 no coinciden. |

Ante cualquier error, copiá el mensaje (sin claves secretas) y pegáselo a Claude diciendo en qué
paso estás.

### Opcional, cuando quieras

**WhatsApp**, **Google Calendar** e **IA del chatbot**: ver el [README](README.md) (§8, §9 y §10).
Usá tu dominio en las direcciones que piden: el webhook de Meta es
`https://tudominio.com/api/webhooks/whatsapp` y la URI de Google,
`https://tudominio.com/api/integrations/google/callback`.
