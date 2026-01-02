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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_history: {
        Row: {
          action: string
          assessment_id: string
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["assessment_status"]
          id: string
          performed_by: string
          to_status: Database["public"]["Enums"]["assessment_status"]
        }
        Insert: {
          action: string
          assessment_id: string
          comment?: string | null
          created_at?: string
          from_status: Database["public"]["Enums"]["assessment_status"]
          id?: string
          performed_by: string
          to_status: Database["public"]["Enums"]["assessment_status"]
        }
        Update: {
          action?: string
          assessment_id?: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["assessment_status"]
          id?: string
          performed_by?: string
          to_status?: Database["public"]["Enums"]["assessment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          assessment_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          score: number
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
        }
        Insert: {
          assessment_id: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          score?: number
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          score?: number
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ctam_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_period: string
          created_at: string
          created_by: string
          fiscal_year: number
          health_office_id: string | null
          hospital_id: string | null
          id: string
          impact_approved_at: string | null
          impact_approved_by: string | null
          impact_score: number | null
          provincial_approved_at: string | null
          provincial_approved_by: string | null
          provincial_comment: string | null
          qualitative_approved_at: string | null
          qualitative_approved_by: string | null
          qualitative_score: number | null
          quantitative_approved_at: string | null
          quantitative_approved_by: string | null
          quantitative_score: number | null
          regional_approved_at: string | null
          regional_approved_by: string | null
          regional_comment: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          submitted_at: string | null
          submitted_by: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          assessment_period: string
          created_at?: string
          created_by: string
          fiscal_year: number
          health_office_id?: string | null
          hospital_id?: string | null
          id?: string
          impact_approved_at?: string | null
          impact_approved_by?: string | null
          impact_score?: number | null
          provincial_approved_at?: string | null
          provincial_approved_by?: string | null
          provincial_comment?: string | null
          qualitative_approved_at?: string | null
          qualitative_approved_by?: string | null
          qualitative_score?: number | null
          quantitative_approved_at?: string | null
          quantitative_approved_by?: string | null
          quantitative_score?: number | null
          regional_approved_at?: string | null
          regional_approved_by?: string | null
          regional_comment?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          assessment_period?: string
          created_at?: string
          created_by?: string
          fiscal_year?: number
          health_office_id?: string | null
          hospital_id?: string | null
          id?: string
          impact_approved_at?: string | null
          impact_approved_by?: string | null
          impact_score?: number | null
          provincial_approved_at?: string | null
          provincial_approved_by?: string | null
          provincial_comment?: string | null
          qualitative_approved_at?: string | null
          qualitative_approved_by?: string | null
          qualitative_score?: number | null
          quantitative_approved_at?: string | null
          quantitative_approved_by?: string | null
          quantitative_score?: number | null
          regional_approved_at?: string | null
          regional_approved_by?: string | null
          regional_comment?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_health_office_id_fkey"
            columns: ["health_office_id"]
            isOneToOne: false
            referencedRelation: "health_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_impact_approved_by_fkey"
            columns: ["impact_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_provincial_approved_by_fkey"
            columns: ["provincial_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_qualitative_approved_by_fkey"
            columns: ["qualitative_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_quantitative_approved_by_fkey"
            columns: ["quantitative_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_regional_approved_by_fkey"
            columns: ["regional_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ctam_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          max_score: number
          name_en: string
          name_th: string
          order_number: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          name_en: string
          name_th: string
          order_number: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          name_en?: string
          name_th?: string
          order_number?: number
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          assessment_item_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string
        }
        Insert: {
          assessment_item_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by: string
        }
        Update: {
          assessment_item_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_offices: {
        Row: {
          code: string
          created_at: string
          health_region_id: string
          id: string
          name: string
          office_type: string
          province_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          health_region_id: string
          id?: string
          name: string
          office_type?: string
          province_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          health_region_id?: string
          id?: string
          name?: string
          office_type?: string
          province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_offices_health_region_id_fkey"
            columns: ["health_region_id"]
            isOneToOne: false
            referencedRelation: "health_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_offices_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      health_regions: {
        Row: {
          created_at: string
          id: string
          name: string
          region_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      hospitals: {
        Row: {
          bed_count: number | null
          code: string
          created_at: string
          hospital_type: string | null
          id: string
          name: string
          province_id: string
          updated_at: string
        }
        Insert: {
          bed_count?: number | null
          code: string
          created_at?: string
          hospital_type?: string | null
          id?: string
          name: string
          province_id: string
          updated_at?: string
        }
        Update: {
          bed_count?: number | null
          code?: string
          created_at?: string
          hospital_type?: string | null
          id?: string
          name?: string
          province_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_evidence_files: {
        Row: {
          created_at: string
          field_name: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          impact_score_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          field_name: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          impact_score_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          field_name?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          impact_score_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_evidence_files_impact_score_id_fkey"
            columns: ["impact_score_id"]
            isOneToOne: false
            referencedRelation: "impact_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_scores: {
        Row: {
          assessment_id: string
          breach_penalty_level: number | null
          breach_score: number | null
          breach_severity: string | null
          comment: string | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          had_data_breach: boolean | null
          had_incident: boolean | null
          id: string
          incident_recovery_hours: number | null
          incident_score: number | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          breach_penalty_level?: number | null
          breach_score?: number | null
          breach_severity?: string | null
          comment?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          had_data_breach?: boolean | null
          had_incident?: boolean | null
          id?: string
          incident_recovery_hours?: number | null
          incident_score?: number | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          breach_penalty_level?: number | null
          breach_score?: number | null
          breach_severity?: string | null
          comment?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          had_data_breach?: boolean | null
          had_incident?: boolean | null
          id?: string
          incident_recovery_hours?: number | null
          incident_score?: number | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_scores_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_files: {
        Row: {
          assessment_round: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          fiscal_year: number
          health_region_id: string
          id: string
          province_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          assessment_round: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          fiscal_year: number
          health_region_id: string
          id?: string
          province_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          assessment_round?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          fiscal_year?: number
          health_region_id?: string
          id?: string
          province_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_files_health_region_id_fkey"
            columns: ["health_region_id"]
            isOneToOne: false
            referencedRelation: "health_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_files_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_manual_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          pinned: boolean
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          health_office_id: string | null
          health_region_id: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          organization: string | null
          phone: string | null
          position: string | null
          province_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          health_office_id?: string | null
          health_region_id?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          organization?: string | null
          phone?: string | null
          position?: string | null
          province_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          health_office_id?: string | null
          health_region_id?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          organization?: string | null
          phone?: string | null
          position?: string | null
          province_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_health_office_id_fkey"
            columns: ["health_office_id"]
            isOneToOne: false
            referencedRelation: "health_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_health_region_id_fkey"
            columns: ["health_region_id"]
            isOneToOne: false
            referencedRelation: "health_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string
          created_at: string
          health_region_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          health_region_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          health_region_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provinces_health_region_id_fkey"
            columns: ["health_region_id"]
            isOneToOne: false
            referencedRelation: "health_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      qualitative_evidence_files: {
        Row: {
          created_at: string
          field_name: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          qualitative_score_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          field_name: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          qualitative_score_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          field_name?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          qualitative_score_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualitative_evidence_files_qualitative_score_id_fkey"
            columns: ["qualitative_score_id"]
            isOneToOne: false
            referencedRelation: "qualitative_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      qualitative_scores: {
        Row: {
          annual_training_count: number | null
          assessment_id: string
          comment: string | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          has_ciso: boolean | null
          has_dpo: boolean | null
          has_it_security_team: boolean | null
          id: string
          leadership_score: number | null
          sustainable_score: number | null
          total_score: number | null
          updated_at: string
          uses_freeware: boolean | null
          uses_opensource: boolean | null
        }
        Insert: {
          annual_training_count?: number | null
          assessment_id: string
          comment?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          has_ciso?: boolean | null
          has_dpo?: boolean | null
          has_it_security_team?: boolean | null
          id?: string
          leadership_score?: number | null
          sustainable_score?: number | null
          total_score?: number | null
          updated_at?: string
          uses_freeware?: boolean | null
          uses_opensource?: boolean | null
        }
        Update: {
          annual_training_count?: number | null
          assessment_id?: string
          comment?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          has_ciso?: boolean | null
          has_dpo?: boolean | null
          has_it_security_team?: boolean | null
          id?: string
          leadership_score?: number | null
          sustainable_score?: number | null
          total_score?: number | null
          updated_at?: string
          uses_freeware?: boolean | null
          uses_opensource?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "qualitative_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualitative_scores_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_access_policies: {
        Row: {
          created_at: string | null
          drill_to_hospital: string | null
          drill_to_province: string | null
          id: string
          report_type: string
          role: string
          updated_at: string | null
          view_region: boolean | null
        }
        Insert: {
          created_at?: string | null
          drill_to_hospital?: string | null
          drill_to_province?: string | null
          id?: string
          report_type: string
          role: string
          updated_at?: string | null
          view_region?: boolean | null
        }
        Update: {
          created_at?: string | null
          drill_to_hospital?: string | null
          drill_to_province?: string | null
          id?: string
          report_type?: string
          role?: string
          updated_at?: string | null
          view_region?: boolean | null
        }
        Relationships: []
      }
      supervisee_inspection_files: {
        Row: {
          assessment_round: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          fiscal_year: number
          health_region_id: string
          id: string
          province_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          assessment_round: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          fiscal_year: number
          health_region_id: string
          id?: string
          province_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          assessment_round?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          fiscal_year?: number
          health_region_id?: string
          id?: string
          province_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisee_inspection_files_health_region_id_fkey"
            columns: ["health_region_id"]
            isOneToOne: false
            referencedRelation: "health_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisee_inspection_files_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_provincial_manage_hospital_user: {
        Args: { _hospital_id: string }
        Returns: boolean
      }
      can_regional_manage_pending_provincial: {
        Args: { _province_id: string }
        Returns: boolean
      }
      can_regional_manage_provincial_user: {
        Args: { _province_id: string }
        Returns: boolean
      }
      can_regional_view_supervisor: {
        Args: { _health_region_id: string }
        Returns: boolean
      }
      is_central_admin: { Args: never; Returns: boolean }
      is_provincial_admin: { Args: never; Returns: boolean }
      is_regional_admin: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
    }
    Enums: {
      assessment_status:
        | "draft"
        | "submitted"
        | "returned"
        | "approved_provincial"
        | "approved_regional"
        | "completed"
      item_status: "pass" | "fail" | "partial" | "not_applicable"
      user_role:
        | "hospital_it"
        | "provincial"
        | "regional"
        | "central_admin"
        | "health_office"
        | "supervisor"
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
      assessment_status: [
        "draft",
        "submitted",
        "returned",
        "approved_provincial",
        "approved_regional",
        "completed",
      ],
      item_status: ["pass", "fail", "partial", "not_applicable"],
      user_role: [
        "hospital_it",
        "provincial",
        "regional",
        "central_admin",
        "health_office",
        "supervisor",
      ],
    },
  },
} as const
