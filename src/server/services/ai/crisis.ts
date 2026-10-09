/**
 * Detección básica de mensajes de crisis por reglas (sin IA).
 * Objetivo: NO hacer psicoterapia automática, sino mostrar de inmediato el protocolo de emergencia
 * configurado por el profesional y derivar. Preferimos falsos positivos a falsos negativos.
 *
 * Es un módulo puro (sin "server-only") para poder testearlo de forma aislada.
 */
export type CrisisCategory = "suicidio" | "autolesion" | "peligro_inmediato" | "violencia" | "intoxicacion" | "sobredosis";

const PATTERNS: { category: CrisisCategory; patterns: RegExp[] }[] = [
  {
    category: "suicidio",
    patterns: [
      /\bsuicid/,
      /\bquitarme la vida\b/,
      /\bmatarme\b/,
      /\b(me )?quiero matar(me)?\b/,
      /\bquisiera (morir|matarme|no despertar)\b/,
      /\bno quiero (seguir )?vivi(r|endo)\b/,
      /\bno quiero (estar|existir) m[aá]s\b/,
      /\bquiero (morir|morirme|desaparecer)\b/,
      /\bmejor (estar[ií]a|ser[ií]a estar) muert[oa]\b/,
      /\bterminar con todo\b/,
      /\bacabar con (todo|mi vida)\b/,
      /\bno le encuentro sentido a (la vida|nada|seguir)\b/,
    ],
  },
  {
    category: "autolesion",
    patterns: [/\bautolesi/, /\bme (corto|cort[eé]|lastim[oé]|quemo|golpeo)\b/, /\bhacerme da[ñn]o\b/, /\blastimarme\b/, /\bcortarme\b/],
  },
  {
    category: "peligro_inmediato",
    patterns: [/\bpeligro\b/, /\bme (va|van) a (matar|lastimar|pegar)\b/, /\bestoy en riesgo\b/, /\bemergencia\b/, /\burgente\b.*\b(ayuda|auxilio)\b/, /\bauxilio\b/, /\bsocorro\b/],
  },
  {
    category: "violencia",
    patterns: [/\bme (pega|peg[oó]|golpea|golpe[oó]|amenaza|amenaz[oó])\b/, /\bviolencia\b/, /\babus(o|a|ó) de m[ií]\b/, /\bme viol/, /\bmaltrat/, /\bvoy a (matar|lastimar) a\b/],
  },
  {
    category: "intoxicacion",
    patterns: [/\bintoxi/, /\btom[eé] (algo|veneno|lavandina|cloro)\b/, /\bme envenen/],
  },
  {
    category: "sobredosis",
    patterns: [/\bsobredosis\b/, /\btom[eé] (muchas|todas las|un mont[oó]n de) pastillas\b/, /\bme tom[eé] (todo el|el) frasco\b/, /\bpastillas\b.*\b(todas|muchas|de m[aá]s)\b/],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type CrisisDetection = { detected: boolean; categories: CrisisCategory[] };

export function detectCrisis(message: string): CrisisDetection {
  const text = normalize(message);
  const categories: CrisisCategory[] = [];
  for (const group of PATTERNS) {
    if (group.patterns.some((p) => p.test(text))) categories.push(group.category);
  }
  return { detected: categories.length > 0, categories };
}

/** Texto de protocolo de emergencia a partir de la configuración y los recursos verificados. */
export function buildCrisisMessage(input: {
  message: string;
  contactNote: string;
  showContactProfessional: boolean;
  resources: { name: string; phone: string | null; url: string | null }[];
  professionalName: string;
}): string {
  const lines = [input.message.trim()];
  const resources = input.resources.filter((r) => r.phone || r.url);
  if (resources.length > 0) {
    lines.push("", "Recursos de ayuda:");
    for (const r of resources) lines.push(`• ${r.name}${r.phone ? `: ${r.phone}` : ""}${r.url ? ` — ${r.url}` : ""}`);
  }
  if (input.showContactProfessional) {
    lines.push("", `Si querés, también le aviso al ${input.professionalName} para que se comunique con vos. ${input.contactNote}`.trim());
  }
  return lines.join("\n");
}
