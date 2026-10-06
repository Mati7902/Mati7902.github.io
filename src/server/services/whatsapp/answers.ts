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

export type CancelAnswer = "cancel" | "keep" | "confirm_attendance" | "reschedule" | "unclear";

const YES_WORDS = "si|dale|ok|okay|listo|perfecto|de acuerdo|claro|correcto|exacto|bueno";

/**
 * Interpreta la respuesta libre a "¿Querés cancelar tu sesión…?".
 *
 * Se decide por el TEXTO, no por la intención del clasificador: el clasificador no conoce la
 * pregunta y etiqueta un "sí" suelto como CONFIRM_APPOINTMENT, cuando acá significa "sí, cancelar".
 * Criterio: un sí explícito o un pedido claro cancela; una negación del verbo cancelar mantiene;
 * lo ambiguo ("sí, confirmo", "no sé si voy a poder") vuelve a preguntar con botones.
 */
export function classifyCancelAnswer(text: string, intent: string | null): CancelAnswer {
  const t = normalizeAnswer(text);
  if (!t) return "unclear";

  // "no quiero cancelar(la)", "no voy a cancelar", "no la canceles", "no hace falta cancelar".
  // No incluye "no, cancelala" (imperativo afirmativo después de una coma).
  const negatedCancel =
    /\bno (la |lo )?(quiero |deseo |voy a |vamos a |vas a |vayas a |hace falta |hay que |necesito |es necesario )?(cancelar(la|lo)?|cancele[sn]?|anular(la|lo)?|anule[sn]?)\b/.test(t);
  // "no voy a ir", "no voy a poder ir", "no puedo asistir", "no podré llegar".
  const cantGo = /\bno (voy a |vamos a )?(poder |puedo |podre |podria |podemos )?(ir|asistir|llegar|venir)\b/.test(t);
  const cancelWord = /\b(cancel|anul)\w*/.test(t) && !negatedCancel;
  const negatedChange = /\bno (la |lo )?(quiero |hace falta )?(cambiar\w*|reprogram\w*|mover\w*)/.test(t);
  const wantsChange =
    !negatedChange &&
    (/\b(cambiar\w*|reprogram\w*|otro dia|otro horario|otra fecha|otra hora|moverla|moverlo|pasarla|pasarlo)\b/.test(t) ||
      (intent === "RESCHEDULE_APPOINTMENT" && !cancelWord && !cantGo));
  const yesPrefix = new RegExp(`^(${YES_WORDS})\\b`).test(t);
  const bareYes = new RegExp(`^(${YES_WORDS})( (si|por favor|gracias|cancelala|cancelalo|cancela|cancelar))*$`).test(t);
  const attendanceWords = /\b(confirmo|voy a ir|si voy|voy igual|asisto|asistire|ahi estare|alli estare|ahi voy a estar|nos vemos)\b/.test(t);
  const explicitGoing = /\b(voy|asisto|asistire|estare)\b/.test(t);
  // Dudas ("no sé si voy", "capaz", "tal vez"): nunca se toman como confirmación.
  const uncertain = /\b(no se si|no se|no estoy segur[oa]|capaz|tal vez|quizas?|a lo mejor|puede ser|todavia no se)\b/.test(t);
  const keepWords = /^(no|no gracias|mejor no|no por ahora|no no|nop|nah|para nada)$/.test(t) || /\b(manten\w*|dejal[ao]|sigue en pie|que siga)\b/.test(t);

  // Orden explícito: "cancelala", "cancelá", "anulalo".
  const imperativeCancel = /\b(cancela(la|lo|le)?|anula(la|lo)?)\b/.test(t);

  if (negatedCancel) return "keep";
  if (wantsChange) return "reschedule";
  if (uncertain && !imperativeCancel && !cantGo) return "unclear";
  if (cantGo || cancelWord) return "cancel";
  if (bareYes) return "cancel";
  // "Sí, confirmo" puede leerse como "confirmo la cancelación": se vuelve a preguntar.
  if (attendanceWords && !(yesPrefix && !explicitGoing)) return "confirm_attendance";
  if (keepWords) return "keep";
  return "unclear";
}

/**
 * Una derivación es "por crisis" solo si la señal de crisis es posterior (o simultánea) al inicio
 * de la derivación vigente: una crisis ya atendida no convierte en crisis cada derivación futura.
 */
export function isCrisisHandoff(conversation: { crisis_flagged_at: string | null; handed_off_at: string | null }): boolean {
  if (!conversation.crisis_flagged_at || !conversation.handed_off_at) return false;
  return Date.parse(conversation.crisis_flagged_at) >= Date.parse(conversation.handed_off_at);
}
