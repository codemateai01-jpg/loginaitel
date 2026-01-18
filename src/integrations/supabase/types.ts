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
      ai_insights_history: {
        Row: {
          campaign_id: string | null
          client_id: string
          conversion_rate: number | null
          created_at: string
          id: string
          insights: Json
          interested_calls: number
          metadata: Json
          not_interested_calls: number
          notes: string | null
          partial_calls: number
          total_calls: number
        }
        Insert: {
          campaign_id?: string | null
          client_id: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          insights: Json
          interested_calls?: number
          metadata: Json
          not_interested_calls?: number
          notes?: string | null
          partial_calls?: number
          total_calls?: number
        }
        Update: {
          campaign_id?: string | null
          client_id?: string
          conversion_rate?: number | null
          created_at?: string
          id?: string
          insights?: Json
          interested_calls?: number
          metadata?: Json
          not_interested_calls?: number
          notes?: string | null
          partial_calls?: number
          total_calls?: number
        }
        Relationships: []
      }
      aitel_agents: {
        Row: {
          agent_config: Json | null
          agent_name: string
          client_id: string | null
          created_at: string
          current_system_prompt: string | null
          engineer_id: string | null
          external_agent_id: string
          id: string
          original_system_prompt: string | null
          status: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          agent_config?: Json | null
          agent_name: string
          client_id?: string | null
          created_at?: string
          current_system_prompt?: string | null
          engineer_id?: string | null
          external_agent_id: string
          id?: string
          original_system_prompt?: string | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          agent_config?: Json | null
          agent_name?: string
          client_id?: string | null
          created_at?: string
          current_system_prompt?: string | null
          engineer_id?: string | null
          external_agent_id?: string
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
        Relationships: []
      }
      campaign_call_queue: {
        Row: {
          agent_id: string | null
          call_id: string | null
          campaign_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          daily_retry_date: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          lead_id: string
          next_retry_at: string | null
          priority: number
          queued_at: string
          retry_count: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          campaign_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          daily_retry_date?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id: string
          next_retry_at?: string | null
          priority?: number
          queued_at?: string
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          campaign_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          daily_retry_date?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          lead_id?: string
          next_retry_at?: string | null
          priority?: number
          queued_at?: string
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_call_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "aitel_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_call_queue_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_call_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_call_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          call_duration: number | null
          call_id: string | null
          call_sentiment: string | null
          call_status: string | null
          call_summary: string | null
          campaign_id: string
          client_id: string
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          interest_level: string | null
          name: string
          notes: string | null
          phone_number: string
          stage: string
          updated_at: string
        }
        Insert: {
          call_duration?: number | null
          call_id?: string | null
          call_sentiment?: string | null
          call_status?: string | null
          call_summary?: string | null
          campaign_id: string
          client_id: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          interest_level?: string | null
          name: string
          notes?: string | null
          phone_number: string
          stage?: string
          updated_at?: string
        }
        Update: {
          call_duration?: number | null
          call_id?: string | null
          call_sentiment?: string | null
          call_status?: string | null
          call_summary?: string | null
          campaign_id?: string
          client_id?: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          interest_level?: string | null
          name?: string
          notes?: string | null
          phone_number?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_id: string | null
          api_endpoint: string | null
          api_headers: Json | null
          api_key: string | null
          client_id: string
          concurrency_level: number
          contacted_leads: number | null
          created_at: string
          description: string | null
          google_sheet_id: string | null
          google_sheet_range: string | null
          id: string
          interested_leads: number | null
          max_daily_retries: number
          name: string
          not_interested_leads: number | null
          partially_interested_leads: number | null
          retry_delay_minutes: number
          status: string
          total_leads: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          api_endpoint?: string | null
          api_headers?: Json | null
          api_key?: string | null
          client_id: string
          concurrency_level?: number
          contacted_leads?: number | null
          created_at?: string
          description?: string | null
          google_sheet_id?: string | null
          google_sheet_range?: string | null
          id?: string
          interested_leads?: number | null
          max_daily_retries?: number
          name: string
          not_interested_leads?: number | null
          partially_interested_leads?: number | null
          retry_delay_minutes?: number
          status?: string
          total_leads?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          api_endpoint?: string | null
          api_headers?: Json | null
          api_key?: string | null
          client_id?: string
          concurrency_level?: number
          contacted_leads?: number | null
          created_at?: string
          description?: string | null
          google_sheet_id?: string | null
          google_sheet_range?: string | null
          id?: string
          interested_leads?: number | null
          max_daily_retries?: number
          name?: string
          not_interested_leads?: number | null
          partially_interested_leads?: number | null
          retry_delay_minutes?: number
          status?: string
          total_leads?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "aitel_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_active_sessions: {
        Row: {
          client_id: string
          created_at: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity_at: string | null
          logged_in_at: string | null
          session_token: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logged_in_at?: string | null
          session_token: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          logged_in_at?: string | null
          session_token?: string
        }
        Relationships: []
      }
      client_credits: {
        Row: {
          auto_recharge_amount: number | null
          auto_recharge_enabled: boolean | null
          auto_recharge_trigger_balance: number | null
          balance: number
          client_id: string
          created_at: string
          id: string
          last_low_balance_alert_at: string | null
          low_balance_alert_enabled: boolean | null
          low_balance_threshold: number | null
          price_per_credit: number
          updated_at: string
        }
        Insert: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_trigger_balance?: number | null
          balance?: number
          client_id: string
          created_at?: string
          id?: string
          last_low_balance_alert_at?: string | null
          low_balance_alert_enabled?: boolean | null
          low_balance_threshold?: number | null
          price_per_credit?: number
          updated_at?: string
        }
        Update: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_trigger_balance?: number | null
          balance?: number
          client_id?: string
          created_at?: string
          id?: string
          last_low_balance_alert_at?: string | null
          low_balance_alert_enabled?: boolean | null
          low_balance_threshold?: number | null
          price_per_credit?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_phone_numbers: {
        Row: {
          allocated_at: string
          allocated_by: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          phone_number: string
          updated_at: string
        }
        Insert: {
          allocated_at?: string
          allocated_by: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number: string
          updated_at?: string
        }
        Update: {
          allocated_at?: string
          allocated_by?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_sub_users: {
        Row: {
          activated_at: string | null
          client_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["client_sub_user_role"]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["client_sub_user_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["client_sub_user_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      client_subscriptions: {
        Row: {
          calls_remaining: number
          calls_used: number
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          package_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          calls_remaining: number
          calls_used?: number
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          calls_remaining?: number
          calls_used?: number
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "pricing_packages"
            referencedColumns: ["id"]
          },
        ]
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
      demo_calls: {
        Row: {
          agent_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          engineer_id: string
          external_call_id: string | null
          id: string
          phone_number: string
          recording_url: string | null
          started_at: string | null
          status: string
          task_id: string
          transcript: string | null
          updated_at: string
          uploaded_audio_url: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          engineer_id: string
          external_call_id?: string | null
          id?: string
          phone_number: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          transcript?: string | null
          updated_at?: string
          uploaded_audio_url?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          engineer_id?: string
          external_call_id?: string | null
          id?: string
          phone_number?: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          transcript?: string | null
          updated_at?: string
          uploaded_audio_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "aitel_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_calls_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      email_otps: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_code: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_code: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          verified?: boolean | null
        }
        Relationships: []
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
      lead_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          assignment_type: string
          campaign_id: string
          client_id: string
          created_at: string
          follow_up_at: string | null
          id: string
          last_action_at: string | null
          lead_id: string
          notes: string | null
          priority: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_type?: string
          campaign_id: string
          client_id: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          last_action_at?: string | null
          lead_id: string
          notes?: string | null
          priority?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_type?: string
          campaign_id?: string
          client_id?: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          last_action_at?: string | null
          lead_id?: string
          notes?: string | null
          priority?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "client_sub_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          credits: number
          id: string
          invoice_url: string | null
          razorpay_order_id: string
          razorpay_payment_id: string | null
          refund_amount: number | null
          refund_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          credits: number
          id?: string
          invoice_url?: string | null
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          credits?: number
          id?: string
          invoice_url?: string | null
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          otp_code: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          verified?: boolean | null
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
      pricing_packages: {
        Row: {
          calls_included: number
          concurrency_level: number
          created_at: string
          description: string | null
          display_order: number
          features: Json | null
          id: string
          includes_inbound: boolean
          is_active: boolean
          is_enterprise: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          calls_included: number
          concurrency_level?: number
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          includes_inbound?: boolean
          is_active?: boolean
          is_enterprise?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          calls_included?: number
          concurrency_level?: number
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          includes_inbound?: boolean
          is_active?: boolean
          is_enterprise?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      prompt_edit_history: {
        Row: {
          agent_id: string
          created_at: string
          edit_phase: string
          engineer_id: string
          id: string
          new_prompt: string
          previous_prompt: string | null
          task_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          edit_phase?: string
          engineer_id: string
          id?: string
          new_prompt: string
          previous_prompt?: string | null
          task_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          edit_phase?: string
          engineer_id?: string
          id?: string
          new_prompt?: string
          previous_prompt?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_edit_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "aitel_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_edit_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_payments: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          client_id: string
          created_at: string
          id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          seats_count: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          client_id: string
          created_at?: string
          id?: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          seats_count: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          client_id?: string
          created_at?: string
          id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          seats_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seat_subscriptions: {
        Row: {
          autopay_enabled: boolean | null
          autopay_setup_at: string | null
          client_id: string
          created_at: string
          id: string
          is_trial: boolean | null
          last_payment_date: string | null
          next_billing_date: string | null
          razorpay_subscription_id: string | null
          seats_count: number
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          autopay_enabled?: boolean | null
          autopay_setup_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_trial?: boolean | null
          last_payment_date?: string | null
          next_billing_date?: string | null
          razorpay_subscription_id?: string | null
          seats_count?: number
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          autopay_enabled?: boolean | null
          autopay_setup_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_trial?: boolean | null
          last_payment_date?: string | null
          next_billing_date?: string | null
          razorpay_subscription_id?: string | null
          seats_count?: number
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sub_user_activity_logs: {
        Row: {
          action_type: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          sub_user_id: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          sub_user_id: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          sub_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_user_activity_logs_sub_user_id_fkey"
            columns: ["sub_user_id"]
            isOneToOne: false
            referencedRelation: "client_sub_users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          action: string
          calls_carried_over: number | null
          client_id: string
          created_at: string
          created_by: string | null
          from_package_id: string | null
          id: string
          notes: string | null
          to_package_id: string
        }
        Insert: {
          action?: string
          calls_carried_over?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          from_package_id?: string | null
          id?: string
          notes?: string | null
          to_package_id: string
        }
        Update: {
          action?: string
          calls_carried_over?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          from_package_id?: string | null
          id?: string
          notes?: string | null
          to_package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_from_package_id_fkey"
            columns: ["from_package_id"]
            isOneToOne: false
            referencedRelation: "pricing_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_to_package_id_fkey"
            columns: ["to_package_id"]
            isOneToOne: false
            referencedRelation: "pricing_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          aitel_agent_id: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deadline: string | null
          demo_completed_at: string | null
          demo_edit_count: number | null
          demo_rejection_count: number | null
          demo_started_at: string | null
          description: string | null
          final_score: number | null
          id: string
          picked_at: string | null
          points: number
          prompt_approved_at: string | null
          prompt_edit_count: number | null
          prompt_rejection_count: number | null
          prompt_started_at: string | null
          prompt_submitted_at: string | null
          rejection_reason: string | null
          score_breakdown: Json | null
          selected_demo_call_id: string | null
          status: string
          title: string
          updated_at: string
          waiting_approval_minutes: number | null
        }
        Insert: {
          aitel_agent_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          demo_completed_at?: string | null
          demo_edit_count?: number | null
          demo_rejection_count?: number | null
          demo_started_at?: string | null
          description?: string | null
          final_score?: number | null
          id?: string
          picked_at?: string | null
          points?: number
          prompt_approved_at?: string | null
          prompt_edit_count?: number | null
          prompt_rejection_count?: number | null
          prompt_started_at?: string | null
          prompt_submitted_at?: string | null
          rejection_reason?: string | null
          score_breakdown?: Json | null
          selected_demo_call_id?: string | null
          status?: string
          title: string
          updated_at?: string
          waiting_approval_minutes?: number | null
        }
        Update: {
          aitel_agent_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          demo_completed_at?: string | null
          demo_edit_count?: number | null
          demo_rejection_count?: number | null
          demo_started_at?: string | null
          description?: string | null
          final_score?: number | null
          id?: string
          picked_at?: string | null
          points?: number
          prompt_approved_at?: string | null
          prompt_edit_count?: number | null
          prompt_rejection_count?: number | null
          prompt_started_at?: string | null
          prompt_submitted_at?: string | null
          rejection_reason?: string | null
          score_breakdown?: Json | null
          selected_demo_call_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          waiting_approval_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_bolna_agent_id_fkey"
            columns: ["aitel_agent_id"]
            isOneToOne: false
            referencedRelation: "aitel_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      telecaller_assignment_queue: {
        Row: {
          client_id: string
          id: string
          last_assigned_telecaller_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          id?: string
          last_assigned_telecaller_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          last_assigned_telecaller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telecaller_assignment_queue_last_assigned_telecaller_id_fkey"
            columns: ["last_assigned_telecaller_id"]
            isOneToOne: false
            referencedRelation: "client_sub_users"
            referencedColumns: ["id"]
          },
        ]
      }
      telecaller_call_logs: {
        Row: {
          assignment_id: string | null
          call_outcome: string | null
          call_type: string
          client_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          lead_id: string
          notes: string | null
          phone_number: string
          provider: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          telecaller_id: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          call_outcome?: string | null
          call_type?: string
          client_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          phone_number: string
          provider?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          telecaller_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          call_outcome?: string | null
          call_type?: string
          client_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          phone_number?: string
          provider?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          telecaller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telecaller_call_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "lead_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telecaller_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telecaller_call_logs_telecaller_id_fkey"
            columns: ["telecaller_id"]
            isOneToOne: false
            referencedRelation: "client_sub_users"
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
          productive_minutes: number | null
          status: string
          task_work_minutes: number | null
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
          productive_minutes?: number | null
          status?: string
          task_work_minutes?: number | null
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
          productive_minutes?: number | null
          status?: string
          task_work_minutes?: number | null
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
      [_ in never]: never
    }
    Functions: {
      auto_assign_lead_to_telecaller: {
        Args: { p_campaign_id: string; p_client_id: string; p_lead_id: string }
        Returns: string
      }
      calculate_productive_hours: {
        Args: { p_date?: string; p_engineer_id: string }
        Returns: Json
      }
      calculate_task_score: { Args: { p_task_id: string }; Returns: Json }
      calculate_task_score_v2: { Args: { p_task_id: string }; Returns: Json }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      cleanup_expired_phone_otps: { Args: never; Returns: undefined }
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
      client_sub_user_role: "monitoring" | "telecaller" | "lead_manager"
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
      client_sub_user_role: ["monitoring", "telecaller", "lead_manager"],
    },
  },
} as const
