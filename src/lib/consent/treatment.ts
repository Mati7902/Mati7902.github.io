/**
 * Consentimiento informado y compromiso terapéutico que el paciente firma al crear su cuenta,
 * antes de la ficha de ingreso. El texto se edita desde Configuración › Consentimiento (clave
 * `treatment_consent`); este es el modelo inicial, que el profesional revisa antes de usarlo.
 *
 * Formato del texto: párrafos separados por una línea en blanco, viñetas con "- " y **negrita**
 * (un párrafo entero en negrita funciona como subtítulo). Los datos del consultorio van como
 * marcadores {{...}} y se completan con la configuración vigente al firmar.
 */

export const CONSENT_PLACEHOLDERS = [
  { key: "profesional", label: "Nombre del profesional (Identidad)" },
  { key: "titulo", label: "Título profesional (Identidad)" },
  { key: "matricula", label: "Matrícula / registro (Identidad)" },
  { key: "sesiones", label: "Sesiones del compromiso (este formulario)" },
  { key: "duracion", label: "Duración de la sesión en minutos (Agenda)" },
  { key: "cancelacion", label: "Horas de anticipación para cancelar (Agenda)" },
] as const;

export type ConsentPlaceholder = (typeof CONSENT_PLACEHOLDERS)[number]["key"];
export type ConsentParams = Record<ConsentPlaceholder, string>;

export const DEFAULT_CONSENT_VERSION = "2026-10";
export const DEFAULT_CONSENT_TITLE = "Consentimiento informado y compromiso terapéutico";
export const DEFAULT_CONSENT_SESSIONS = 8;

