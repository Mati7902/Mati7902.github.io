import "server-only";

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { detectCrisis } from "@/server/services/ai/crisis";
import type { AIProvider, ClassifyInput, IntentKey, IntentResult } from "@/server/services/ai/provider";

/**
 * Clasificador por reglas (sin IA). Es el proveedor por defecto y el fallback de los demás.
 * Reconoce palabras clave en español rioplatense/paraguayo, respuestas de botones y fechas relativas.
 */
const KEYWORDS: { intent: IntentKey; patterns: RegExp[]; weight: number }[] = [
  { intent: "CONFIRM_APPOINTMENT", patterns: [/\bconfirm[oa]r?\b/, /\bs[ií]\s*(voy|asisto|estar[eé])\b/, /\bah[ií] (voy|estar[eé])\b/, /^\s*(dale|ok|listo|perfecto|s[ií])\s*[.!]?\s*$/], weight: 0.9 },
  { intent: "CANCEL_APPOINTMENT", patterns: [/\bcancel/, /\bno (voy a )?poder (ir|asistir)/, /\bno (puedo|podre|voy a) (ir|asistir)\b/, /\bno (voy|asisto|asistire)\s*([,.!?]|$)/, /\banular/, /\bsuspender/], weight: 0.85 },
  { intent: "RESCHEDULE_APPOINTMENT", patterns: [/\breprogram/, /\bcambiar (el |mi )?(turno|hora|horario|d[ií]a|sesi[oó]n)/, /\bmover (el |mi )?(turno|sesi[oó]n)/, /\bpasar (el |mi )?turno/, /\botro horario\b/, /\botro d[ií]a\b/], weight: 0.85 },
  { intent: "CHECK_AVAILABILITY", patterns: [/\bdisponib/, /\bten[eé]s (algo|lugar|horario|hora|turno)/, /\bqu[eé] horarios?/, /\bhay (lugar|turno|hora)/, /\bhorarios? libres?/, /\bcu[aá]ndo (pod[eé]s|atend[eé]s)/], weight: 0.8 },
  { intent: "BOOK_APPOINTMENT", patterns: [/\b(sacar|pedir|agendar|reservar|solicitar|coordinar)\s*(un |una )?(turno|cita|hora|sesi[oó]n|consulta)/, /\bquiero (un |una )?(turno|cita|sesi[oó]n|consulta)/, /\bnecesito (un |una )?(turno|cita|sesi[oó]n|consulta)/, /\bprimera (consulta|sesi[oó]n|vez)/, /\bturno\b/], weight: 0.75 },
  { intent: "PRICING", patterns: [/\bprecio/, /\bcu[aá]nto (sale|cuesta|cobr|es)/, /\bvalor\b/, /\bhonorario/, /\bcosto/, /\btarifa/, /\barancel/], weight: 0.85 },
  { intent: "PLANS", patterns: [/\bplan(es)?\b/, /\bpaquete/, /\bmensual/, /\babono/], weight: 0.75 },
  { intent: "LOCATION", patterns: [/\bd[oó]nde (queda|est[aá]|atend)/, /\bdirecci[oó]n/, /\bubicaci[oó]n/, /\bconsultorio\b/, /\bc[oó]mo lleg/], weight: 0.85 },
  { intent: "ONLINE_SESSION", patterns: [/\bonline\b/, /\bvirtual/, /\bvideollamada/, /\bmeet\b/, /\bzoom\b/, /\b(link|enlace)\b/, /\ba distancia\b/], weight: 0.8 },
  { intent: "LOGIN_HELP", patterns: [/\bcontrase[ñn]a/, /\bno puedo (entrar|ingresar|acceder)/, /\b(entrar|ingresar) a la (app|aplicaci[oó]n|plataforma)/, /\busuario\b/, /\bclave\b/, /\bolvid[eé]\b/], weight: 0.85 },
  { intent: "SPEAK_TO_HUMAN", patterns: [/\bhablar con (una persona|alguien|mat[ií]as|el (lic|psic))/, /\bpersona real/, /\bhumano/, /\bque me (llame|escriba) (mat[ií]as|el lic)/, /\batenci[oó]n personal/], weight: 0.85 },
  { intent: "THANKS", patterns: [/^\s*(muchas )?gracias\b/, /\bte agradezco\b/], weight: 0.9 },
  { intent: "GREETING", patterns: [/^\s*(hola|buen(os|as)? ?(d[ií]as?|tardes?|noches?)|buenas|hey|holis)\b[\s!.,]*$/], weight: 0.9 },
];

