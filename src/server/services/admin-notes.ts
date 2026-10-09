import "server-only";

import { fromDatabaseError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Notas administrativas del profesional (pagos, horarios preferidos, derivación).
 * Viven en tablas separadas con RLS solo para administradores: el paciente puede leer su
 * ficha y sus turnos, pero nunca estas notas.
 */
type NoteTarget = { kind: "patient"; id: string } | { kind: "appointment"; id: string };

export async function saveAdminNote(client: ServerSupabaseClient, target: NoteTarget, notes: string | null | undefined, userId: string) {
  const text = notes?.trim() ?? "";
  if (target.kind === "patient") {
    const { error } = text
      ? await client.from("patient_admin_notes").upsert({ patient_id: target.id, notes: text, updated_by: userId }, { onConflict: "patient_id" })
      : await client.from("patient_admin_notes").delete().eq("patient_id", target.id);
    if (error) throw fromDatabaseError(error, "No pudimos guardar la nota administrativa.");
    return;
  }
  const { error } = text
    ? await client.from("appointment_admin_notes").upsert({ appointment_id: target.id, notes: text, updated_by: userId }, { onConflict: "appointment_id" })
    : await client.from("appointment_admin_notes").delete().eq("appointment_id", target.id);
  if (error) throw fromDatabaseError(error, "No pudimos guardar la nota administrativa.");
}

export async function getPatientAdminNote(client: ServerSupabaseClient, patientId: string): Promise<string | null> {
  const { data } = await client.from("patient_admin_notes").select("notes").eq("patient_id", patientId).maybeSingle();
  return data?.notes ?? null;
}
