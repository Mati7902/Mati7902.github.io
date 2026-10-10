import type { Database } from "@/types/database";

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type Appointment = Tables<"appointments">;
export type AppointmentStatus = Enums<"appointment_status">;
export type AppointmentModality = Enums<"appointment_modality">;
export type AppointmentSource = Enums<"appointment_source">;
export type Patient = Tables<"patients">;
export type Profile = Tables<"profiles">;
export type Material = Tables<"materials">;
export type MaterialCategory = Tables<"material_categories">;
export type PatientMaterial = Tables<"patient_materials">;
export type ExerciseTemplate = Tables<"exercise_templates">;
export type ExerciseAssignment = Tables<"exercise_assignments">;
export type ExerciseResponse = Tables<"exercise_responses">;
export type EmotionalLog = Tables<"emotional_logs">;
export type TherapyPlan = Tables<"therapy_plans">;
export type Notification = Tables<"notifications">;
export type AvailabilityRule = Tables<"availability_rules">;
export type BlockedSlot = Tables<"blocked_slots">;
export type SessionPreparation = Tables<"session_preparations">;
export type PatientIntake = Tables<"patient_intakes">;
export type Faq = Tables<"faqs">;
export type EmergencyResource = Tables<"emergency_resources">;
export type WhatsAppContact = Tables<"whatsapp_contacts">;
export type WhatsAppConversation = Tables<"whatsapp_conversations">;
export type WhatsAppMessage = Tables<"whatsapp_messages">;
export type AuditLog = Tables<"audit_logs">;

export type AppointmentWithPatient = Appointment & {
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "phone" | "whatsapp_phone" | "email" | "profile_id"> | null;
  /** Solo presente en consultas del profesional (RLS la oculta al paciente). */
  appointment_admin_notes?: { notes: string } | null;
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Solicitado",
  pending: "Pendiente de confirmación",
  confirmed: "Confirmado",
  rescheduled: "Reprogramado",
  cancelled: "Cancelado",
  completed: "Completado",
  no_show: "Ausente",
};

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, "default" | "soft" | "success" | "warning" | "info" | "destructive" | "muted"> = {
  requested: "warning",
  pending: "info",
  confirmed: "success",
  rescheduled: "warning",
  cancelled: "destructive",
  completed: "muted",
  no_show: "destructive",
};

export const MODALITY_LABEL: Record<AppointmentModality, string> = {
  presencial: "Presencial",
  virtual: "Videoconsulta",
};

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["requested", "pending", "confirmed", "rescheduled"];
