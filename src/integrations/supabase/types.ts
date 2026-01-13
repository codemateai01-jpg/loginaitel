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
      bolna_agents: {
        Row: {
          agent_config: Json | null
          agent_name: string
          bolna_agent_id: string
          client_id: string | null
          created_at: string
          current_system_prompt: string | null
          engineer_id: string | null
          id: string
          original_system_prompt: string | null
          status: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          agent_config?: Json | null
          agent_name: string
          bolna_agent_id: string
          client_id?: string | null
          created_at?: string
          current_system_prompt?: string | null
          engineer_id?: string | null
          id?: string
          original_system_prompt?: string | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          agent_config?: Json | null
          agent_name?: string
          bolna_agent_id?: string
          client_id?: string | null
          created_at?: string
          current_system_prompt?: string | null
          engineer_id?: string | null
          id?: string
          original_system_prompt?: string | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          agent_id: string
          batch_id: string | null
          client_id: string
          connected: boolean | null
          created_at: string
          credit_deducted: boolean | null
          duration_seconds: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          lead_id: string
          metadata: Json | null
          recording_url: string | null
          sentiment: string | null
          started_at: string | null
          status: string
          summary: string | null
          transcript: string | null
        }
        Insert: {
          agent_id: string
          batch_id?: string | null
          client_id: string
          connected?: boolean | null
          created_at?: string
          credit_deducted?: boolean | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          agent_id?: string
          batch_id?: string | null
          client_id?: string
          connected?: boolean | null
          created_at?: string
          credit_deducted?: boolean | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_admin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credits: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          id: string
          price_per_credit: number
          updated_at: string
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string
          id?: string
          price_per_credit?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          id?: string
          price_per_credit?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          call_id: string | null
          client_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          call_id?: string | null
          client_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          call_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_credits"
            referencedColumns: ["client_id"]
          },
        ]
      }
      engineer_points: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          metadata: Json | null
          name: string | null
          phone_number: string
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone_number: string
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone_number?: string
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          description: string | null
          engineer_id: string
          id: string
          points: number
          task_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          engineer_id: string
          id?: string
          points: number
          task_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          engineer_id?: string
          id?: string
          points?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineer_points"
            referencedColumns: ["engineer_id"]
          },
          {
            foreignKeyName: "point_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          bolna_agent_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          picked_at: string | null
          points: number
          rejection_reason: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bolna_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          picked_at?: string | null
          points?: number
          rejection_reason?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bolna_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          picked_at?: string | null
          points?: number
          rejection_reason?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_bolna_agent_id_fkey"
            columns: ["bolna_agent_id"]
            isOneToOne: false
            referencedRelation: "bolna_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          check_in_time: string
          check_out_time: string | null
          created_at: string
          engineer_id: string
          id: string
          notes: string | null
          status: string
          total_break_minutes: number | null
          updated_at: string
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          engineer_id: string
          id?: string
          notes?: string | null
          status?: string
          total_break_minutes?: number | null
          updated_at?: string
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          engineer_id?: string
          id?: string
          notes?: string | null
          status?: string
          total_break_minutes?: number | null
          updated_at?: string
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
    }
    Views: {
      leads_admin_view: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          phone_number_masked: string | null
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          phone_number_masked?: never
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          phone_number_masked?: never
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "engineer" | "client"
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
      app_role: ["admin", "engineer", "client"],
    },
  },
} as const