const CLINICAL_HINTS = /\b(ansiedad|ansios[oa]|depre|deprimid[oa]|triste|angustia|p[aá]nico|ataque|no puedo m[aá]s|llor|miedo|insomnio|no duermo|me siento (mal|solo|sola|vac[ií][oa])|crisis|estr[eé]s|estresad|autoestima|pareja me|mi mam[aá]|mi pap[aá]|me cuesta|no tengo ganas|medicaci[oó]n|pastillas|diagn[oó]stico|s[ií]ntoma)\b/i;

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resuelve expresiones de fecha relativas en español a yyyy-MM-dd (zona operativa). */
export function resolveRelativeDate(text: string, todayDateKey: string, timezone: string): string | null {
  const t = normalize(text);
  const today = new Date(`${todayDateKey}T12:00:00Z`);
  const fmt = (d: Date) => formatInTimeZone(d, "UTC", "yyyy-MM-dd");
  if (/\bhoy\b/.test(t)) return todayDateKey;
  if (/\bpasado manana\b/.test(t)) return fmt(addDays(today, 2));
  if (/\bmanana\b/.test(t)) return fmt(addDays(today, 1));
  const explicit = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    let year = explicit[3] ? Number(explicit[3]) : today.getUTCFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = new Date(Date.UTC(year, month - 1, day, 12));
      if (!explicit[3] && candidate < today) candidate.setUTCFullYear(year + 1);
      return fmt(candidate);
    }
  }
  const todayWeekday = Number(formatInTimeZone(today, timezone, "i")) % 7;
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i]!;
    const re = new RegExp(`\\b(el |este |proximo |la semana que viene el )?${name}\\b`);
    if (re.test(t)) {
      let diff = (i - todayWeekday + 7) % 7;
      if (diff === 0 && !/\bhoy\b/.test(t)) diff = 7;
      if (/semana que viene|proxima semana/.test(t) && diff < 7) diff += 7;
      return fmt(addDays(today, diff));
    }
  }
  if (/\bsemana que viene\b|\bproxima semana\b/.test(t)) return fmt(addDays(today, 7));
  return null;
}

export function resolveTimePreference(text: string): IntentResult["time_preference"] {
  const t = normalize(text);
  if (/\b(manana|temprano|a la manana|por la manana)\b/.test(t) && !/\bmanana\b.*\b(a la|de) tarde\b/.test(t) && /\b(de|a la|por la) manana\b/.test(t)) return "morning";
  if (/\b(tarde|despues del mediodia|siesta)\b/.test(t)) return "afternoon";
  if (/\b(noche|tardecita|despues de las 18|al final del dia)\b/.test(t)) return "evening";
  return null;
}

export function resolveExplicitTime(text: string): string | null {
  const t = normalize(text);
  const m = t.match(/\b(?:a las? )?(\d{1,2})(?::(\d{2}))?\s*(hs|h|horas)?\b/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || minutes > 59) return null;
  if (/\b(tarde|noche)\b/.test(t) && hour < 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function resolveModality(text: string): IntentResult["modality"] {
  const t = normalize(text);
  if (/\b(online|virtual|videollamada|a distancia|por meet|por zoom|remoto)\b/.test(t)) return "virtual";
  if (/\b(presencial|en el consultorio|en persona|ir al consultorio)\b/.test(t)) return "presencial";
  return null;
}

export function classifyByRules(input: ClassifyInput): IntentResult {
  const text = normalize(input.message);
  const crisis = detectCrisis(input.message);
  const matched: { intent: IntentKey; score: number }[] = [];
  for (const rule of KEYWORDS) {
    const hits = rule.patterns.filter((p) => p.test(text)).length;
    if (hits === 0) continue;
    matched.push({ intent: rule.intent, score: Math.min(0.98, rule.weight + (hits - 1) * 0.05) });
  }
  // Prioridades por sentido, no por puntaje: "Gracias por avisar, pero no voy a poder ir" es una
  // cancelación, y "Te confirmo que no voy" no confirma nada.
  const has = (intent: IntentKey) => matched.some((m) => m.intent === intent);
  const candidates = matched.filter(
    (m) =>
      !((m.intent === "THANKS" || m.intent === "GREETING") && matched.some((o) => o.intent !== "THANKS" && o.intent !== "GREETING")) &&
      !(m.intent === "CONFIRM_APPOINTMENT" && (has("CANCEL_APPOINTMENT") || has("RESCHEDULE_APPOINTMENT"))),
  );
  let best: { intent: IntentKey; score: number } = { intent: "OTHER", score: 0 };
  for (const m of candidates) if (m.score > best.score) best = m;
  // Un relato clínico con palabras como "turno" sigue siendo pedido de turno, pero marcamos el contenido.
  const clinical = CLINICAL_HINTS.test(input.message);
  if (best.intent === "OTHER" && clinical) best = { intent: "OTHER", score: 0.6 };
  return {
    intent: best.intent,
    confidence: best.intent === "OTHER" ? Math.max(best.score, 0.3) : best.score,
    requested_date: resolveRelativeDate(input.message, input.todayDateKey, input.timezone),
    time_preference: resolveTimePreference(input.message),
    requested_time: resolveExplicitTime(input.message),
    modality: resolveModality(input.message),
    clinical_content: clinical,
    crisis_signal: crisis.detected,
  };
}

export class RulesProvider implements AIProvider {
  readonly name = "rules";
  async classifyIntent(input: ClassifyInput): Promise<IntentResult> {
    return classifyByRules(input);
  }
}
