/** Valores por defecto de identidad. Los definitivos se leen de settings (editable desde Configuración). */
export const siteDefaults = {
  platformName: "Psicología Matías Sánchez",
  professionalName: "Lic. Matías Sánchez",
  professionalTitle: "Psicólogo",
  license: "RP 14394-LP",
  country: "Paraguay",
  tagline: "Un espacio para comprender lo que te pasa y trabajar en lo que necesitás.",
  brandSubtitle: "Psicología · Neurociencia aplicada",
  heroTitle: "Terapia desde *donde estés*, con el rigor de una consulta clínica.",
  heroSubtitle: "Acompañamiento psicológico profesional en modalidad virtual, con el mismo marco clínico, ético y basado en evidencia que en consultorio.",
  specialtiesTitle: "Terapia basada en neurociencia aplicada",
  specialties: [
    { title: "Trastornos de ansiedad", text: "Ansiedad generalizada, pánico, fobias y ansiedad social." },
    { title: "Depresión", text: "Depresión mayor, distimia y episodios del estado de ánimo." },
    { title: "Estrés y burnout", text: "Estrés crónico, agotamiento laboral e insomnio." },
    { title: "Trauma y duelo", text: "Estrés postraumático, duelos y procesos de cambio vital." },
  ],
  approachText: "Integración de psicoterapia clínica y neurociencia aplicada, con intervenciones respaldadas por evidencia actualizada.",
  locale: "es-PY",
} as const;

export const patientNav = [
  { href: "/app", label: "Inicio", icon: "home" },
  { href: "/app/ejercicios", label: "Ejercicios", icon: "sparkles" },
  { href: "/app/agenda", label: "Agenda", icon: "calendar" },
  { href: "/app/materiales", label: "Materiales", icon: "library" },
  { href: "/app/perfil", label: "Perfil", icon: "user" },
] as const;

export const adminNav = [
  { href: "/admin", label: "Hoy", icon: "layout-dashboard" },
  { href: "/admin/agenda", label: "Agenda", icon: "calendar" },
  { href: "/admin/pacientes", label: "Pacientes", icon: "users" },
  { href: "/admin/materiales", label: "Materiales", icon: "library" },
  { href: "/admin/ejercicios", label: "Ejercicios", icon: "sparkles" },
  { href: "/admin/planes", label: "Planes", icon: "badge-dollar-sign" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "message-circle" },
  { href: "/admin/actividad", label: "Actividad", icon: "activity" },
  { href: "/admin/configuracion", label: "Configuración", icon: "settings" },
] as const;

export const EMOTIONS = [
  { key: "tranquilo", label: "Tranquilo/a", tone: "calm" },
  { key: "ansioso", label: "Ansioso/a", tone: "alert" },
  { key: "triste", label: "Triste", tone: "low" },
  { key: "enojado", label: "Enojado/a", tone: "hot" },
  { key: "frustrado", label: "Frustrado/a", tone: "hot" },
  { key: "confundido", label: "Confundido/a", tone: "alert" },
  { key: "cansado", label: "Cansado/a", tone: "low" },
  { key: "esperanzado", label: "Esperanzado/a", tone: "calm" },
  { key: "motivado", label: "Motivado/a", tone: "calm" },
] as const;

export type EmotionKey = (typeof EMOTIONS)[number]["key"];

export const emotionLabel = (key: string) => EMOTIONS.find((e) => e.key === key)?.label ?? key;
