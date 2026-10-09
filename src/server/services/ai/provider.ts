import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { createLogger, errorMeta } from "@/lib/logger";

const log = createLogger("ai");

/**
 * Capa de IA independiente del proveedor. La IA SOLO interpreta lenguaje natural y devuelve
 * JSON estructurado validado con Zod. Nunca ejecuta acciones: el backend valida y decide.
 */
export const INTENT_KEYS = [
  "BOOK_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CONFIRM_APPOINTMENT",
  "CHECK_AVAILABILITY",
  "PRICING",
  "PLANS",
  "LOCATION",
  "ONLINE_SESSION",
  "LOGIN_HELP",
  "SPEAK_TO_HUMAN",
  "GREETING",
  "THANKS",
  "OTHER",
] as const;

export type IntentKey = (typeof INTENT_KEYS)[number];

export const intentResultSchema = z.object({
  intent: z.enum(INTENT_KEYS),
  confidence: z.number().min(0).max(1),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  time_preference: z.enum(["morning", "afternoon", "evening", "any"]).nullable().optional(),
  requested_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  modality: z.enum(["presencial", "virtual"]).nullable().optional(),
  /** Señal de que el mensaje contiene contenido clínico/emocional fuera del alcance administrativo. */
  clinical_content: z.boolean().optional().default(false),
  /** Señal de posible crisis (se combina con la detección por reglas; nunca se confía solo en la IA). */
  crisis_signal: z.boolean().optional().default(false),
});

export type IntentResult = z.infer<typeof intentResultSchema>;

export type ClassifyInput = {
  message: string;
  /** Contexto mínimo: fecha de hoy en la zona operativa y últimos turnos de la conversación. */
  todayDateKey: string;
  timezone: string;
  recentMessages?: { role: "user" | "assistant"; text: string }[];
  activeFlow?: string | null;
};

export interface AIProvider {
  readonly name: string;
  classifyIntent(input: ClassifyInput): Promise<IntentResult>;
}

export const SYSTEM_PROMPT = `Sos el clasificador de intenciones de la asistente administrativa (secretaria virtual) de un consultorio de psicología en Paraguay.
Tu única tarea es interpretar el mensaje del usuario y devolver un JSON con la intención administrativa.
No respondés al usuario, no diagnosticás, no das consejos. Solo clasificás.

Intenciones posibles: ${INTENT_KEYS.join(", ")}.
- BOOK_APPOINTMENT: quiere agendar/sacar un turno nuevo.
- RESCHEDULE_APPOINTMENT: quiere cambiar la fecha/hora de un turno que ya tiene.
- CANCEL_APPOINTMENT: quiere cancelar un turno.
- CONFIRM_APPOINTMENT: confirma que asistirá (“confirmo”, “sí voy”, “dale”).
- CHECK_AVAILABILITY: pregunta por horarios disponibles.
- PRICING: pregunta precios / honorarios / costo.
- PLANS: pregunta por planes o paquetes de sesiones.
- LOCATION: pregunta dónde queda / dirección.
- ONLINE_SESSION: pregunta por atención virtual o pide el enlace de videollamada.
- LOGIN_HELP: no puede entrar a la app / olvidó la contraseña.
- SPEAK_TO_HUMAN: pide hablar con el profesional o con una persona.
- GREETING: solo saluda. THANKS: solo agradece.
- OTHER: cualquier otra cosa, incluidos relatos personales o emocionales.

Fechas: resolvé expresiones relativas (“mañana”, “el martes”, “la semana que viene”) a formato YYYY-MM-DD usando la fecha de hoy que se indica. Si no hay fecha, null.
time_preference: morning (antes de 12), afternoon (12–18), evening (después de 18) o any/null.
clinical_content: true si el usuario describe síntomas, emociones intensas, problemas personales o pide ayuda psicológica.
crisis_signal: true si hay mención de suicidio, autolesión, peligro inmediato, violencia, intoxicación o sobredosis.
Respondé ÚNICAMENTE con JSON válido, sin texto adicional.`;

export function buildUserPrompt(input: ClassifyInput): string {
  const history = (input.recentMessages ?? [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.text}`)
    .join("\n");
  return [
    `Hoy es ${input.todayDateKey} (zona ${input.timezone}).`,
    input.activeFlow ? `Flujo activo en la conversación: ${input.activeFlow}.` : null,
    history ? `Contexto reciente:\n${history}` : null,
    `Mensaje a clasificar:\n"""${input.message.slice(0, 1500)}"""`,
    `Devolvé el JSON con las claves: intent, confidence, requested_date, time_preference, requested_time, modality, clinical_content, crisis_signal.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Extrae el primer objeto JSON de una respuesta de modelo y lo valida. */
export function parseIntentJson(raw: string): IntentResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = intentResultSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

let cached: AIProvider | null = null;

/** Devuelve el proveedor configurado (AI_PROVIDER). Siempre existe al menos el de reglas. */
export async function getAIProvider(): Promise<AIProvider> {
  if (cached) return cached;
  const env = getServerEnv();
  const { RulesProvider } = await import("@/server/services/ai/rules");
  const fallback = new RulesProvider();
  if (env.AI_PROVIDER === "rules" || !env.AI_PROVIDER_API_KEY) {
    cached = fallback;
    return cached;
  }
  try {
    if (env.AI_PROVIDER === "anthropic") {
      const { AnthropicProvider } = await import("@/server/services/ai/anthropic");
      cached = withFallback(new AnthropicProvider(env.AI_PROVIDER_API_KEY, env.AI_MODEL), fallback);
    } else {
      const { OpenAIProvider } = await import("@/server/services/ai/openai");
      cached = withFallback(new OpenAIProvider(env.AI_PROVIDER_API_KEY, env.AI_MODEL), fallback);
    }
  } catch (error) {
    log.warn("No se pudo inicializar el proveedor de IA; se usan reglas", errorMeta(error));
    cached = fallback;
  }
  return cached;
}

/** Si el proveedor remoto falla o devuelve JSON inválido, degradamos a reglas sin romper el flujo. */
function withFallback(primary: AIProvider, fallback: AIProvider): AIProvider {
  return {
    name: `${primary.name}+rules`,
    async classifyIntent(input) {
      try {
        const result = await primary.classifyIntent(input);
        const rules = await fallback.classifyIntent(input);
        // Las reglas tienen prioridad para señales de crisis y respuestas de botones.
        return { ...result, crisis_signal: result.crisis_signal || rules.crisis_signal };
      } catch (error) {
        log.warn(`Proveedor ${primary.name} falló; fallback a reglas`, errorMeta(error));
        return fallback.classifyIntent(input);
      }
    },
  };
}