export const DEFAULT_CONSENT_BODY = `Este documento explica cómo es el tratamiento psicológico con {{profesional}} ({{titulo}}, {{matricula}}), para que puedas decidir con información. Leelo con tranquilidad: si algo no queda claro, lo hablamos en la primera sesión.

**1. En qué consiste el tratamiento**

Es una psicoterapia basada en evidencia, que integra la terapia cognitivo-conductual con aportes de la neurociencia aplicada. Las sesiones duran alrededor de {{duracion}} minutos y pueden ser presenciales o virtuales.

En las primeras sesiones evaluamos juntos lo que te pasa, con la ayuda de tu ficha de ingreso, y acordamos objetivos. Después trabajamos con estrategias concretas, que vas a practicar también entre sesiones con los ejercicios y materiales de la app.

**2. Beneficios y posibles molestias**

La psicoterapia suele ayudar a entender lo que te pasa, a aliviar el malestar y a desarrollar herramientas propias. Los resultados dependen de muchos factores y no se pueden garantizar.

A veces, hablar de temas difíciles genera más malestar por un tiempo. Es parte del proceso y lo podés plantear en sesión.

**3. Confidencialidad y sus límites**

Lo que hablamos en sesión y lo que registrás en la app es confidencial y está protegido por el secreto profesional. Solo se puede compartir sin tu autorización:

- si hay un riesgo grave para tu vida o la de otras personas;
- si lo ordena una autoridad judicial;
- para proteger a una niña, un niño o un adolescente en riesgo.

En esos casos se comparte solo lo indispensable y, siempre que sea posible, lo hablamos antes con vos.

Si tenés menos de 18 años, tu madre, padre o tutor tiene que autorizar el tratamiento. Lo que contás en sesión se mantiene en reserva, salvo en las situaciones de riesgo de arriba.

**4. Sesiones virtuales y uso de la app**

Para las sesiones virtuales necesitás un lugar privado y una conexión estable. La app es un apoyo entre sesiones: no es un servicio de urgencias y lo que escribís ahí no se lee en el momento. Tus datos se tratan como explica la política de privacidad.

Si en algún momento estás en peligro o pensás en hacerte daño, no esperes a la sesión: en la sección Calmarme de la app está el recuadro «Si necesitás ayuda urgente», o acudí a la guardia del hospital más cercano.

**5. Compromiso de asistir a las primeras {{sesiones}} sesiones**

Te pedimos que te comprometas a asistir a las primeras {{sesiones}} sesiones. Estas son las razones:

- **Es el tiempo que suele necesitar un proceso para mostrar resultados.** Las investigaciones sobre psicoterapia muestran que alrededor de la mitad de las personas tiene una mejoría clara hacia la octava sesión (Howard y colaboradores, 1986).
- **El tratamiento tiene etapas.** En las primeras sesiones evaluamos y entendemos lo que te pasa; en las siguientes practicamos estrategias concretas; al final de este primer tramo revisamos juntos lo logrado.
- **El cerebro aprende con práctica repetida.** Formas de pensar, sentir y reaccionar que se repitieron durante años no cambian en una o dos sesiones: lo nuevo necesita practicarse durante varias semanas para consolidarse.
- **Dejar al principio es lo que menos ayuda.** Alrededor de una de cada cinco personas deja la terapia antes de tiempo (Swift y Greenberg, 2012), muchas veces justo cuando el trabajo empieza a tocar temas difíciles. Sostener el proceso permite atravesar esa etapa con acompañamiento.

En la sesión {{sesiones}} revisamos los objetivos y decidimos juntos si seguir, con qué frecuencia, o si el tratamiento puede terminar.

Este compromiso es una decisión tuya para darle una oportunidad real al proceso; no es una obligación legal. Podés interrumpir el tratamiento cuando quieras. Si lo decidís, te pedimos que lo hablemos en una sesión de cierre.

**6. Asistencia y cancelaciones**

Si no podés asistir, avisá con al menos {{cancelacion}} horas de anticipación desde la app, así el horario lo puede usar otra persona. Si las ausencias se repiten, lo vamos a hablar para ver juntos si es el momento adecuado para el tratamiento.

**7. Tus derechos**

Podés hacer preguntas sobre el tratamiento en cualquier momento, pedir una derivación a otro profesional, acceder a tus datos y retirar este consentimiento.

Al firmar, declarás que leíste este documento, que pudiste hacer preguntas y que aceptás iniciar el tratamiento y el compromiso de asistir a las primeras {{sesiones}} sesiones.

**Referencias**

- Howard, K. I., Kopta, S. M., Krause, M. S. y Orlinsky, D. E. (1986). The dose-effect relationship in psychotherapy. American Psychologist, 41(2), 159-164.
- Swift, J. K. y Greenberg, R. P. (2012). Premature discontinuation in adult psychotherapy: A meta-analysis. Journal of Consulting and Clinical Psychology, 80(4), 547-559.`;

/** Completa los marcadores {{...}} conocidos; los desconocidos quedan tal cual (así se notan). */
export function renderConsent(template: string, params: Partial<ConsentParams>): string {
  return template.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (match, key: string) => {
    const value = params[key as ConsentPlaceholder];
    return typeof value === "string" && value.trim() ? value : match;
  });
}

/** Número sin ceros de más (12 → "12", 1.5 → "1,5"), como lo lee una persona. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

/** Valores de los marcadores a partir de la configuración (mismo cálculo que hace la base al firmar). */
export function consentParams(
  identity: { professional_name: string; professional_title: string; license: string },
  scheduling: { default_duration_minutes: number; cancel_min_hours: number },
  sessions: number,
): ConsentParams {
  return {
    profesional: identity.professional_name,
    titulo: identity.professional_title,
    matricula: identity.license,
    sesiones: String(sessions),
    duracion: formatNumber(scheduling.default_duration_minutes),
    cancelacion: formatNumber(scheduling.cancel_min_hours),
  };
}

/** Marcadores {{...}} que no existen (para avisar al editar el texto). */
export function unknownPlaceholders(template: string): string[] {
  const known = new Set<string>(CONSENT_PLACEHOLDERS.map((p) => p.key));
  const found = [...template.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1] ?? "");
  return [...new Set(found.filter((key) => !known.has(key)))];
}
