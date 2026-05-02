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
      courses: {
        Row: {
          created_at: string
          id: string
          level: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_base: {
        Row: {
          created_at: string
          eje: string | null
          grade_value: string
          id: string
          indicators: Json
          oa_code: string
          oa_description: string
          subject_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          eje?: string | null
          grade_value: string
          id?: string
          indicators?: Json
          oa_code: string
          oa_description: string
          subject_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          eje?: string | null
          grade_value?: string
          id?: string
          indicators?: Json
          oa_code?: string
          oa_description?: string
          subject_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          default_free_credits: number
          enable_payments: boolean
          id: boolean
          maintenance_mode: boolean
          updated_at: string
        }
        Insert: {
          default_free_credits?: number
          enable_payments?: boolean
          id?: boolean
          maintenance_mode?: boolean
          updated_at?: string
        }
        Update: {
          default_free_credits?: number
          enable_payments?: boolean
          id?: boolean
          maintenance_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_institution_name: string | null
          custom_logo_url: string | null
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_institution_name?: string | null
          custom_logo_url?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_institution_name?: string | null
          custom_logo_url?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          content_hash: string
          created_at: string
          difficulty: string | null
          grade_value: string | null
          id: string
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
          id?: string
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
          id?: string
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
          created_at: string
          grade_value: string
          id: string
          subject_value: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string
          grade_value: string
          id?: string
          subject_value: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string
          grade_value?: string
          id?: string
          subject_value?: string
          teacher_user_id?: string
        }
        Relationships: []
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "utp_head"
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
      app_role: ["admin", "user", "utp_head"],
    },
  },
} as const
