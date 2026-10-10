/** Nombres legibles de las acciones de auditoría (el código técnico se conserva como respaldo). */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Inicio de sesión",
  "auth.sign_out": "Cierre de sesión",
  "auth.password_changed": "Cambio de contraseña",
  "auth.password_updated": "Contraseña restablecida",
  "auth.invitation_completed": "Invitación aceptada",
  "auth.consent_accepted": "Términos aceptados",
  "appointment.requested": "Turno solicitado",
  "appointment.created_by_admin": "Turno creado por el profesional",
  "appointment.confirmed_by_patient": "Turno confirmado por el paciente",
  "appointment.cancelled_by_admin": "Turno cancelado por el profesional",
  "appointment.cancelled_by_patient": "Turno cancelado por el paciente",
  "appointment.rescheduled_by_admin": "Turno reprogramado por el profesional",
  "appointment.rescheduled_by_patient": "Turno reprogramado por el paciente",
  "appointment.details_updated": "Datos del turno actualizados",
  "availability.rule_saved": "Disponibilidad guardada",
  "availability.rule_deleted": "Disponibilidad eliminada",
  "availability.block_created": "Horario bloqueado",
  "availability.block_deleted": "Bloqueo eliminado",
  "patient.invited": "Paciente invitado",
  "patient.intake_submitted": "Ficha de ingreso enviada",
  "patient.intake_viewed": "Ficha de ingreso consultada",
  "material.assigned": "Material asignado",
  "material.deleted": "Material eliminado",
  "exercise.assigned": "Ejercicio sugerido",
  "plan.deleted": "Plan eliminado",
  "settings.updated": "Configuración actualizada",
  "emergency_resource.saved": "Recurso de emergencia guardado",
  "notification_template.updated": "Plantilla de mensaje actualizada",
  "integration.google_connected": "Google Calendar conectado",
  "integration.google_disconnected": "Google Calendar desconectado",
  "whatsapp.conversation_resumed": "Asistente de WhatsApp reactivada",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
