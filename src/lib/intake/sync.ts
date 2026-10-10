import type { ContactValue, IntakeAnswers } from "@/lib/intake/form";
import type { Patient } from "@/types/domain";

type SyncSource = Pick<Patient, "birth_date" | "phone" | "emergency_contact_name" | "emergency_contact_phone">;
export type SyncedFields = Partial<SyncSource>;

/** Compara respuestas sin depender del orden de las claves (jsonb las reordena). */
function sameAnswer(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): string =>
    v && typeof v === "object" ? JSON.stringify(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y))) : JSON.stringify(v ?? null);
  return stable(a) === stable(b);
}

/**
 * Datos personales de la ficha que también viven en la ficha administrativa: si el paciente los
 * cambia en este guardado, se actualizan ahí (la fecha de nacimiento decide qué cuadernillo ve).
 * Solo cuenta lo que cambió respecto de lo que ya tenía guardado en la ficha: así un valor viejo
 * no pisa una corrección posterior hecha en el perfil o por el profesional. Lo que queda en
 * blanco no borra lo cargado, y el contacto de emergencia se actualiza entero (nombre y teléfono
 * juntos) para no dejar el teléfono de otra persona.
 */
export function patientUpdates(patient: SyncSource, answers: IntakeAnswers, previous: IntakeAnswers | null): SyncedFields {
  const changed = (key: string) => previous === null || !sameAnswer(answers[key], previous[key]);
  const updates: SyncedFields = {};
  const birth = typeof answers.fecha_nacimiento === "string" ? answers.fecha_nacimiento : null;
  if (birth && changed("fecha_nacimiento") && birth !== patient.birth_date?.slice(0, 10)) updates.birth_date = birth;
  const phone = typeof answers.telefono === "string" ? answers.telefono : null;
  if (phone && changed("telefono") && phone !== patient.phone) updates.phone = phone;
  const contact = answers.contacto_emergencia as ContactValue | undefined;
  if (contact && (contact.nombre || contact.telefono) && changed("contacto_emergencia")) {
    const name = contact.nombre ?? null;
    const contactPhone = contact.telefono ?? null;
    if (name !== patient.emergency_contact_name || contactPhone !== patient.emergency_contact_phone) {
      updates.emergency_contact_name = name;
      updates.emergency_contact_phone = contactPhone;
    }
  }
  return updates;
}
