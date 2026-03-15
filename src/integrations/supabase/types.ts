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
      ai_config: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          is_active: boolean
          model: string
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_module_prompts: {
        Row: {
          created_at: string
          escalation_keywords: string[] | null
          id: string
          is_active: boolean
          module: string
          system_prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalation_keywords?: string[] | null
          id?: string
          is_active?: boolean
          module: string
          system_prompt?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalation_keywords?: string[] | null
          id?: string
          is_active?: boolean
          module?: string
          system_prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_module_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reply_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          module: string
          response_text: string
          tenant_id: string | null
          trigger_keyword: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          module?: string
          response_text: string
          tenant_id?: string | null
          trigger_keyword: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          module?: string
          response_text?: string
          tenant_id?: string | null
          trigger_keyword?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notes: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string
          tags: string[] | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_label_assignments: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          label_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          label_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_label_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "conversation_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          chat_status: string
          contact_phone: string
          created_at: string
          id: string
          last_customer_message_at: string | null
          last_message_at: string | null
          last_message_body: string | null
          module: string
          pinned_at: string | null
          status: string
          tenant_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          chat_status?: string
          contact_phone: string
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_message_body?: string | null
          module?: string
          pinned_at?: string | null
          status?: string
          tenant_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          chat_status?: string
          contact_phone?: string
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_message_body?: string | null
          module?: string
          pinned_at?: string | null
          status?: string
          tenant_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_button_actions: {
        Row: {
          auto_reply_text: string
          button_title: string
          created_at: string
          id: string
          is_active: boolean
          template_id: string
          tenant_id: string
          update_status_to: string
          updated_at: string
        }
        Insert: {
          auto_reply_text?: string
          button_title: string
          created_at?: string
          id?: string
          is_active?: boolean
          template_id: string
          tenant_id: string
          update_status_to?: string
          updated_at?: string
        }
        Update: {
          auto_reply_text?: string
          button_title?: string
          created_at?: string
          id?: string
          is_active?: boolean
          template_id?: string
          tenant_id?: string
          update_status_to?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_button_actions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "followup_wa_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_button_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_status_config: {
        Row: {
          created_at: string
          followup_statuses: string[]
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          followup_statuses?: string[]
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          followup_statuses?: string[]
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_status_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_wa_templates: {
        Row: {
          created_at: string
          description: string | null
          has_variables: boolean
          id: string
          language: string
          template_name: string
          tenant_id: string
          updated_at: string
          variable_mappings: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          has_variables?: boolean
          id?: string
          language?: string
          template_name: string
          tenant_id: string
          updated_at?: string
          variable_mappings?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          has_variables?: boolean
          id?: string
          language?: string
          template_name?: string
          tenant_id?: string
          updated_at?: string
          variable_mappings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_wa_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          contact_name: string | null
          contact_phone: string
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          reply_to_message_id: string | null
          status: string | null
          tenant_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          body: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          direction: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          reply_to_message_id?: string | null
          status?: string | null
          tenant_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          reply_to_message_id?: string | null
          status?: string | null
          tenant_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_modifications: {
        Row: {
          created_at: string
          id: string
          message_sent: boolean
          modification_type: string
          new_data: Json | null
          old_data: Json | null
          order_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_sent?: boolean
          modification_type?: string
          new_data?: Json | null
          old_data?: Json | null
          order_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_sent?: boolean
          modification_type?: string
          new_data?: Json | null
          old_data?: Json | null
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_modifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          abandoned_checkout_id: string | null
          confirmation_message_sent: boolean
          confirmed_at: string | null
          conversation_id: string | null
          coupon_code: string | null
          created_at: string
          currency: string | null
          customer_address: string | null
          customer_city: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string
          customer_phone_alt: string | null
          customer_sub_zone: string | null
          discount_amount: number | null
          id: string
          items: Json | null
          notes: string | null
          order_number: string
          order_source: string | null
          payment_method: string | null
          payment_status: string | null
          shipping_cost: number | null
          status: string
          store_order_id: string | null
          subtotal: number | null
          tenant_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          abandoned_checkout_id?: string | null
          confirmation_message_sent?: boolean
          confirmed_at?: string | null
          conversation_id?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone: string
          customer_phone_alt?: string | null
          customer_sub_zone?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_number: string
          order_source?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_cost?: number | null
          status?: string
          store_order_id?: string | null
          subtotal?: number | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          abandoned_checkout_id?: string | null
          confirmation_message_sent?: boolean
          confirmed_at?: string | null
          conversation_id?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string
          customer_phone_alt?: string | null
          customer_sub_zone?: string | null
          discount_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_number?: string
          order_source?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_cost?: number | null
          status?: string
          store_order_id?: string | null
          subtotal?: number | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          module: string
          shortcut: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          module?: string
          shortcut: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          module?: string
          shortcut?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking: {
        Row: {
          amount: number | null
          conversation_id: string | null
          created_at: string
          customer_address: string | null
          customer_area: string | null
          customer_name: string | null
          customer_phone: string
          final_status: string | null
          id: string
          last_status_date: string | null
          notes: string | null
          order_code: string | null
          order_details: string | null
          pickup_date: string | null
          proc_notes: string | null
          shipment_code: string
          shipping_company: string | null
          status: string
          status_date: string | null
          status_description: string | null
          tenant_id: string
          updated_at: string
          uploaded_at: string
          wa_sent_at: string | null
          wa_template_name: string | null
          wa_template_sent: boolean
        }
        Insert: {
          amount?: number | null
          conversation_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_area?: string | null
          customer_name?: string | null
          customer_phone: string
          final_status?: string | null
          id?: string
          last_status_date?: string | null
          notes?: string | null
          order_code?: string | null
          order_details?: string | null
          pickup_date?: string | null
          proc_notes?: string | null
          shipment_code: string
          shipping_company?: string | null
          status?: string
          status_date?: string | null
          status_description?: string | null
          tenant_id: string
          updated_at?: string
          uploaded_at?: string
          wa_sent_at?: string | null
          wa_template_name?: string | null
          wa_template_sent?: boolean
        }
        Update: {
          amount?: number | null
          conversation_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_area?: string | null
          customer_name?: string | null
          customer_phone?: string
          final_status?: string | null
          id?: string
          last_status_date?: string | null
          notes?: string | null
          order_code?: string | null
          order_details?: string | null
          pickup_date?: string | null
          proc_notes?: string | null
          shipment_code?: string
          shipping_company?: string | null
          status?: string
          status_date?: string | null
          status_description?: string | null
          tenant_id?: string
          updated_at?: string
          uploaded_at?: string
          wa_sent_at?: string | null
          wa_template_name?: string | null
          wa_template_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_config: {
        Row: {
          access_token: string | null
          away_enabled: boolean | null
          away_message: string | null
          business_account_id: string | null
          created_at: string
          id: string
          phone_number_id: string | null
          store_api_key: string | null
          tenant_id: string | null
          updated_at: string
          verify_token: string | null
          welcome_enabled: boolean | null
          welcome_message: string | null
        }
        Insert: {
          access_token?: string | null
          away_enabled?: boolean | null
          away_message?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          phone_number_id?: string | null
          store_api_key?: string | null
          tenant_id?: string | null
          updated_at?: string
          verify_token?: string | null
          welcome_enabled?: boolean | null
          welcome_message?: string | null
        }
        Update: {
          access_token?: string | null
          away_enabled?: boolean | null
          away_message?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          phone_number_id?: string | null
          store_api_key?: string | null
          tenant_id?: string | null
          updated_at?: string
          verify_token?: string | null
          welcome_enabled?: boolean | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          message_count: number | null
          payload_summary: Json | null
          phones: string[] | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          message_count?: number | null
          payload_summary?: Json | null
          phones?: string[] | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          message_count?: number | null
          payload_summary?: Json | null
          phones?: string[] | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "agent"
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
      app_role: ["super_admin", "admin", "agent"],
    },
  },
} as const
