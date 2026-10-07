/**
 * Reglas puras de interpretación de respuestas del chatbot (sin acceso a datos), para poder
 * probarlas por separado. Toda acción que dispare una de estas decisiones se valida igual en el backend.
 */

/** Normaliza texto libre: minúsculas, sin tildes ni signos, espacios simples. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!.,;:¡¿?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identificador estable de un horario ofrecido, derivado de su inicio en UTC ("20261007T2100").
 * No usa ":" (separador de payloads) y no depende de la posición en la lista: un toque en una lista
 * vieja nunca termina reservando otro horario.
 */
export function slotKey(startIso: string): string {
  return new Date(startIso).toISOString().replace(/[-:]/g, "").slice(0, 13);
}

/** Convierte una clave de horario de nuevo en fecha (o null si no tiene el formato esperado). */
export function slotKeyToDate(key: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/.exec(key);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Resultado de interpretar la respuesta escrita a "¿Querés cancelar tu sesión…?".
 * Ninguno ejecuta una acción irreversible: cancelar requiere SIEMPRE tocar el botón
 * "Sí, cancelar" (CANCELYES). El texto libre es ambiguo ("No, voy a ir" pierde la coma al
 * normalizarse y se lee como "No voy a ir"), así que solo decide entre:
 *  - "keep": mantener el turno (no cambia nada),
 *  - "reschedule": iniciar una reprogramación (que igual exige elegir horario),
 *  - "cancel_intent": parece un pedido de cancelar → se muestran los botones para confirmarlo,
 *  - "question": pregunta sobre la política de cancelación → se informa y se vuelve a preguntar,
 *  - "unclear": se vuelve a preguntar con botones.
 */
export type CancelAnswer = "keep" | "reschedule" | "cancel_intent" | "question" | "unclear";

/** Separadores de cláusula que se conservan antes de normalizar ("No, voy a ir" ≠ "No voy a ir"). */
function clauses(text: string): string[] {
  return text
    .split(/[,.;:!?¡¿\n]+/)
    .map((c) => normalizeAnswer(c))
    .filter(Boolean);
}

/*
 * "Mantener" es la única respuesta escrita que se ejecuta sin botón, así que se reconoce por
 * gramática cerrada: TODAS las cláusulas del mensaje tienen que ser frases inequívocas de esta
 * lista. Cualquier otra cosa ("No, la voy a tener que cancelar", "Sí, la reservé por error",
 * "Dejala sin efecto") no mantiene: se vuelve a preguntar con botones.
 */
const NO_CLAUSE = /^(no+( no+)*|nono|nop|nah|para nada|mejor no|no+ gracias|no+ por ahora|no+ por favor|no+ porfa)$/;
const KEEP_CLAUSE =
  /^(la |lo )?(mantengo|mantenemos|mantenela|mantenelo|mantener|mantenerla|mantenerlo|dejala( asi)?|dejalo( asi)?|que siga( en pie| asi)?|sigue en pie|queda( asi)?|no+ (me |te )?(la |lo )?(canceles|cancelo|cancelen)|no+ (quiero|queria|quise|voy a|vamos a) cancelar(la|lo)?|no+ (quiero|hace falta) que (la |lo )?(canceles|cancelen)|no+ la quiero cancelar|no+ hace falta cancelar(la|lo)?)$/;
const ATTEND_CLAUSE =
  /^(si |igual |si igual )?(voy|voy a ir|voy a poder ir|puedo ir|asisto|asistire|estare|ahi estare|alli estare|ahi voy a estar|confirmo que voy|confirmo asistencia|confirmo mi asistencia)( igual| nomas| sin problema)?$/;
const MISTAKE_CLAUSE =
  /^(me equivoque( de boton| de opcion)?|me confundi( de boton)?|toque (cancelar |mal |el boton |ese boton )?(sin querer|por error)|toque mal|le di a cancelar (sin querer|por error)|le di (sin querer|por error)|fue (sin querer|un error)|sin querer|por error)$/;
const YES_FILLER = /^(si+|dale|ok|okay|listo|perfecto|bueno|claro|de acuerdo)$/;
const FILLER_CLAUSE = /^(perdon|disculpa|disculpas|disculpame|gracias|muchas gracias|jaja\w*|uy|ay|ah|igual|si no puedo ir (te |les )?aviso|si no llego (te |les )?aviso|cualquier cosa (te |les )?aviso)$/;

function isKeepMessage(parts: string[]): boolean {
  if (parts.length === 0) return false;
  let decisive = false;
  let mistake = false;
  let yes = false;
  for (const c of parts) {
    if (NO_CLAUSE.test(c) || KEEP_CLAUSE.test(c) || ATTEND_CLAUSE.test(c)) decisive = true;
    else if (MISTAKE_CLAUSE.test(c)) mistake = true;
    else if (YES_FILLER.test(c)) yes = true;
    else if (!FILLER_CLAUSE.test(c)) return false;
  }
  // "Perdón, toqué cancelar sin querer" mantiene; "Sí, me equivoqué" (de día al reservar) no.
  return decisive || (mistake && !yes);
}

export function classifyCancelAnswer(text: string, intent: string | null): CancelAnswer {
  const t = normalizeAnswer(text);
  if (!t) return "unclear";
  const parts = clauses(text);
  if (isKeepMessage(parts)) return "keep";

  // Lo que sigue nunca ejecuta nada: decide qué pregunta o qué botones se muestran.
  const negatedChange = /\bno+ (la |lo )?(quiero |hace falta )?(cambiar\w*|reprogram\w*|mover\w*)/.test(t);
  const wantsChange =
    !negatedChange &&
    (/\b(cambiar\w*|reprogram\w*|otro dia|otro horario|otra fecha|otra hora|moverla|moverlo|pasarla|pasarlo)\b/.test(t) || intent === "RESCHEDULE_APPOINTMENT");
  if (wantsChange) return "reschedule";
  const question = /[?¿]/.test(text) || /\b(hasta cuando|cuanto (tiempo|antes)|se cobra|me cobran|que pasa si|se puede|puedo cancelar)\b/.test(t);
  if (question) return "question";
  const cantGo = parts.some(
    (c) => !/^si no+ /.test(c) && (/\bno+ (voy a |vamos a )?(poder |puedo |podre |podria |podemos )?(ir|asistir|venir)\b/.test(c) || /\bno+ (asisto|asistire|estare|voy)\b/.test(c)),
  );
  const cancelish = /\b(cancel\w*|anul\w*|sin efecto)\b/.test(t) || /\bno+\b.*\b(manten\w*)\b/.test(t);
  const leadingYes = YES_FILLER.test(parts[0] ?? "") || /^(si+|dale|ok|claro|bueno) /.test(parts[0] ?? "");
  if (cantGo || cancelish || (leadingYes && !/^si no+ /.test(parts[0] ?? ""))) return "cancel_intent";
  return "unclear";
}

/** Palabras de cortesía, emojis y repeticiones que no cambian el sentido de un "sí". */
function stripCourtesy(text: string): string {
  return normalizeAnswer(text)
    .replace(/[^a-zñ0-9 ]/g, " ")
    .replace(/\b(por favor|porfa|porfis|plis|please|gracias|muchas gracias|nomas|ya)\b/g, " ")
    .replace(/\b(\w+)( \1\b)+/g, "$1") // "si si" → "si"
    .replace(/\s+/g, " ")
    .trim();
}

const YES_WORDS = "(si+|dale|ok|okay|listo|perfecto|de acuerdo|claro|bueno|obvio|exacto|correcto)";

/** "Sí" escrito sin más contenido a "¿Le aviso al profesional?" / "Avisar al psicólogo". */
export function isBareYes(text: string): boolean {
  const t = stripCourtesy(text);
  if (!t) return false;
  return new RegExp(`^(${YES_WORDS}( quiero| dale)?|${YES_WORDS}? ?(avisale|avisa|avisale al psicologo|avisale al profesional|que me (llame|escriba)( el psicologo| el profesional)?))$`).test(t);
}

/** El texto pide explícitamente que se avise al profesional ("sí, avisale", "que me llame"). */
export function mentionsNotify(text: string): boolean {
  return /\b(avisale|avisa|que me (llame|escriba))\b/.test(stripCourtesy(text));
}

/**
 * Respuesta escrita que solo confirma ("sí", "confirmo", "ahí estaré"), sin nada más que pueda
 * cambiar su sentido. Se usa únicamente cuando lo último enviado fue un pedido de confirmación.
 * Nunca incluye "avisale": eso responde a otra pregunta.
 */
export function isBareConfirm(text: string): boolean {
  const t = stripCourtesy(text);
  if (!t || mentionsNotify(text)) return false;
  return new RegExp(`^(${YES_WORDS}|(si )?(confirmo|confirmado|confirmada|confirmo mi asistencia|confirmo asistencia|confirmo la sesion|voy|si voy|ahi estare|alli estare|ahi voy a estar|nos vemos))$`).test(t);
}

/** "No" escrito sin más contenido. */
export function isBareNo(text: string): boolean {
  return /^(no+|no gracias|mejor no|no hace falta|no por ahora|nop|nah|todavia no)$/.test(stripCourtesy(text));
}

/**
 * El mensaje es solo la elección de una hora ("15", "a las 15:30", "las 3 de la tarde, porfa").
 * "A las 15 no puedo" o "¿tenés algo después de las 17?" no lo son: mencionan una hora pero no la eligen.
 */
export function isBareTimeChoice(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const t = stripCourtesy(text);
  return /^((si|dale|ok|bueno|mejor) )?((a las|las|a la|la de las|el de las|el de la) )?\d{1,2}( \d{2})?( ?(hs|h|hrs|horas))?( de la (manana|tarde|noche))?( (esta bien|me sirve|puede ser|me queda bien))?$/.test(t);
}

/** Habla de cambiar un turno que ya existe ("quiero cambiar mi turno para el 12"). */
export function refersToExistingAppointment(text: string): boolean {
  const t = normalizeAnswer(text);
  return /\breprogram\w*/.test(t) || /\b(cambiar|mover|pasar|correr|adelantar|atrasar)\b.{0,25}\b(mi|el|la|ese|esa)\b.{0,10}\b(turno|sesion|cita|consulta)\b/.test(t);
}

/** Pide una sesión adicional ("quiero sacar otro turno para el viernes"). */
export function asksForAnotherAppointment(text: string): boolean {
  const t = normalizeAnswer(text);
  return /\b(otro|otra|nuevo|nueva|segundo|segunda|adicional)\b.{0,15}\b(turno|sesion|cita|consulta)\b/.test(t) || /\b(turno|sesion|cita|consulta)\b.{0,15}\b(aparte|adicional|mas)\b/.test(t);
}

/** Pide hablar con el profesional ("necesito hablar con el psicólogo", "que me llame Matías"). */
export function asksForProfessional(text: string): boolean {
  const t = normalizeAnswer(text);
  return (
    /\b(hablar|hable|comunicarme|contactar\w*)\b.*\b(psicolog\w*|profesional|licenciad\w*|lic|matias|persona|alguien|humano)\b/.test(t) ||
    /\bque me (llame|escriba|conteste|responda)\b/.test(t) ||
    /\b(avisale|avisa) al (psicolog\w*|profesional|lic\w*)\b/.test(t)
  );
}

/**
 * Una derivación es "por crisis" solo si la señal de crisis es posterior (o simultánea) al inicio
 * de la derivación vigente: una crisis ya atendida no convierte en crisis cada derivación futura.
 */
export function isCrisisHandoff(conversation: { crisis_flagged_at: string | null; handed_off_at: string | null }): boolean {
  if (!conversation.crisis_flagged_at || !conversation.handed_off_at) return false;
  return Date.parse(conversation.crisis_flagged_at) >= Date.parse(conversation.handed_off_at);
}
