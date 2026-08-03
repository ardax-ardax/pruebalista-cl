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
  public: {
    Tables: {
      admin_course_subjects: {
        Row: {
          course_id: string
          id: string
          subject_label: string
          subject_value: string
        }
        Insert: {
          course_id: string
          id?: string
          subject_label: string
          subject_value: string
        }
        Update: {
          course_id?: string
          id?: string
          subject_label?: string
          subject_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_course_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_admin_course_subjects_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_courses: {
        Row: {
          colegio_id: string | null
          created_at: string
          created_by: string | null
          grade_value: string
          id: string
          label: string
          level: string
          sort_order: number
        }
        Insert: {
          colegio_id?: string | null
          created_at?: string
          created_by?: string | null
          grade_value: string
          id?: string
          label: string
          level?: string
          sort_order?: number
        }
        Update: {
          colegio_id?: string | null
          created_at?: string
          created_by?: string | null
          grade_value?: string
          id?: string
          label?: string
          level?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_courses_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_subjects: {
        Row: {
          created_at: string
          id: string
          levels: string[]
          sort_order: number
          subject_label: string
          subject_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          levels?: string[]
          sort_order?: number
          subject_label: string
          subject_value: string
        }
        Update: {
          created_at?: string
          id?: string
          levels?: string[]
          sort_order?: number
          subject_label?: string
          subject_value?: string
        }
        Relationships: []
      }
      ai_generation_log: {
        Row: {
          created_at: string
          id: string
          oa_code: string | null
          question_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          oa_code?: string | null
          question_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          oa_code?: string | null
          question_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          allow_self_assignment: boolean
          hide_credits_from_teachers: boolean
          id: boolean
          institution_logo: string | null
          institution_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_self_assignment?: boolean
          hide_credits_from_teachers?: boolean
          id?: boolean
          institution_logo?: string | null
          institution_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_self_assignment?: boolean
          hide_credits_from_teachers?: boolean
          id?: boolean
          institution_logo?: string | null
          institution_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          created_at: string
          data: Json
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          utp_feedback: string | null
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          utp_feedback?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          utp_feedback?: string | null
        }
        Relationships: []
      }
      colegios: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          nombre: string
          plan_billing_cycle: string | null
          plan_expires_at: string | null
          seats_purchased: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          plan_billing_cycle?: string | null
          plan_expires_at?: string | null
          seats_purchased?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          plan_billing_cycle?: string | null
          plan_expires_at?: string | null
          seats_purchased?: number
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          colegio_id: string | null
          created_at: string
          id: string
          level: string
          name: string
          updated_at: string
        }
        Insert: {
          colegio_id?: string | null
          created_at?: string
          id?: string
          level: string
          name: string
          updated_at?: string
        }
        Update: {
          colegio_id?: string | null
          created_at?: string
          id?: string
          level?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_base: {
        Row: {
          created_at: string
          curriculum_decree: string | null
          curriculum_period: string | null
          eje: string | null
          extracted_at: string
          grade_value: string
          id: string
          indicators: Json
          is_current: boolean
          oa_code: string
          oa_description: string
          source_url: string | null
          subject_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          curriculum_decree?: string | null
          curriculum_period?: string | null
          eje?: string | null
          extracted_at?: string
          grade_value: string
          id?: string
          indicators?: Json
          is_current?: boolean
          oa_code: string
          oa_description: string
          source_url?: string | null
          subject_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          curriculum_decree?: string | null
          curriculum_period?: string | null
          eje?: string | null
          extracted_at?: string
          grade_value?: string
          id?: string
          indicators?: Json
          is_current?: boolean
          oa_code?: string
          oa_description?: string
          source_url?: string | null
          subject_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      flow_payment_orders: {
        Row: {
          amount_clp: number
          billing_cycle: string
          colegio_id: string | null
          commerce_order: string
          created_at: string
          flow_env: string
          flow_order: string | null
          flow_token: string | null
          id: string
          metadata: Json
          paid_at: string | null
          plan_id: string
          seats: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_clp: number
          billing_cycle: string
          colegio_id?: string | null
          commerce_order: string
          created_at?: string
          flow_env?: string
          flow_order?: string | null
          flow_token?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          plan_id: string
          seats?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_clp?: number
          billing_cycle?: string
          colegio_id?: string | null
          commerce_order?: string
          created_at?: string
          flow_env?: string
          flow_order?: string | null
          flow_token?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          plan_id?: string
          seats?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_payment_orders_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          ai_disabled_reason: string | null
          ai_enabled: boolean
          default_free_credits: number
          enable_payments: boolean
          id: boolean
          maintenance_mode: boolean
          show_institutional_landing: boolean
          updated_at: string
        }
        Insert: {
          ai_disabled_reason?: string | null
          ai_enabled?: boolean
          default_free_credits?: number
          enable_payments?: boolean
          id?: boolean
          maintenance_mode?: boolean
          show_institutional_landing?: boolean
          updated_at?: string
        }
        Update: {
          ai_disabled_reason?: string | null
          ai_enabled?: boolean
          default_free_credits?: number
          enable_payments?: boolean
          id?: boolean
          maintenance_mode?: boolean
          show_institutional_landing?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      institutional_pricing_tiers: {
        Row: {
          created_at: string
          id: string
          max_teachers: number | null
          min_teachers: number
          price_per_teacher_clp_monthly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_teachers?: number | null
          min_teachers: number
          price_per_teacher_clp_monthly: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_teachers?: number | null
          min_teachers?: number
          price_per_teacher_clp_monthly?: number
          updated_at?: string
        }
        Relationships: []
      }
      mineduc_subjects: {
        Row: {
          created_at: string
          id: string
          nombre: string
          sige_code: number
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          sige_code: number
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          sige_code?: number
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          colegio_id: string | null
          consumed_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          colegio_id?: string | null
          consumed_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          colegio_id?: string | null
          consumed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_allowed_courses: {
        Row: {
          course_id: string
          id: string
          plan_id: string
        }
        Insert: {
          course_id: string
          id?: string
          plan_id: string
        }
        Update: {
          course_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_plan_allowed_courses_course"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_allowed_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "admin_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_allowed_courses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          allowed_templates: string[] | null
          can_edit_layout: boolean
          can_export_docx: boolean
          can_use_answer_key: boolean
          can_use_omr: boolean
          can_use_response_sheet: boolean
          created_at: string
          default_credits: number
          id: string
          is_default: boolean
          label: string
          max_assessments: number | null
          max_assignments: number | null
          price_clp_monthly: number | null
          price_clp_yearly: number | null
          show_watermark: boolean
          sort_order: number
        }
        Insert: {
          allowed_templates?: string[] | null
          can_edit_layout?: boolean
          can_export_docx?: boolean
          can_use_answer_key?: boolean
          can_use_omr?: boolean
          can_use_response_sheet?: boolean
          created_at?: string
          default_credits?: number
          id: string
          is_default?: boolean
          label: string
          max_assessments?: number | null
          max_assignments?: number | null
          price_clp_monthly?: number | null
          price_clp_yearly?: number | null
          show_watermark?: boolean
          sort_order?: number
        }
        Update: {
          allowed_templates?: string[] | null
          can_edit_layout?: boolean
          can_export_docx?: boolean
          can_use_answer_key?: boolean
          can_use_omr?: boolean
          can_use_response_sheet?: boolean
          created_at?: string
          default_credits?: number
          id?: string
          is_default?: boolean
          label?: string
          max_assessments?: number | null
          max_assignments?: number | null
          price_clp_monthly?: number | null
          price_clp_yearly?: number | null
          show_watermark?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          colegio_id: string | null
          created_at: string
          custom_institution_name: string | null
          custom_logo_url: string | null
          display_name: string | null
          document_id: string | null
          email: string | null
          has_seen_tour: boolean
          id: string
          secondary_email: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          colegio_id?: string | null
          created_at?: string
          custom_institution_name?: string | null
          custom_logo_url?: string | null
          display_name?: string | null
          document_id?: string | null
          email?: string | null
          has_seen_tour?: boolean
          id: string
          secondary_email?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          colegio_id?: string | null
          created_at?: string
          custom_institution_name?: string | null
          custom_logo_url?: string | null
          display_name?: string | null
          document_id?: string | null
          email?: string | null
          has_seen_tour?: boolean
          id?: string
          secondary_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          content_hash: string
          created_at: string
          difficulty: string | null
          grade_value: string | null
          hidden_by_users: string[]
          id: string
          is_public_institution: boolean
          oa_code: string | null
          prompt_preview: string | null
          question_data: Json
          question_type: string
          source: string
          subject_value: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          difficulty?: string | null
          grade_value?: string | null
          hidden_by_users?: string[]
          id?: string
          is_public_institution?: boolean
          oa_code?: string | null
          prompt_preview?: string | null
          question_data: Json
          question_type: string
          source?: string
          subject_value?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          difficulty?: string | null
          grade_value?: string | null
          hidden_by_users?: string[]
          id?: string
          is_public_institution?: boolean
          oa_code?: string | null
          prompt_preview?: string | null
          question_data?: Json
          question_type?: string
          source?: string
          subject_value?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          course_id: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          rut: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          rut: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          rut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          admin_course_id: string | null
          created_at: string
          grade_value: string
          id: string
          section_letter: string
          subject_value: string
          teacher_user_id: string
        }
        Insert: {
          admin_course_id?: string | null
          created_at?: string
          grade_value: string
          id?: string
          section_letter?: string
          subject_value: string
          teacher_user_id: string
        }
        Update: {
          admin_course_id?: string | null
          created_at?: string
          grade_value?: string
          id?: string
          section_letter?: string
          subject_value?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_admin_course_id_fkey"
            columns: ["admin_course_id"]
            isOneToOne: false
            referencedRelation: "admin_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          created_at: string
          credits_available: number
          id: string
          last_reset: string
          monthly_quota: number | null
          plan_expires_at: string | null
          plan_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_available?: number
          id?: string
          last_reset?: string
          monthly_quota?: number | null
          plan_expires_at?: string | null
          plan_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_available?: number
          id?: string
          last_reset?: string
          monthly_quota?: number | null
          plan_expires_at?: string | null
          plan_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_credit: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hide_question_for_user: {
        Args: { _question_id: string; _user_id?: string }
        Returns: boolean
      }
      is_same_colegio: {
        Args: { _staff_id: string; _target_user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "utp_head" | "docente"
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
  public: {
    Enums: {
      app_role: ["admin", "utp_head", "docente"],
    },
  },
} as const
