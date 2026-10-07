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

export function classifyCancelAnswer(text: string, intent: string | null): CancelAnswer {
  const t = normalizeAnswer(text);
  if (!t) return "unclear";
  const parts = clauses(text);
  const first = parts[0] ?? "";

  // Señales de no asistir, evaluadas por cláusula ("No, voy a ir" no es "No voy a ir") y sin
  // condicionales ("si no puedo ir te aviso").
  const cantGo = parts.some(
    (c) =>
      !/\bsi no+ /.test(c) &&
      (/\bno+ (voy a |vamos a )?(poder |puedo |podre |podria |podemos )?(ir|asistir|venir)\b/.test(c) || /\bno+ (asisto|asistire|estare|voy)$/.test(c) || /\bno+ (asisto|asistire|estare)\b/.test(c)),
  );
  // Orden explícita de cancelar ("cancelala", "cancelá", "anulalo", "cancelemos").
  const imperativeCancel = /\b(cancela(la|lo|le)?|cancelemos|anula(la|lo)?)\b/.test(t);
  // "no quiero cancelar(la)", "no voy a cancelar", "no la canceles", "no hace falta que la canceles".
  const negatedCancel =
    /\bno+ (me |la |lo |te )*(quiero |quisiera |queria |deseo |voy a |vamos a |vas a |vayas a |hace falta |hay que |necesito |es necesario |es para )?(que (la |lo )?)?(cancel\w*|anul\w*)/.test(t) &&
    !/\bno+ (cancela(la|lo)?|anula(la|lo)?)\b/.test(t);

  // Cualquier señal clara de no ir u orden de cancelar → botones (nunca "tu turno sigue en pie").
  if ((cantGo || imperativeCancel) && !(negatedCancel && !cantGo && !imperativeCancel)) return "cancel_intent";

  const mistake = /\b(sin querer|por error|me equivoque|equivocacion|toque mal)\b/.test(t);
  const leadingNoThenGoing =
    /^no+( no+)*$/.test(first) && parts.length > 1 && !parts.slice(1).some((c) => /\b(no+|nunca)\b/.test(c)) && /\b(voy|puedo ir|asisto|asistire|estare|mantener|manten\w*)\b/.test(parts.slice(1).join(" "));
  // Por cláusula: "No, la mantengo" mantiene; "no la mantengas" no.
  const negatedKeep = parts.some((c) => /\bno+ (la |lo )?(manten\w*|dejes|dejen)\b/.test(c));
  const keepWords = !negatedKeep && (/^(no+|no gracias|mejor no|no por ahora|no no|nop|nah|para nada)$/.test(t) || /\b(manten\w*|dejal[ao]|sigue en pie)\b/.test(t));
  const negation = /\b(no+|nunca|ni|falt\w*)\b/.test(t);
  const attendance = !negation && /\b(voy a ir|si voy|voy igual|asisto|asistire|ahi estare|alli estare|ahi voy a estar|confirmo que voy|confirmo asistencia|confirmo mi asistencia)\b/.test(t);

  const question = /[?¿]/.test(text) || /\b(hasta cuando|cuanto (tiempo|antes)|se cobra|me cobran|que pasa si|se puede|puedo cancelar)\b/.test(t);
  const negatedChange = /\bno+ (la |lo )?(quiero |hace falta )?(cambiar\w*|reprogram\w*|mover\w*)/.test(t);
  const wantsChange =
    !negatedChange &&
    (/\b(cambiar\w*|reprogram\w*|otro dia|otro horario|otra fecha|otra hora|moverla|moverlo|pasarla|pasarlo)\b/.test(t) || intent === "RESCHEDULE_APPOINTMENT");

  if (negatedCancel || mistake || leadingNoThenGoing || keepWords || attendance) return "keep";
  if (wantsChange) return "reschedule";
  if (question) return "question";
  // Cualquier otra cosa que suene a cancelar o a "sí" pide confirmar con el botón.
  const cancelish = /\b(cancel\w*|anul\w*)\b/.test(t) || negatedKeep;
  const yes = /^(si+|dale|ok|okay|listo|perfecto|de acuerdo|claro|correcto|exacto|bueno)\b/.test(t);
  if (cancelish || yes) return "cancel_intent";
  return "unclear";
}

/** "Sí" escrito sin más contenido (respuesta a una pregunta de sí/no). */
export function isBareYes(text: string): boolean {
  return /^(si+|sii+|dale|ok|okay|listo|perfecto|de acuerdo|claro|bueno|por favor|si por favor|si gracias|avisale|si avisale|dale avisale)$/.test(normalizeAnswer(text));
}

/**
 * Respuesta escrita que solo confirma ("sí", "confirmo", "ahí estaré"), sin nada más que pueda
 * cambiar su sentido. Se usa únicamente cuando lo último enviado fue un pedido de confirmación.
 */
export function isBareConfirm(text: string): boolean {
  const t = normalizeAnswer(text).replace(/\b(gracias|muchas gracias|por favor|porfa)\b/g, "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return isBareYes(t) || /^(si )?(confirmo|confirmado|confirmada|confirmo mi asistencia|confirmo asistencia|confirmo la sesion|voy|si voy|ahi estare|alli estare|ahi voy a estar|nos vemos)$/.test(t);
}

/**
 * Una derivación es "por crisis" solo si la señal de crisis es posterior (o simultánea) al inicio
 * de la derivación vigente: una crisis ya atendida no convierte en crisis cada derivación futura.
 */
export function isCrisisHandoff(conversation: { crisis_flagged_at: string | null; handed_off_at: string | null }): boolean {
  if (!conversation.crisis_flagged_at || !conversation.handed_off_at) return false;
  return Date.parse(conversation.crisis_flagged_at) >= Date.parse(conversation.handed_off_at);
}
