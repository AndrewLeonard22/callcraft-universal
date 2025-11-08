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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      client_details: {
        Row: {
          client_id: string
          created_at: string | null
          field_name: string
          field_value: string | null
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          field_name: string
          field_value?: string | null
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          field_name?: string
          field_value?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived: boolean
          city: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          name: string
          organization_id: string
          service_type: string
          updated_at: string | null
        }
        Insert: {
          archived?: boolean
          city?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          name: string
          organization_id: string
          service_type: string
          updated_at?: string | null
        }
        Update: {
          archived?: boolean
          city?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          name?: string
          organization_id?: string
          service_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          display_order: number | null
          id: string
          organization_id: string | null
          question: string
          service_type_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number | null
          id?: string
          organization_id?: string | null
          question: string
          service_type_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number | null
          id?: string
          organization_id?: string | null
          question?: string
          service_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faqs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_images: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          estimated_at: string | null
          feature_options: Json | null
          feature_size: string
          features: string[]
          id: string
          image_url: string
          organization_id: string | null
          price_estimate: Json | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          estimated_at?: string | null
          feature_options?: Json | null
          feature_size?: string
          features: string[]
          id?: string
          image_url: string
          organization_id?: string | null
          price_estimate?: Json | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          estimated_at?: string | null
          feature_options?: Json | null
          feature_size?: string
          features?: string[]
          id?: string
          image_url?: string
          organization_id?: string | null
          price_estimate?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_images_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      objection_handling_templates: {
        Row: {
          content: string
          created_at: string
          display_order: number | null
          id: string
          organization_id: string
          service_name: string
        }
        Insert: {
          content: string
          created_at?: string
          display_order?: number | null
          id?: string
          organization_id: string
          service_name: string
        }
        Update: {
          content?: string
          created_at?: string
          display_order?: number | null
          id?: string
          organization_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "objection_handling_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_logo_url: string | null
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_logo_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_logo_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      qualification_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          organization_id: string | null
          question: string
          service_type_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          organization_id?: string | null
          question: string
          service_type_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          organization_id?: string | null
          question?: string
          service_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_questions_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_responses: {
        Row: {
          created_at: string
          customer_response: string | null
          id: string
          is_asked: boolean
          question_id: string
          script_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_response?: string | null
          id?: string
          is_asked?: boolean
          question_id: string
          script_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_response?: string | null
          id?: string
          is_asked?: boolean
          question_id?: string
          script_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qualification_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_responses_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          client_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_template: boolean
          objection_handling: string | null
          organization_id: string | null
          qualification_summary: string | null
          script_content: string
          service_name: string
          service_type_id: string | null
          version: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_template?: boolean
          objection_handling?: string | null
          organization_id?: string | null
          qualification_summary?: string | null
          script_content: string
          service_name?: string
          service_type_id?: string | null
          version?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_template?: boolean
          objection_handling?: string | null
          organization_id?: string | null
          qualification_summary?: string | null
          script_content?: string
          service_name?: string
          service_type_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_detail_fields: {
        Row: {
          created_at: string
          display_order: number
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          organization_id: string
          placeholder: string | null
          service_type_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean
          organization_id: string
          placeholder?: string | null
          service_type_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          organization_id?: string
          placeholder?: string | null
          service_type_id?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_benefits: {
        Row: {
          benefit_text: string
          benefit_type: string | null
          created_at: string
          display_order: number | null
          id: string
          section_id: string
        }
        Insert: {
          benefit_text: string
          benefit_type?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          section_id: string
        }
        Update: {
          benefit_text?: string
          benefit_type?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_benefits_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_features: {
        Row: {
          created_at: string
          display_order: number | null
          feature_name: string
          feature_value: string
          id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          feature_name: string
          feature_value: string
          id?: string
          section_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          feature_name?: string
          feature_value?: string
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_features_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_sections: {
        Row: {
          content: string | null
          created_at: string
          display_order: number | null
          id: string
          module_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          module_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          module_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          module_id: string | null
          section_id: string | null
          title: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          module_id?: string | null
          section_id?: string | null
          title: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          module_id?: string | null
          section_id?: string | null
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_videos_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_videos_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_organization: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      expire_old_invitations: { Args: never; Returns: undefined }
      has_organization_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["organization_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      organization_role: "owner" | "admin" | "member"
      user_role: "admin" | "sales_rep" | "user"
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
      organization_role: ["owner", "admin", "member"],
      user_role: ["admin", "sales_rep", "user"],
    },
  },
} as const
