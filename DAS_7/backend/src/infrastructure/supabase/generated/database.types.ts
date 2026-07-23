export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  insight: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_id: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_id: string
          metadata?: Json
          occurred_at: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_id?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          body: string
          created_at: string
          notification_id: string
          parent_id: string
          provider_message_id: string | null
          recipient_email: string
          sent: boolean
          sent_at: string | null
          student_id: string
          subject: string
          summary_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          notification_id: string
          parent_id: string
          provider_message_id?: string | null
          recipient_email: string
          sent?: boolean
          sent_at?: string | null
          student_id: string
          subject: string
          summary_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          notification_id?: string
          parent_id?: string
          provider_message_id?: string | null
          recipient_email?: string
          sent?: boolean
          sent_at?: string | null
          student_id?: string
          subject?: string
          summary_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_parent_student_fkey"
            columns: ["parent_id", "student_id"]
            isOneToOne: false
            referencedRelation: "parent_students"
            referencedColumns: ["parent_id", "student_id"]
          },
          {
            foreignKeyName: "email_notifications_summary_student_fkey"
            columns: ["summary_id", "student_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["summary_id", "student_id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          failed_at: string | null
          idempotency_key: string
          operation: string
          request_hash: string
          response_body: Json | null
          response_status: number | null
          scope: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at: string
          failed_at?: string | null
          idempotency_key: string
          operation: string
          request_hash: string
          response_body?: Json | null
          response_status?: number | null
          scope: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          failed_at?: string | null
          idempotency_key?: string
          operation?: string
          request_hash?: string
          response_body?: Json | null
          response_status?: number | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      notification_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          email_notification_id: string | null
          failed_at: string | null
          job_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          parent_id: string
          retry_at: string | null
          scheduled_for: string
          status: string
          student_id: string
          summary_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          email_notification_id?: string | null
          failed_at?: string | null
          job_id: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          parent_id: string
          retry_at?: string | null
          scheduled_for: string
          status?: string
          student_id: string
          summary_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          email_notification_id?: string | null
          failed_at?: string | null
          job_id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          parent_id?: string
          retry_at?: string | null
          scheduled_for?: string
          status?: string
          student_id?: string
          summary_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_email_fkey"
            columns: [
              "email_notification_id",
              "parent_id",
              "student_id",
              "summary_id",
            ]
            isOneToOne: false
            referencedRelation: "email_notifications"
            referencedColumns: [
              "notification_id",
              "parent_id",
              "student_id",
              "summary_id",
            ]
          },
          {
            foreignKeyName: "notification_jobs_parent_student_fkey"
            columns: ["parent_id", "student_id"]
            isOneToOne: false
            referencedRelation: "parent_students"
            referencedColumns: ["parent_id", "student_id"]
          },
          {
            foreignKeyName: "notification_jobs_summary_student_fkey"
            columns: ["summary_id", "student_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["summary_id", "student_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          parent_id: string
          recipient_email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency: string
          parent_id: string
          recipient_email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          parent_id?: string
          recipient_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_parent_fkey"
            columns: ["parent_id"]
            isOneToOne: true
            referencedRelation: "parent_profiles"
            referencedColumns: ["parent_id"]
          },
        ]
      }
      parent_profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          name: string
          parent_id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          name: string
          parent_id: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          name?: string
          parent_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          assigned_at: string
          parent_id: string
          student_id: string
        }
        Insert: {
          assigned_at?: string
          parent_id: string
          student_id: string
        }
        Update: {
          assigned_at?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["parent_id"]
          },
          {
            foreignKeyName: "parent_students_student_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["student_id"]
          },
        ]
      }
      progress_records: {
        Row: {
          assessment_date: string
          correction_reason: string | null
          created_at: string
          notes: string
          progress_version: number
          record_id: string
          score: number
          skill_area: string
          source_record_id: string
          source_revision: number
          source_system: string
          student_id: string
          supersedes_record_id: string | null
        }
        Insert: {
          assessment_date: string
          correction_reason?: string | null
          created_at?: string
          notes?: string
          progress_version: number
          record_id: string
          score: number
          skill_area: string
          source_record_id: string
          source_revision?: number
          source_system: string
          student_id: string
          supersedes_record_id?: string | null
        }
        Update: {
          assessment_date?: string
          correction_reason?: string | null
          created_at?: string
          notes?: string
          progress_version?: number
          record_id?: string
          score?: number
          skill_area?: string
          source_record_id?: string
          source_revision?: number
          source_system?: string
          student_id?: string
          supersedes_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_records_student_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "progress_records_supersedes_fkey"
            columns: ["supersedes_record_id"]
            isOneToOne: false
            referencedRelation: "progress_records"
            referencedColumns: ["record_id"]
          },
        ]
      }
      recommendations: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          generation_metadata: Json
          model: string | null
          prompt_version: string | null
          provider: string | null
          provider_request_id: string | null
          recommendation_id: string
          student_id: string
          summary_id: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_at: string
          generation_metadata?: Json
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          recommendation_id: string
          student_id: string
          summary_id: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          generation_metadata?: Json
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          recommendation_id?: string
          student_id?: string
          summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_summary_student_fkey"
            columns: ["summary_id", "student_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["summary_id", "student_id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          band_level: string
          created_at: string
          current_progress_version: number
          date_of_birth: string
          name: string
          student_id: string
          updated_at: string
        }
        Insert: {
          band_level: string
          created_at?: string
          current_progress_version?: number
          date_of_birth: string
          name: string
          student_id: string
          updated_at?: string
        }
        Update: {
          band_level?: string
          created_at?: string
          current_progress_version?: number
          date_of_birth?: string
          name?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      summaries: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          generation_metadata: Json
          model: string | null
          prompt_version: string | null
          provider: string | null
          provider_request_id: string | null
          source_progress_version: number
          student_id: string
          summary_id: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_at: string
          generation_metadata?: Json
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          source_progress_version: number
          student_id: string
          summary_id: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          generation_metadata?: Json
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          source_progress_version?: number
          student_id?: string
          summary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_student_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["student_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _write_progress_record: {
        Args: {
          p_action: string
          p_actor_subject: string
          p_assessment_date: string
          p_correction_reason: string
          p_event_id: string
          p_expires_at: string
          p_idempotency_key: string
          p_notes: string
          p_operation: string
          p_record_id: string
          p_request_hash: string
          p_scope: string
          p_score: number
          p_skill_area: string
          p_source_record_id: string
          p_source_revision: number
          p_source_system: string
          p_student_id: string
          p_supersedes_record_id: string
        }
        Returns: Json
      }
      claim_notification_jobs: {
        Args: {
          p_lease_expires_at: string
          p_lease_owner: string
          p_limit: number
          p_now: string
        }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          email_notification_id: string | null
          failed_at: string | null
          job_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          parent_id: string
          retry_at: string | null
          scheduled_for: string
          status: string
          student_id: string
          summary_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_notification_job: {
        Args: {
          p_completed_at: string
          p_job_id: string
          p_lease_owner: string
        }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          email_notification_id: string | null
          failed_at: string | null
          job_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          parent_id: string
          retry_at: string | null
          scheduled_for: string
          status: string
          student_id: string
          summary_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_progress_record: {
        Args: {
          p_actor_subject: string
          p_assessment_date: string
          p_correction_reason: string
          p_event_id: string
          p_expires_at: string
          p_idempotency_key: string
          p_notes: string
          p_operation: string
          p_record_id: string
          p_request_hash: string
          p_scope: string
          p_score: number
          p_skill_area: string
          p_source_record_id: string
          p_source_revision: number
          p_source_system: string
          p_student_id: string
          p_supersedes_record_id: string
        }
        Returns: Json
      }
      fail_notification_job: {
        Args: {
          p_failed_at: string
          p_job_id: string
          p_lease_owner: string
          p_reason: string
          p_retry_at: string
        }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          email_notification_id: string | null
          failed_at: string | null
          job_id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          parent_id: string
          retry_at: string | null
          scheduled_for: string
          status: string
          student_id: string
          summary_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      insert_progress_record: {
        Args: {
          p_actor_subject: string
          p_assessment_date: string
          p_event_id: string
          p_expires_at: string
          p_idempotency_key: string
          p_notes: string
          p_operation: string
          p_record_id: string
          p_request_hash: string
          p_scope: string
          p_score: number
          p_skill_area: string
          p_source_record_id: string
          p_source_revision: number
          p_source_system: string
          p_student_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  insight: {
    Enums: {},
  },
} as const
