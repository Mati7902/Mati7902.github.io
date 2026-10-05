// ---------------------------------------------------------------------------
// Tipos generados desde el esquema PostgreSQL con `supabase gen types typescript`.
// Regenerar tras cada migración: pnpm db:types (ver README › Supabase › Tipos).
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appointment_admin_notes": {
                  Row: {
                    "appointment_id": string,"notes": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "appointment_id": string,"notes": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"notes"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_admin_notes_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_admin_notes_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_history": {
                  Row: {
                    "appointment_id": string,"change_source": Database["public"]['Enums']["appointment_source"],"changed_by": string | null,"created_at": string,"id": string,"new_start_time": string | null,"new_status": Database["public"]['Enums']["appointment_status"],"previous_start_time": string | null,"previous_status": Database["public"]['Enums']["appointment_status"] | null,"reason": string | null
                  }
                  Insert: {
                    "appointment_id": string,"change_source"?: Database["public"]['Enums']["appointment_source"],"changed_by"?: string | null,"created_at"?: string,"id"?: string,"new_start_time"?: string | null,"new_status": Database["public"]['Enums']["appointment_status"],"previous_start_time"?: string | null,"previous_status"?: Database["public"]['Enums']["appointment_status"] | null,"reason"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"change_source"?: Database["public"]['Enums']["appointment_source"],"changed_by"?: string | null,"created_at"?: string,"id"?: string,"new_start_time"?: string | null,"new_status"?: Database["public"]['Enums']["appointment_status"],"previous_start_time"?: string | null,"previous_status"?: Database["public"]['Enums']["appointment_status"] | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_history_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "cancellation_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"change_notice_sent_at": string | null,"completed_at": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"end_time": string,"google_event_id": string | null,"google_sync_status": Database["public"]['Enums']["calendar_sync_status"],"google_synced_at": string | null,"id": string,"location": string | null,"modality": Database["public"]['Enums']["appointment_modality"],"patient_id": string,"patient_note": string | null,"plan_id": string | null,"reminder_24h_sent_at": string | null,"reminder_2h_sent_at": string | null,"source": Database["public"]['Enums']["appointment_source"],"start_time": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string,"video_link": string | null
                  }
                  Insert: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"change_notice_sent_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_time": string,"google_event_id"?: string | null,"google_sync_status"?: Database["public"]['Enums']["calendar_sync_status"],"google_synced_at"?: string | null,"id"?: string,"location"?: string | null,"modality"?: Database["public"]['Enums']["appointment_modality"],"patient_id": string,"patient_note"?: string | null,"plan_id"?: string | null,"reminder_24h_sent_at"?: string | null,"reminder_2h_sent_at"?: string | null,"source"?: Database["public"]['Enums']["appointment_source"],"start_time": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string,"video_link"?: string | null
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"change_notice_sent_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_time"?: string,"google_event_id"?: string | null,"google_sync_status"?: Database["public"]['Enums']["calendar_sync_status"],"google_synced_at"?: string | null,"id"?: string,"location"?: string | null,"modality"?: Database["public"]['Enums']["appointment_modality"],"patient_id"?: string,"patient_note"?: string | null,"plan_id"?: string | null,"reminder_24h_sent_at"?: string | null,"reminder_2h_sent_at"?: string | null,"source"?: Database["public"]['Enums']["appointment_source"],"start_time"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string,"video_link"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "therapy_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"ip_address": unknown,"metadata": NonNullable<Json>,"user_agent": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"ip_address"?: unknown,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"ip_address"?: unknown,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"availability_rules": {
                  Row: {
                    "buffer_minutes": number,"created_at": string,"end_time": string,"id": string,"is_active": boolean,"modality": Database["public"]['Enums']["care_modality"],"slot_duration_minutes": number,"start_time": string,"updated_at": string,"valid_from": string | null,"valid_until": string | null,"weekday": number
                  }
                  Insert: {
                    "buffer_minutes"?: number,"created_at"?: string,"end_time": string,"id"?: string,"is_active"?: boolean,"modality"?: Database["public"]['Enums']["care_modality"],"slot_duration_minutes"?: number,"start_time": string,"updated_at"?: string,"valid_from"?: string | null,"valid_until"?: string | null,"weekday": number
                  }
                  Update: {
                    "buffer_minutes"?: number,"created_at"?: string,"end_time"?: string,"id"?: string,"is_active"?: boolean,"modality"?: Database["public"]['Enums']["care_modality"],"slot_duration_minutes"?: number,"start_time"?: string,"updated_at"?: string,"valid_from"?: string | null,"valid_until"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    
                  ]
                },"blocked_slots": {
                  Row: {
                    "created_at": string,"created_by": string | null,"end_time": string,"id": string,"reason": string | null,"start_time": string,"type": Database["public"]['Enums']["block_type"]
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"end_time": string,"id"?: string,"reason"?: string | null,"start_time": string,"type"?: Database["public"]['Enums']["block_type"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"end_time"?: string,"id"?: string,"reason"?: string | null,"start_time"?: string,"type"?: Database["public"]['Enums']["block_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocked_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_integrations": {
                  Row: {
                    "access_token_encrypted": string | null,"calendar_id": string,"channel_expires_at": string | null,"channel_id": string | null,"created_at": string,"external_account_email": string | null,"id": string,"is_active": boolean,"last_error": string | null,"last_synced_at": string | null,"owner_profile_id": string,"provider": string,"refresh_token_encrypted": string | null,"scopes": (string)[],"sync_token": string | null,"token_expires_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "access_token_encrypted"?: string | null,"calendar_id"?: string,"channel_expires_at"?: string | null,"channel_id"?: string | null,"created_at"?: string,"external_account_email"?: string | null,"id"?: string,"is_active"?: boolean,"last_error"?: string | null,"last_synced_at"?: string | null,"owner_profile_id": string,"provider"?: string,"refresh_token_encrypted"?: string | null,"scopes"?: (string)[],"sync_token"?: string | null,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "access_token_encrypted"?: string | null,"calendar_id"?: string,"channel_expires_at"?: string | null,"channel_id"?: string | null,"created_at"?: string,"external_account_email"?: string | null,"id"?: string,"is_active"?: boolean,"last_error"?: string | null,"last_synced_at"?: string | null,"owner_profile_id"?: string,"provider"?: string,"refresh_token_encrypted"?: string | null,"scopes"?: (string)[],"sync_token"?: string | null,"token_expires_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_integrations_owner_profile_id_fkey"
      columns: ["owner_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_sync_log": {
                  Row: {
                    "action": string,"appointment_id": string | null,"created_at": string,"direction": string,"error": string | null,"external_event_id": string | null,"id": string,"integration_id": string | null,"status": string
                  }
                  Insert: {
                    "action": string,"appointment_id"?: string | null,"created_at"?: string,"direction": string,"error"?: string | null,"external_event_id"?: string | null,"id"?: string,"integration_id"?: string | null,"status": string
                  }
                  Update: {
                    "action"?: string,"appointment_id"?: string | null,"created_at"?: string,"direction"?: string,"error"?: string | null,"external_event_id"?: string | null,"id"?: string,"integration_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_sync_log_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_sync_log_integration_id_fkey"
      columns: ["integration_id"]
isOneToOne: false
      referencedRelation: "calendar_integrations"
      referencedColumns: ["id"]
    }
                  ]
                },"chatbot_intents": {
                  Row: {
                    "description": string | null,"examples": (string)[],"is_enabled": boolean,"key": string,"keywords": (string)[],"name": string,"requires_identified_patient": boolean,"response_template": string | null,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "description"?: string | null,"examples"?: (string)[],"is_enabled"?: boolean,"key": string,"keywords"?: (string)[],"name": string,"requires_identified_patient"?: boolean,"response_template"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string | null,"examples"?: (string)[],"is_enabled"?: boolean,"key"?: string,"keywords"?: (string)[],"name"?: string,"requires_identified_patient"?: boolean,"response_template"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"emergency_resources": {
                  Row: {
                    "country": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"phone": string | null,"sort_order": number,"updated_at": string,"url": string | null,"verified_at": string | null
                  }
                  Insert: {
                    "country"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"phone"?: string | null,"sort_order"?: number,"updated_at"?: string,"url"?: string | null,"verified_at"?: string | null
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"phone"?: string | null,"sort_order"?: number,"updated_at"?: string,"url"?: string | null,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"emotional_logs": {
                  Row: {
                    "behavior": string | null,"created_at": string,"emotions": (string)[],"id": string,"intensity": number,"logged_at": string,"need": string | null,"patient_id": string,"situation": string | null,"thought": string | null,"updated_at": string
                  }
                  Insert: {
                    "behavior"?: string | null,"created_at"?: string,"emotions": (string)[],"id"?: string,"intensity": number,"logged_at"?: string,"need"?: string | null,"patient_id": string,"situation"?: string | null,"thought"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "behavior"?: string | null,"created_at"?: string,"emotions"?: (string)[],"id"?: string,"intensity"?: number,"logged_at"?: string,"need"?: string | null,"patient_id"?: string,"situation"?: string | null,"thought"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "emotional_logs_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"completed_at": string | null,"created_at": string,"due_at": string | null,"id": string,"note": string | null,"patient_id": string,"template_id": string
                  }
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"note"?: string | null,"patient_id": string,"template_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"note"?: string | null,"patient_id"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_assignments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_assignments_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "exercise_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_responses": {
                  Row: {
                    "answers": NonNullable<Json>,"assignment_id": string | null,"completed_at": string,"created_at": string,"duration_seconds": number | null,"emotion_after": number | null,"emotion_before": number | null,"id": string,"patient_id": string,"template_id": string
                  }
                  Insert: {
                    "answers"?: NonNullable<Json>,"assignment_id"?: string | null,"completed_at"?: string,"created_at"?: string,"duration_seconds"?: number | null,"emotion_after"?: number | null,"emotion_before"?: number | null,"id"?: string,"patient_id": string,"template_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"assignment_id"?: string | null,"completed_at"?: string,"created_at"?: string,"duration_seconds"?: number | null,"emotion_after"?: number | null,"emotion_before"?: number | null,"id"?: string,"patient_id"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_responses_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "exercise_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_responses_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_responses_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "exercise_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_templates": {
                  Row: {
                    "approach": Database["public"]['Enums']["therapeutic_approach"],"created_at": string,"description": string | null,"estimated_minutes": number | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["exercise_kind"],"slug": string,"sort_order": number,"steps": NonNullable<Json>,"title": string,"updated_at": string
                  }
                  Insert: {
                    "approach"?: Database["public"]['Enums']["therapeutic_approach"],"created_at"?: string,"description"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["exercise_kind"],"slug": string,"sort_order"?: number,"steps"?: NonNullable<Json>,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "approach"?: Database["public"]['Enums']["therapeutic_approach"],"created_at"?: string,"description"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["exercise_kind"],"slug"?: string,"sort_order"?: number,"steps"?: NonNullable<Json>,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"faqs": {
                  Row: {
                    "answer": string,"created_at": string,"id": string,"is_published": boolean,"question": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "answer": string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"question": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"id"?: string,"is_published"?: boolean,"question"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"material_categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"slug": string,"sort_order": number
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"materials": {
                  Row: {
                    "category_id": string | null,"cover_url": string | null,"created_at": string,"created_by": string | null,"description": string | null,"duration_minutes": number | null,"exercise_template_id": string | null,"external_url": string | null,"id": string,"is_published": boolean,"storage_path": string | null,"title": string,"type": Database["public"]['Enums']["material_type"],"updated_at": string,"visibility": Database["public"]['Enums']["material_visibility"]
                  }
                  Insert: {
                    "category_id"?: string | null,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"exercise_template_id"?: string | null,"external_url"?: string | null,"id"?: string,"is_published"?: boolean,"storage_path"?: string | null,"title": string,"type": Database["public"]['Enums']["material_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["material_visibility"]
                  }
                  Update: {
                    "category_id"?: string | null,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"duration_minutes"?: number | null,"exercise_template_id"?: string | null,"external_url"?: string | null,"id"?: string,"is_published"?: boolean,"storage_path"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["material_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["material_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "materials_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "material_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "materials_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "materials_exercise_template_id_fkey"
      columns: ["exercise_template_id"]
isOneToOne: false
      referencedRelation: "exercise_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_templates": {
                  Row: {
                    "body": string,"channel": string,"is_active": boolean,"key": string,"title": string | null,"updated_at": string,"variables": (string)[],"wa_template_language": string | null,"wa_template_name": string | null
                  }
                  Insert: {
                    "body": string,"channel": string,"is_active"?: boolean,"key": string,"title"?: string | null,"updated_at"?: string,"variables"?: (string)[],"wa_template_language"?: string | null,"wa_template_name"?: string | null
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"is_active"?: boolean,"key"?: string,"title"?: string | null,"updated_at"?: string,"variables"?: (string)[],"wa_template_language"?: string | null,"wa_template_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"read_at": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_admin_notes": {
                  Row: {
                    "notes": string,"patient_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "notes": string,"patient_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "notes"?: string,"patient_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_admin_notes_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: true
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_admin_notes_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_materials": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"completed_at": string | null,"id": string,"material_id": string,"note": string | null,"patient_id": string,"viewed_at": string | null
                  }
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"id"?: string,"material_id": string,"note"?: string | null,"patient_id": string,"viewed_at"?: string | null
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"completed_at"?: string | null,"id"?: string,"material_id"?: string,"note"?: string | null,"patient_id"?: string,"viewed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_materials_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_materials_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_materials_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patients": {
                  Row: {
                    "admission_date": string,"birth_date": string | null,"consent_accepted_at": string | null,"consent_version": string | null,"created_at": string,"created_by": string | null,"email": string | null,"emergency_contact_name": string | null,"emergency_contact_phone": string | null,"first_name": string,"guardian_name": string | null,"id": string,"invited_at": string | null,"last_name": string,"modality": Database["public"]['Enums']["care_modality"],"phone": string | null,"profile_id": string | null,"share_records_with_professional": boolean,"status": Database["public"]['Enums']["patient_status"],"updated_at": string,"whatsapp_phone": string | null
                  }
                  Insert: {
                    "admission_date"?: string,"birth_date"?: string | null,"consent_accepted_at"?: string | null,"consent_version"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"first_name": string,"guardian_name"?: string | null,"id"?: string,"invited_at"?: string | null,"last_name": string,"modality"?: Database["public"]['Enums']["care_modality"],"phone"?: string | null,"profile_id"?: string | null,"share_records_with_professional"?: boolean,"status"?: Database["public"]['Enums']["patient_status"],"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Update: {
                    "admission_date"?: string,"birth_date"?: string | null,"consent_accepted_at"?: string | null,"consent_version"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"first_name"?: string,"guardian_name"?: string | null,"id"?: string,"invited_at"?: string | null,"last_name"?: string,"modality"?: Database["public"]['Enums']["care_modality"],"phone"?: string | null,"profile_id"?: string | null,"share_records_with_professional"?: boolean,"status"?: Database["public"]['Enums']["patient_status"],"updated_at"?: string,"whatsapp_phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"first_name": string | null,"full_name": string | null,"id": string,"is_active": boolean,"last_name": string | null,"last_seen_at": string | null,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"two_factor_enabled": boolean,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"first_name"?: string | null,"full_name"?: never,"id": string,"is_active"?: boolean,"last_name"?: string | null,"last_seen_at"?: string | null,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"two_factor_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"first_name"?: string | null,"full_name"?: never,"id"?: string,"is_active"?: boolean,"last_name"?: string | null,"last_seen_at"?: string | null,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"two_factor_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_role_fkey"
      columns: ["role"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["key"]
    }
                  ]
                },"rate_limit_hits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"key": Database["public"]['Enums']["user_role"],"name": string,"permissions": (string)[]
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"key": Database["public"]['Enums']["user_role"],"name": string,"permissions"?: (string)[]
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"key"?: Database["public"]['Enums']["user_role"],"name"?: string,"permissions"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"session_preparations": {
                  Row: {
                    "appointment_id": string,"better": string | null,"created_at": string,"hardest": string | null,"id": string,"important": string | null,"patient_id": string,"practiced": string | null,"submitted_at": string | null,"topics": string | null,"updated_at": string,"week_rating": number | null
                  }
                  Insert: {
                    "appointment_id": string,"better"?: string | null,"created_at"?: string,"hardest"?: string | null,"id"?: string,"important"?: string | null,"patient_id": string,"practiced"?: string | null,"submitted_at"?: string | null,"topics"?: string | null,"updated_at"?: string,"week_rating"?: number | null
                  }
                  Update: {
                    "appointment_id"?: string,"better"?: string | null,"created_at"?: string,"hardest"?: string | null,"id"?: string,"important"?: string | null,"patient_id"?: string,"practiced"?: string | null,"submitted_at"?: string | null,"topics"?: string | null,"updated_at"?: string,"week_rating"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_preparations_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_preparations_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"therapy_plans": {
                  Row: {
                    "created_at": string,"cta_label": string,"cta_type": string,"currency": string,"description": string | null,"duration_minutes": number | null,"features": (string)[],"id": string,"is_active": boolean,"is_featured": boolean,"name": string,"price_amount": number | null,"sessions_included": number | null,"short_description": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"cta_label"?: string,"cta_type"?: string,"currency"?: string,"description"?: string | null,"duration_minutes"?: number | null,"features"?: (string)[],"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"name": string,"price_amount"?: number | null,"sessions_included"?: number | null,"short_description"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"cta_label"?: string,"cta_type"?: string,"currency"?: string,"description"?: string | null,"duration_minutes"?: number | null,"features"?: (string)[],"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"name"?: string,"price_amount"?: number | null,"sessions_included"?: number | null,"short_description"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"whatsapp_contacts": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"last_inbound_at": string | null,"last_outbound_at": string | null,"opted_out": boolean,"patient_id": string | null,"phone": string,"updated_at": string,"wa_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"opted_out"?: boolean,"patient_id"?: string | null,"phone": string,"updated_at"?: string,"wa_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"opted_out"?: boolean,"patient_id"?: string | null,"phone"?: string,"updated_at"?: string,"wa_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_contacts_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_conversations": {
                  Row: {
                    "closed_at": string | null,"contact_id": string,"created_at": string,"crisis_flagged_at": string | null,"current_intent": string | null,"handed_off_at": string | null,"id": string,"last_message_at": string | null,"state": NonNullable<Json>,"status": Database["public"]['Enums']["conversation_status"],"updated_at": string
                  }
                  Insert: {
                    "closed_at"?: string | null,"contact_id": string,"created_at"?: string,"crisis_flagged_at"?: string | null,"current_intent"?: string | null,"handed_off_at"?: string | null,"id"?: string,"last_message_at"?: string | null,"state"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["conversation_status"],"updated_at"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"contact_id"?: string,"created_at"?: string,"crisis_flagged_at"?: string | null,"current_intent"?: string | null,"handed_off_at"?: string | null,"id"?: string,"last_message_at"?: string | null,"state"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["conversation_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_conversations_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "whatsapp_contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_messages": {
                  Row: {
                    "appointment_id": string | null,"body": string | null,"confidence": number | null,"contact_id": string,"conversation_id": string | null,"created_at": string,"direction": Database["public"]['Enums']["message_direction"],"error": string | null,"id": string,"intent": string | null,"kind": string | null,"message_type": string,"payload": Json | null,"sent_at": string | null,"status": Database["public"]['Enums']["message_status"],"wa_message_id": string | null
                  }
                  Insert: {
                    "appointment_id"?: string | null,"body"?: string | null,"confidence"?: number | null,"contact_id": string,"conversation_id"?: string | null,"created_at"?: string,"direction": Database["public"]['Enums']["message_direction"],"error"?: string | null,"id"?: string,"intent"?: string | null,"kind"?: string | null,"message_type"?: string,"payload"?: Json | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"wa_message_id"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"body"?: string | null,"confidence"?: number | null,"contact_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"direction"?: Database["public"]['Enums']["message_direction"],"error"?: string | null,"id"?: string,"intent"?: string | null,"kind"?: string | null,"message_type"?: string,"payload"?: Json | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"wa_message_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_messages_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "whatsapp_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "whatsapp_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_webhook_events": {
                  Row: {
                    "error": string | null,"event_key": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"status": string
                  }
                  Insert: {
                    "error"?: string | null,"event_key": string,"event_type": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"status"?: string
                  }
                  Update: {
                    "error"?: string | null,"event_key"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_monthly_stats":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "cancelled": number,"completed": number,"confirmed": number,"no_show": number,"presencial": number,"requested": number,"total": number,"virtual": number
            }[]
                           },
"admin_popular_hours":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "bookings": number,"hour_label": string
            }[]
                           },
"assert_patient_bookable":
{ Args: { "p_end": string,"p_modality": Database["public"]['Enums']["appointment_modality"],"p_start": string }; Returns: undefined
                           },
"audit_log":
{ Args: { "p_action": string,"p_entity_id"?: string,"p_entity_type"?: string,"p_metadata"?: Json }; Returns: undefined
                           },
"cancel_appointment_tx":
{ Args: { "p_appointment_id": string,"p_reason"?: string,"p_source"?: Database["public"]['Enums']["appointment_source"] }; Returns: {
              "cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"change_notice_sent_at": string | null,
"completed_at": string | null,
"confirmed_at": string | null,
"created_at": string,
"created_by": string | null,
"end_time": string,
"google_event_id": string | null,
"google_sync_status": Database["public"]['Enums']["calendar_sync_status"],
"google_synced_at": string | null,
"id": string,
"location": string | null,
"modality": Database["public"]['Enums']["appointment_modality"],
"patient_id": string,
"patient_note": string | null,
"plan_id": string | null,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"source": Database["public"]['Enums']["appointment_source"],
"start_time": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string,
"video_link": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"cleanup_rate_limits":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"confirm_appointment_tx":
{ Args: { "p_appointment_id": string,"p_source"?: Database["public"]['Enums']["appointment_source"] }; Returns: {
              "cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"change_notice_sent_at": string | null,
"completed_at": string | null,
"confirmed_at": string | null,
"created_at": string,
"created_by": string | null,
"end_time": string,
"google_event_id": string | null,
"google_sync_status": Database["public"]['Enums']["calendar_sync_status"],
"google_synced_at": string | null,
"id": string,
"location": string | null,
"modality": Database["public"]['Enums']["appointment_modality"],
"patient_id": string,
"patient_note": string | null,
"plan_id": string | null,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"source": Database["public"]['Enums']["appointment_source"],
"start_time": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string,
"video_link": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_appointment_tx":
{ Args: { "p_admin_notes"?: string,"p_end": string,"p_location"?: string,"p_modality": Database["public"]['Enums']["appointment_modality"],"p_patient_id": string,"p_patient_note"?: string,"p_plan_id"?: string,"p_source"?: Database["public"]['Enums']["appointment_source"],"p_start": string,"p_status"?: Database["public"]['Enums']["appointment_status"],"p_video_link"?: string }; Returns: {
              "cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"change_notice_sent_at": string | null,
"completed_at": string | null,
"confirmed_at": string | null,
"created_at": string,
"created_by": string | null,
"end_time": string,
"google_event_id": string | null,
"google_sync_status": Database["public"]['Enums']["calendar_sync_status"],
"google_synced_at": string | null,
"id": string,
"location": string | null,
"modality": Database["public"]['Enums']["appointment_modality"],
"patient_id": string,
"patient_note": string | null,
"plan_id": string | null,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"source": Database["public"]['Enums']["appointment_source"],
"start_time": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string,
"video_link": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_patient_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"format_appointment_datetime":
{ Args: { "p_ts": string }; Returns: string
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_bookable_slot":
{ Args: { "p_end": string,"p_modality": Database["public"]['Enums']["appointment_modality"],"p_start": string }; Returns: boolean
                           },
"is_privileged":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"notify_admins":
{ Args: { "p_body": string,"p_data": Json,"p_title": string,"p_type": Database["public"]['Enums']["notification_type"] }; Returns: undefined
                           },
"patient_booking_status":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["appointment_status"]
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"reschedule_appointment_tx":
{ Args: { "p_appointment_id": string,"p_new_end": string,"p_new_start": string,"p_new_status"?: Database["public"]['Enums']["appointment_status"],"p_reason"?: string,"p_source"?: Database["public"]['Enums']["appointment_source"] }; Returns: {
              "cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"change_notice_sent_at": string | null,
"completed_at": string | null,
"confirmed_at": string | null,
"created_at": string,
"created_by": string | null,
"end_time": string,
"google_event_id": string | null,
"google_sync_status": Database["public"]['Enums']["calendar_sync_status"],
"google_synced_at": string | null,
"id": string,
"location": string | null,
"modality": Database["public"]['Enums']["appointment_modality"],
"patient_id": string,
"patient_note": string | null,
"plan_id": string | null,
"reminder_24h_sent_at": string | null,
"reminder_2h_sent_at": string | null,
"source": Database["public"]['Enums']["appointment_source"],
"start_time": string,
"status": Database["public"]['Enums']["appointment_status"],
"updated_at": string,
"video_link": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"setting_value":
{ Args: { "p_key": string }; Returns: Json
                           }
          }
          Enums: {
            "appointment_modality": "presencial"|"virtual","appointment_source": "app"|"admin"|"whatsapp"|"google"|"system","appointment_status": "requested"|"pending"|"confirmed"|"rescheduled"|"cancelled"|"completed"|"no_show","block_type": "block"|"vacation"|"holiday"|"exception","booking_mode": "auto"|"approval","calendar_sync_status": "pending"|"synced"|"failed"|"skipped","care_modality": "presencial"|"virtual"|"mixta","conversation_status": "open"|"handed_off"|"closed","exercise_kind": "thought_record"|"values"|"committed_action"|"defusion"|"dbt_skill"|"breathing"|"grounding"|"mindful_pause"|"custom","material_type": "pdf"|"image"|"audio"|"video"|"link"|"exercise","material_visibility": "public"|"assigned","message_direction": "inbound"|"outbound","message_status": "received"|"queued"|"sent"|"delivered"|"read"|"failed","notification_type": "appointment_requested"|"appointment_confirmed"|"appointment_updated"|"appointment_cancelled"|"appointment_reminder"|"new_material"|"exercise_assigned"|"system","patient_status": "active"|"inactive"|"waiting"|"discharged","therapeutic_approach": "tcc"|"act"|"dbt"|"regulacion"|"general","user_role": "admin"|"professional"|"receptionist"|"guardian"|"patient"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "appointment_modality": ["presencial", "virtual"],"appointment_source": ["app", "admin", "whatsapp", "google", "system"],"appointment_status": ["requested", "pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"],"block_type": ["block", "vacation", "holiday", "exception"],"booking_mode": ["auto", "approval"],"calendar_sync_status": ["pending", "synced", "failed", "skipped"],"care_modality": ["presencial", "virtual", "mixta"],"conversation_status": ["open", "handed_off", "closed"],"exercise_kind": ["thought_record", "values", "committed_action", "defusion", "dbt_skill", "breathing", "grounding", "mindful_pause", "custom"],"material_type": ["pdf", "image", "audio", "video", "link", "exercise"],"material_visibility": ["public", "assigned"],"message_direction": ["inbound", "outbound"],"message_status": ["received", "queued", "sent", "delivered", "read", "failed"],"notification_type": ["appointment_requested", "appointment_confirmed", "appointment_updated", "appointment_cancelled", "appointment_reminder", "new_material", "exercise_assigned", "system"],"patient_status": ["active", "inactive", "waiting", "discharged"],"therapeutic_approach": ["tcc", "act", "dbt", "regulacion", "general"],"user_role": ["admin", "professional", "receptionist", "guardian", "patient"]
          }
        }
} as const
