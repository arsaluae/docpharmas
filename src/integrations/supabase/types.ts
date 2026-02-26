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
      alerts: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          message: string
          resolved: boolean
          severity: string
          type: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          severity: string
          type: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_name: string | null
          batch_id: string
          created_at: string
          entity_name: string | null
          event_label: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          actor_name?: string | null
          batch_id: string
          created_at?: string
          entity_name?: string | null
          event_label: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          actor_name?: string | null
          batch_id?: string
          created_at?: string
          entity_name?: string | null
          event_label?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          id: string
          name: string
          product: string
          progress: number
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product: string
          progress?: number
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product?: string
          progress?: number
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bmr_steps: {
        Row: {
          batch_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          step_name: string
          step_order: number
          yield_actual: number | null
          yield_expected: number
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          step_name: string
          step_order: number
          yield_actual?: number | null
          yield_expected?: number
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          step_name?: string
          step_order?: number
          yield_actual?: number | null
          yield_expected?: number
        }
        Relationships: [
          {
            foreignKeyName: "bmr_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_folders: {
        Row: {
          arrival_date: string | null
          created_at: string
          duties: number
          freight: number
          id: string
          insurance: number
          lc_number: string
          shipment_name: string
          status: string
          supplier: string
          total_landed_cost: number
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string
          duties?: number
          freight?: number
          id?: string
          insurance?: number
          lc_number: string
          shipment_name: string
          status?: string
          supplier: string
          total_landed_cost?: number
        }
        Update: {
          arrival_date?: string | null
          created_at?: string
          duties?: number
          freight?: number
          id?: string
          insurance?: number
          lc_number?: string
          shipment_name?: string
          status?: string
          supplier?: string
          total_landed_cost?: number
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string
          cost_per_unit: number
          created_at: string
          expiry_date: string
          id: string
          location: string
          name: string
          quantity: number
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost_per_unit?: number
          created_at?: string
          expiry_date: string
          id?: string
          location?: string
          name: string
          quantity?: number
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_per_unit?: number
          created_at?: string
          expiry_date?: string
          id?: string
          location?: string
          name?: string
          quantity?: number
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          batch_id: string | null
          created_at: string
          customer_name: string
          customer_ntn: string
          fbr_qr_data: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          invoice_number: string
          items: Json
          status: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          customer_name: string
          customer_ntn?: string
          fbr_qr_data?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_number: string
          items?: Json
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          customer_name?: string
          customer_ntn?: string
          fbr_qr_data?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_number?: string
          items?: Json
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          priority: string
          read: boolean
          source_id: string | null
          source_type: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          priority?: string
          read?: boolean
          source_id?: string | null
          source_type?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          priority?: string
          read?: boolean
          source_id?: string | null
          source_type?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          lot_number: string
          name: string
          quantity: number
          received_at: string
          released_at: string | null
          released_by: string | null
          status: string
          supplier: string
          unit: string
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          lot_number: string
          name: string
          quantity: number
          received_at?: string
          released_at?: string | null
          released_by?: string | null
          status?: string
          supplier: string
          unit?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          lot_number?: string
          name?: string
          quantity?: number
          received_at?: string
          released_at?: string | null
          released_by?: string | null
          status?: string
          supplier?: string
          unit?: string
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
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
