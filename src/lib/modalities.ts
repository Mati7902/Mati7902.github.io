/** Cómo se presenta la atención según las modalidades activas en Configuración › Agenda. */
export type ModalityMode = "online" | "presencial" | "mixta";

/** Una lista vacía significa ambas modalidades, igual que al agendar desde la app del paciente. */
export function modalityMode(enabled: readonly string[]): ModalityMode {
  const virtual = enabled.includes("virtual");
  const presencial = enabled.includes("presencial");
  if (virtual && !presencial) return "online";
  if (presencial && !virtual) return "presencial";
  return "mixta";
}

export const MODALITY_COPY: Record<ModalityMode, { label: string; highlight: string; heading: string; intro: string }> = {
  online: {
    label: "Modalidad 100% online",
    highlight: "Sesiones por videollamada",
    heading: "Sesiones por videollamada",
    intro: "Desde donde estés, con el mismo marco clínico que en consultorio.",
  },
  presencial: {
    label: "Atención presencial",
    highlight: "Sesiones en consultorio",
    heading: "Sesiones en consultorio",
    intro: "Un espacio tranquilo y confidencial, con horarios previsibles y el mismo marco clínico en cada encuentro.",
  },
  mixta: {
    label: "Presencial y online",
    highlight: "Presencial y online",
    heading: "Presencial o por videollamada",
    intro: "Elegís la modalidad que mejor se adapte a tu momento. Podés alternar entre ambas según disponibilidad.",
  },
};
