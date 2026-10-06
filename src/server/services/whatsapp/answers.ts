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

/**
 * Interpreta la respuesta libre a "¿Querés cancelar tu sesión…?".
 * Criterio conservador: solo se cancela ante un sí explícito o un pedido claro de cancelar;
 * confirmar asistencia nunca cuenta como "sí, cancelar".
 */
export function classifyCancelAnswer(text: string, intent: string | null): CancelAnswer {
  const t = normalizeAnswer(text);
  // "no la canceles", "no quiero cancelar", "no cancelar" (pero no "no, cancelala").
  const negatedCancel = /\bno (quiero |vayas a |la |lo )?cancel(ar|es|en)?\b/.test(t);
  const attendance = intent === "CONFIRM_APPOINTMENT" || /\b(confirmo|voy a ir|si voy|asisto|asistire|ahi estare|alli estare|ahi voy a estar)\b/.test(t);
  const wantsChange = intent === "RESCHEDULE_APPOINTMENT" || /\b(cambiar|cambiarla|cambiarlo|reprogram\w*|otro dia|otro horario)\b/.test(t);
  const explicitCancel =
    !negatedCancel && (/\b(cancel\w*|anul\w*)\b/.test(t) || /\bno (voy a )?(poder|puedo) (ir|asistir)\b/.test(t) || intent === "CANCEL_APPOINTMENT");
  const bareYes = /^(si|dale|ok|okay|listo|de acuerdo|claro|correcto|exacto)( (por favor|cancelala|cancelalo|cancela))?$/.test(t);
  const keep = negatedCancel || /^(no|no gracias|mejor no|no por ahora|no no)$/.test(t) || /\b(manten\w*|dejal[ao])\b/.test(t);

  if (wantsChange && !negatedCancel) return "reschedule";
  if (attendance && !explicitCancel) return "confirm_attendance";
  if (keep && !explicitCancel) return "keep";
  if (explicitCancel || bareYes) return "cancel";
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
