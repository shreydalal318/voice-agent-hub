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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          client_id: string
          created_at: string
          elevenlabs_agent_id: string | null
          id: string
          name: string
          phone_number_id: string | null
          prompt: string | null
          status: string | null
          total_calls: number | null
          total_minutes: number | null
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          id?: string
          name: string
          phone_number_id?: string | null
          prompt?: string | null
          status?: string | null
          total_calls?: number | null
          total_minutes?: number | null
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          id?: string
          name?: string
          phone_number_id?: string | null
          prompt?: string | null
          status?: string | null
          total_calls?: number | null
          total_minutes?: number | null
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agent_id: string | null
          booking_type: string
          client_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          date_time: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          booking_type: string
          client_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          booking_type?: string
          client_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date_time?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          business_name: string
          business_type: string
          created_at: string
          id: string
          max_agents: number | null
          max_minutes: number | null
          subscription_plan: string | null
          subscription_status: string | null
          total_calls: number | null
          updated_at: string
          used_minutes: number | null
          user_id: string
        }
        Insert: {
          business_name: string
          business_type?: string
          created_at?: string
          id?: string
          max_agents?: number | null
          max_minutes?: number | null
          subscription_plan?: string | null
          subscription_status?: string | null
          total_calls?: number | null
          updated_at?: string
          used_minutes?: number | null
          user_id: string
        }
        Update: {
          business_name?: string
          business_type?: string
          created_at?: string
          id?: string
          max_agents?: number | null
          max_minutes?: number | null
          subscription_plan?: string | null
          subscription_status?: string | null
          total_calls?: number | null
          updated_at?: string
          used_minutes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          agent_id: string | null
          client_id: string
          content: string | null
          created_at: string
          file_type: string | null
          file_url: string | null
          id: string
          title: string
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          content?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          title: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          content?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          assigned_agent_id: string | null
          assigned_client_id: string | null
          elevenlabs_phone_number_id: string | null
          vobiz_phone_number_id: string | null
          created_at: string
          id: string
          label: string | null
          number: string
          status: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_client_id?: string | null
          elevenlabs_phone_number_id?: string | null
          vobiz_phone_number_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          number: string
          status?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_client_id?: string | null
          elevenlabs_phone_number_id?: string | null
          vobiz_phone_number_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          number?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
