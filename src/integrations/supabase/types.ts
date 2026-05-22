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
      additional_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string
          date: string
          description: string | null
          id: string
          notes: string | null
          reference_id: string
          reference_type: string
          tenant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number
          cost_type?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          reference_id: string
          reference_type: string
          tenant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          reference_id?: string
          reference_type?: string
          tenant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_costs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_commissions: {
        Row: {
          agent_id: string
          commission_amount: number
          commission_rate: number
          commission_type: string
          created_at: string
          id: string
          month: string
          notes: string | null
          payment_id: string | null
          status: string
          tenant_id: string | null
          total_sales: number
        }
        Insert: {
          agent_id: string
          commission_amount?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          payment_id?: string | null
          status?: string
          tenant_id?: string | null
          total_sales?: number
        }
        Update: {
          agent_id?: string
          commission_amount?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          payment_id?: string | null
          status?: string
          tenant_id?: string | null
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_customers: {
        Row: {
          agent_id: string
          created_at: string
          customer_id: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          customer_id: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_customers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          balance: number
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          opening_balance: number
          tenant_id: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number
          bank_name: string
          branch?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          opening_balance?: number
          tenant_id?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number
          bank_name?: string
          branch?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          opening_balance?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          balance: number
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          tenant_id: string | null
        }
        Insert: {
          account_type: string
          balance?: number
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          account_type?: string
          balance?: number
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          default_gst_rate: number
          default_wht_rate: number
          email: string | null
          fbr_enabled: boolean
          gst_enabled: boolean
          id: string
          logo_url: string | null
          ntn: string | null
          phone: string | null
          strn: string | null
          tenant_id: string | null
          updated_at: string
          website: string | null
          whatsapp_number: string | null
          wht_enabled: boolean
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          default_gst_rate?: number
          default_wht_rate?: number
          email?: string | null
          fbr_enabled?: boolean
          gst_enabled?: boolean
          id?: string
          logo_url?: string | null
          ntn?: string | null
          phone?: string | null
          strn?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          wht_enabled?: boolean
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          default_gst_rate?: number
          default_wht_rate?: number
          email?: string | null
          fbr_enabled?: boolean
          gst_enabled?: boolean
          id?: string
          logo_url?: string | null
          ntn?: string | null
          phone?: string | null
          strn?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          wht_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          credit_note_number: string
          date: string
          id: string
          notes: string | null
          party_id: string
          party_type: string
          reason: string | null
          reference: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_note_number: string
          date?: string
          id?: string
          notes?: string | null
          party_id: string
          party_type: string
          reason?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_number?: string
          date?: string
          id?: string
          notes?: string | null
          party_id?: string
          party_type?: string
          reason?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_distributors: {
        Row: {
          address: string | null
          created_at: string
          customer_id: string
          id: string
          license_expiry: string | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_distributors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_distributors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_licenses: {
        Row: {
          address: string | null
          created_at: string
          customer_id: string
          expiry_date: string | null
          id: string
          license_number: string
          license_type: string
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id: string
          expiry_date?: string | null
          id?: string
          license_number: string
          license_type?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string
          expiry_date?: string | null
          id?: string
          license_number?: string
          license_type?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_licenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_products: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
          rate: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          rate?: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          rate?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          area: string | null
          balance: number
          city: string | null
          company: string | null
          created_at: string
          credit_limit: number
          customer_code: string | null
          email: string | null
          id: string
          name: string
          ntn: string | null
          opening_balance: number
          phone: string | null
          strn: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          credit_limit?: number
          customer_code?: string | null
          email?: string | null
          id?: string
          name: string
          ntn?: string | null
          opening_balance?: number
          phone?: string | null
          strn?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          credit_limit?: number
          customer_code?: string | null
          email?: string | null
          id?: string
          name?: string
          ntn?: string | null
          opening_balance?: number
          phone?: string | null
          strn?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          created_at: string
          customer_id: string | null
          date: string
          delivery_type_label: string | null
          dn_number: string
          freight_provider_id: string | null
          id: string
          items: Json
          notes: string | null
          reference_id: string
          reference_type: string
          status: string
          supplier_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          delivery_type_label?: string | null
          dn_number: string
          freight_provider_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          reference_id: string
          reference_type: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          delivery_type_label?: string | null
          dn_number?: string
          freight_provider_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          reference_id?: string
          reference_type?: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          current_value: number
          document_type: string
          prefix: string
          tenant_id: string
        }
        Insert: {
          current_value?: number
          document_type: string
          prefix: string
          tenant_id: string
        }
        Update: {
          current_value?: number
          document_type?: string
          prefix?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          bank_details_text: string | null
          columns_config: Json
          created_at: string
          document_type: string
          extra_meta_fields: Json
          footer_text: string | null
          id: string
          show_bank_details: boolean
          show_party_area: boolean
          show_party_cnic: boolean
          show_party_license: boolean
          show_total_in_words: boolean
          signature_labels: Json
          tenant_id: string | null
          title: string
        }
        Insert: {
          bank_details_text?: string | null
          columns_config?: Json
          created_at?: string
          document_type: string
          extra_meta_fields?: Json
          footer_text?: string | null
          id?: string
          show_bank_details?: boolean
          show_party_area?: boolean
          show_party_cnic?: boolean
          show_party_license?: boolean
          show_total_in_words?: boolean
          signature_labels?: Json
          tenant_id?: string | null
          title: string
        }
        Update: {
          bank_details_text?: string | null
          columns_config?: Json
          created_at?: string
          document_type?: string
          extra_meta_fields?: Json
          footer_text?: string | null
          id?: string
          show_bank_details?: boolean
          show_party_area?: boolean
          show_party_cnic?: boolean
          show_party_license?: boolean
          show_total_in_words?: boolean
          signature_labels?: Json
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      drap_registrations: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          product_id: string
          registration_date: string | null
          registration_number: string
          renewal_fee: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          registration_date?: string | null
          registration_number: string
          renewal_fee?: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          registration_date?: string | null
          registration_number?: string
          renewal_fee?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drap_registrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drap_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_ledgers: {
        Row: {
          created_at: string
          description: string | null
          expense_type: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          expense_type?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          expense_type?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_ledgers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          date: string
          description: string | null
          expense_number: string
          expense_type: string
          gst_amount: number
          id: string
          ledger_id: string | null
          notes: string | null
          payment_method: string
          tenant_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          expense_number: string
          expense_type?: string
          gst_amount?: number
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method?: string
          tenant_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          expense_number?: string
          expense_type?: string
          gst_amount?: number
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "expense_ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_providers: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      goods_received_notes: {
        Row: {
          created_at: string
          date: string
          grn_number: string
          id: string
          notes: string | null
          po_id: string | null
          received_by: string | null
          supplier_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          grn_number: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          grn_number?: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          amount: number
          batch_number: string | null
          expiry_date: string | null
          grn_id: string
          id: string
          item_name: string
          product_id: string | null
          quantity_ordered: number
          quantity_received: number
          rate: number
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          batch_number?: string | null
          expiry_date?: string | null
          grn_id: string
          id?: string
          item_name: string
          product_id?: string | null
          quantity_ordered?: number
          quantity_received?: number
          rate?: number
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          batch_number?: string | null
          expiry_date?: string | null
          grn_id?: string
          id?: string
          item_name?: string
          product_id?: string | null
          quantity_ordered?: number
          quantity_received?: number
          rate?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          entry_number: string
          id: string
          reference: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          entry_number: string
          id?: string
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          entry_number?: string
          id?: string
          reference?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          tenant_id: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          tenant_id?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          plan: string
          reviewed_at: string | null
          screenshot_url: string
          status: string
          submitted_by: string
          tenant_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          plan?: string
          reviewed_at?: string | null
          screenshot_url: string
          status?: string
          submitted_by: string
          tenant_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          plan?: string
          reviewed_at?: string | null
          screenshot_url?: string
          status?: string
          submitted_by?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          cheque_date: string | null
          cheque_number: string | null
          created_at: string
          date: string
          id: string
          invoice_id: string | null
          notes: string | null
          party_id: string
          party_type: string
          payment_method: string
          payment_number: string
          reference: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          party_id: string
          party_type: string
          payment_method?: string
          payment_number: string
          reference?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          party_id?: string
          party_type?: string
          payment_method?: string
          payment_number?: string
          reference?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          admin_notes: string | null
          company_name: string
          created_at: string
          email: string
          id: string
          phone: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          company_name: string
          created_at?: string
          email: string
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          cost_per_unit: number
          created_at: string
          date: string
          id: string
          job_number: string
          notes: string | null
          our_share_amount: number
          printer_id: string | null
          printer_share_amount: number
          printer_share_percent: number
          product_id: string | null
          quantity_delivered: number
          quantity_ordered: number
          quantity_rejected: number
          rejection_reason: string | null
          status: string
          tenant_id: string | null
          total_cost: number
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          date?: string
          id?: string
          job_number: string
          notes?: string | null
          our_share_amount?: number
          printer_id?: string | null
          printer_share_amount?: number
          printer_share_percent?: number
          product_id?: string | null
          quantity_delivered?: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          total_cost?: number
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          date?: string
          id?: string
          job_number?: string
          notes?: string | null
          our_share_amount?: number
          printer_id?: string | null
          printer_share_amount?: number
          printer_share_percent?: number
          product_id?: string | null
          quantity_delivered?: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          address: string | null
          balance: number
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          ntn: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          ntn?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          ntn?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cost_price: number
          created_at: string
          drap_reg_number: string | null
          gst_rate: number
          id: string
          mrp: number
          name: string
          pack_size: string | null
          product_code: string | null
          reorder_level: number
          selling_price: number
          sku: string | null
          stock_quantity: number
          tenant_id: string | null
          unit: string
        }
        Insert: {
          category?: string
          cost_price?: number
          created_at?: string
          drap_reg_number?: string | null
          gst_rate?: number
          id?: string
          mrp?: number
          name: string
          pack_size?: string | null
          product_code?: string | null
          reorder_level?: number
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          tenant_id?: string | null
          unit?: string
        }
        Update: {
          category?: string
          cost_price?: number
          created_at?: string
          drap_reg_number?: string | null
          gst_rate?: number
          id?: string
          mrp?: number
          name?: string
          pack_size?: string | null
          product_code?: string | null
          reorder_level?: number
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          tenant_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_invoices: {
        Row: {
          accepted_at: string | null
          agent_id: string | null
          converted_invoice_id: string | null
          created_at: string
          customer_id: string | null
          date: string
          gst: number
          id: string
          items: Json
          payment_instructions: string | null
          proforma_number: string
          status: string
          subtotal: number
          tenant_id: string | null
          total: number
          validity_days: number
        }
        Insert: {
          accepted_at?: string | null
          agent_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          customer_id?: string | null
          date?: string
          gst?: number
          id?: string
          items?: Json
          payment_instructions?: string | null
          proforma_number: string
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          validity_days?: number
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          customer_id?: string | null
          date?: string
          gst?: number
          id?: string
          items?: Json
          payment_instructions?: string | null
          proforma_number?: string
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          bill_number: string
          created_at: string
          date: string
          due_date: string | null
          grn_id: string | null
          gst: number
          id: string
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string | null
          total: number
          wht_amount: number
        }
        Insert: {
          bill_number: string
          created_at?: string
          date?: string
          due_date?: string | null
          grn_id?: string | null
          gst?: number
          id?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          wht_amount?: number
        }
        Update: {
          bill_number?: string
          created_at?: string
          date?: string
          due_date?: string | null
          grn_id?: string | null
          gst?: number
          id?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          wht_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          amount: number
          description: string | null
          id: string
          po_id: string
          product_id: string | null
          quantity: number
          quantity_confirmed: number
          rate: number
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          description?: string | null
          id?: string
          po_id: string
          product_id?: string | null
          quantity?: number
          quantity_confirmed?: number
          rate?: number
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          po_id?: string
          product_id?: string | null
          quantity?: number
          quantity_confirmed?: number
          rate?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          date: string
          expected_delivery: string | null
          gst: number
          id: string
          notes: string | null
          po_number: string
          proforma_id: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          date?: string
          expected_delivery?: string | null
          gst?: number
          id?: string
          notes?: string | null
          po_number: string
          proforma_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          date?: string
          expected_delivery?: string | null
          gst?: number
          id?: string
          notes?: string | null
          po_number?: string
          proforma_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "purchase_proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_proforma_items: {
        Row: {
          amount: number
          id: string
          product_id: string | null
          proforma_id: string
          quantity_confirmed: number
          quantity_requested: number
          rate: number
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          id?: string
          product_id?: string | null
          proforma_id: string
          quantity_confirmed?: number
          quantity_requested?: number
          rate?: number
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          product_id?: string | null
          proforma_id?: string
          quantity_confirmed?: number
          quantity_requested?: number
          rate?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_proforma_items_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "purchase_proformas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_proforma_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_proformas: {
        Row: {
          converted_po_id: string | null
          created_at: string
          date: string
          gst: number
          id: string
          notes: string | null
          proforma_number: string
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string | null
          total: number
          validity_days: number
        }
        Insert: {
          converted_po_id?: string | null
          created_at?: string
          date?: string
          gst?: number
          id?: string
          notes?: string | null
          proforma_number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          validity_days?: number
        }
        Update: {
          converted_po_id?: string | null
          created_at?: string
          date?: string
          gst?: number
          id?: string
          notes?: string | null
          proforma_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_proformas_converted_po_id_fkey"
            columns: ["converted_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_proformas_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_proformas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          amount: number
          batch_number: string | null
          id: string
          product_id: string | null
          quantity: number
          rate: number
          return_id: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          batch_number?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          return_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          batch_number?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          return_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          date: string
          id: string
          purchase_invoice_id: string | null
          reason: string | null
          return_number: string
          status: string
          supplier_id: string | null
          tenant_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          purchase_invoice_id?: string | null
          reason?: string | null
          return_number: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          purchase_invoice_id?: string | null
          reason?: string | null
          return_number?: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_alerts: {
        Row: {
          avg_daily_consumption: number
          created_at: string
          current_stock: number
          days_until_stockout: number
          id: string
          notified: boolean
          product_id: string
          product_name: string
          severity: string
          tenant_id: string | null
        }
        Insert: {
          avg_daily_consumption?: number
          created_at?: string
          current_stock?: number
          days_until_stockout?: number
          id?: string
          notified?: boolean
          product_id: string
          product_name: string
          severity?: string
          tenant_id?: string | null
        }
        Update: {
          avg_daily_consumption?: number
          created_at?: string
          current_stock?: number
          days_until_stockout?: number
          id?: string
          notified?: boolean
          product_id?: string
          product_name?: string
          severity?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          id: string
          month: string
          notes: string | null
          payment_method: string
          salary_number: string
          staff_id: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          id?: string
          month: string
          notes?: string | null
          payment_method?: string
          salary_number: string
          staff_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          id?: string
          month?: string
          notes?: string | null
          payment_method?: string
          salary_number?: string
          staff_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_agents: {
        Row: {
          address: string | null
          commission_rate: number
          commission_type: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          commission_rate?: number
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          commission_rate?: number
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_items: {
        Row: {
          amount: number
          batch_number: string | null
          discount_percent: number
          gst_rate: number
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rate: number
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          batch_number?: string | null
          discount_percent?: number
          gst_rate?: number
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rate?: number
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          batch_number?: string | null
          discount_percent?: number
          gst_rate?: number
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          agent_id: string | null
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          discount: number
          due_date: string | null
          fbr_qr_data: string | null
          gst_amount: number
          id: string
          invoice_number: string
          notes: string | null
          status: string
          subtotal: number
          tenant_id: string | null
          total: number
        }
        Insert: {
          agent_id?: string | null
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          due_date?: string | null
          fbr_qr_data?: string | null
          gst_amount?: number
          id?: string
          invoice_number: string
          notes?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
        }
        Update: {
          agent_id?: string | null
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          due_date?: string | null
          fbr_qr_data?: string | null
          gst_amount?: number
          id?: string
          invoice_number?: string
          notes?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          amount: number
          batch_number: string | null
          id: string
          product_id: string | null
          quantity: number
          rate: number
          return_id: string
          tenant_id: string | null
        }
        Insert: {
          amount?: number
          batch_number?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          return_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          batch_number?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          return_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          customer_id: string | null
          date: string
          id: string
          invoice_id: string | null
          reason: string | null
          return_number: string
          status: string
          tenant_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          return_number: string
          status?: string
          tenant_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          return_number?: string
          status?: string
          tenant_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          designation: string | null
          id: string
          joining_date: string | null
          name: string
          phone: string | null
          salary: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          designation?: string | null
          id?: string
          joining_date?: string | null
          name: string
          phone?: string | null
          salary?: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          designation?: string | null
          id?: string
          joining_date?: string | null
          name?: string
          phone?: string | null
          salary?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_number: string | null
          created_at: string
          date: string
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          date?: string
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          date?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          rate: number
          supplier_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          rate?: number
          supplier_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          rate?: number
          supplier_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          license_number: string | null
          name: string
          ntn: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          strn: string | null
          supplier_code: string | null
          tenant_id: string | null
          wht_rate: number
        }
        Insert: {
          address?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          name: string
          ntn?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          strn?: string | null
          supplier_code?: string | null
          tenant_id?: string | null
          wht_rate?: number
        }
        Update: {
          address?: string | null
          balance?: number
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          name?: string
          ntn?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          strn?: string | null
          supplier_code?: string | null
          tenant_id?: string | null
          wht_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_records: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          period: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          period: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          period?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          company_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          max_users: number | null
          owner_email: string | null
          phone: string | null
          plan: string | null
          setup_paid: boolean | null
          subscription_ends_at: string | null
          subscription_status: string | null
          trial_starts_at: string | null
        }
        Insert: {
          company_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_users?: number | null
          owner_email?: string | null
          phone?: string | null
          plan?: string | null
          setup_paid?: boolean | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_starts_at?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_users?: number | null
          owner_email?: string | null
          phone?: string | null
          plan?: string | null
          setup_paid?: boolean | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_starts_at?: string | null
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
      warranty_invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          date: string
          discount_amount: number
          discount_percent: number
          distributor_id: string | null
          gst_amount: number
          id: string
          items: Json
          notes: string | null
          pharmacy_address: string | null
          pharmacy_license_no: string | null
          pharmacy_name: string
          source_invoice_id: string | null
          status: string
          subtotal: number
          tenant_id: string | null
          total: number
          warranty_number: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          discount_amount?: number
          discount_percent?: number
          distributor_id?: string | null
          gst_amount?: number
          id?: string
          items?: Json
          notes?: string | null
          pharmacy_address?: string | null
          pharmacy_license_no?: string | null
          pharmacy_name: string
          source_invoice_id?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          warranty_number: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          discount_amount?: number
          discount_percent?: number
          distributor_id?: string | null
          gst_amount?: number
          id?: string
          items?: Json
          notes?: string | null
          pharmacy_address?: string | null
          pharmacy_license_no?: string | null
          pharmacy_name?: string
          source_invoice_id?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          warranty_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_invoices_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "customer_distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_invoices_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_invoices_tenant_id_fkey"
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
      dashboard_charts: {
        Args: {
          p_month_start: string
          p_today: string
          p_trend_start: string
          p_year_start: string
        }
        Returns: Json
      }
      dashboard_kpis: {
        Args: {
          p_last_month_end: string
          p_last_month_start: string
          p_month_start: string
          p_today: string
          p_week_start: string
          p_year_start: string
        }
        Returns: Json
      }
      generate_document_number: {
        Args: { p_document_type: string }
        Returns: string
      }
      get_user_tenant_id: { Args: never; Returns: string }
      get_user_tenant_role: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      recalc_customer_invoice_status: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalc_supplier_invoice_status: {
        Args: { p_supplier_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      tenant_role: "owner" | "staff"
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
      tenant_role: ["owner", "staff"],
    },
  },
} as const
