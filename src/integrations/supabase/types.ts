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
      accounting_periods: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          period_end: string
          period_start: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          period_end: string
          period_start: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          period_end?: string
          period_start?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      accounting_staging: {
        Row: {
          account_code: string | null
          account_name: string | null
          account_number: string | null
          account_type: string | null
          amount: number | null
          bank_name: string | null
          branch: string | null
          created_at: string
          created_by: string | null
          errors: Json | null
          id: string
          import_batch_id: string | null
          kind: string | null
          migration_batch_id: string | null
          notes: string | null
          party_code: string | null
          party_name: string | null
          raw: Json | null
          row_number: number | null
          status: string
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          account_code?: string | null
          account_name?: string | null
          account_number?: string | null
          account_type?: string | null
          amount?: number | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          id?: string
          import_batch_id?: string | null
          kind?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          party_code?: string | null
          party_name?: string | null
          raw?: Json | null
          row_number?: number | null
          status?: string
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          account_code?: string | null
          account_name?: string | null
          account_number?: string | null
          account_type?: string | null
          amount?: number | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          id?: string
          import_batch_id?: string | null
          kind?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          party_code?: string | null
          party_name?: string | null
          raw?: Json | null
          row_number?: number | null
          status?: string
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_staging_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_staging_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      areas: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_number: string | null
          entity_type: string
          id: string
          ip_address: string | null
          tenant_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_number?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          results: Json | null
          schedule: string
          started_at: string
          status: string
          tenants_failed: number
          tenants_succeeded: number
          tenants_total: number
          total_bytes: number
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          results?: Json | null
          schedule?: string
          started_at?: string
          status?: string
          tenants_failed?: number
          tenants_succeeded?: number
          tenants_total?: number
          total_bytes?: number
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          results?: Json | null
          schedule?: string
          started_at?: string
          status?: string
          tenants_failed?: number
          tenants_succeeded?: number
          tenants_total?: number
          total_bytes?: number
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          balance: number
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          import_batch_id: string | null
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
          import_batch_id?: string | null
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
          import_batch_id?: string | null
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
          import_batch_id: string | null
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
          import_batch_id?: string | null
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
          import_batch_id?: string | null
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
      city_products: {
        Row: {
          city: string
          created_at: string
          id: string
          preferred_rate: number | null
          priority: number
          product_id: string
          tenant_id: string | null
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          preferred_rate?: number | null
          priority?: number
          product_id: string
          tenant_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          preferred_rate?: number | null
          priority?: number
          product_id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          allow_expired_sale: boolean
          allow_negative_stock: boolean
          auto_create_missing_suppliers: boolean
          company_name: string | null
          created_at: string
          default_gst_rate: number
          default_wht_rate: number
          email: string | null
          fbr_enabled: boolean
          gst_enabled: boolean
          id: string
          invoice_delete_grace_hours: number
          logo_url: string | null
          ntn: string | null
          phone: string | null
          require_payment_in_approval: boolean
          sales_agent_scope: string
          show_customer_mobile_on_docs: boolean
          show_customer_phone_on_docs: boolean
          show_supplier_mobile_on_docs: boolean
          show_supplier_phone_on_docs: boolean
          strn: string | null
          tenant_id: string | null
          updated_at: string
          warranty_note_text: string | null
          website: string | null
          whatsapp_number: string | null
          wht_enabled: boolean
        }
        Insert: {
          address?: string | null
          allow_expired_sale?: boolean
          allow_negative_stock?: boolean
          auto_create_missing_suppliers?: boolean
          company_name?: string | null
          created_at?: string
          default_gst_rate?: number
          default_wht_rate?: number
          email?: string | null
          fbr_enabled?: boolean
          gst_enabled?: boolean
          id?: string
          invoice_delete_grace_hours?: number
          logo_url?: string | null
          ntn?: string | null
          phone?: string | null
          require_payment_in_approval?: boolean
          sales_agent_scope?: string
          show_customer_mobile_on_docs?: boolean
          show_customer_phone_on_docs?: boolean
          show_supplier_mobile_on_docs?: boolean
          show_supplier_phone_on_docs?: boolean
          strn?: string | null
          tenant_id?: string | null
          updated_at?: string
          warranty_note_text?: string | null
          website?: string | null
          whatsapp_number?: string | null
          wht_enabled?: boolean
        }
        Update: {
          address?: string | null
          allow_expired_sale?: boolean
          allow_negative_stock?: boolean
          auto_create_missing_suppliers?: boolean
          company_name?: string | null
          created_at?: string
          default_gst_rate?: number
          default_wht_rate?: number
          email?: string | null
          fbr_enabled?: boolean
          gst_enabled?: boolean
          id?: string
          invoice_delete_grace_hours?: number
          logo_url?: string | null
          ntn?: string | null
          phone?: string | null
          require_payment_in_approval?: boolean
          sales_agent_scope?: string
          show_customer_mobile_on_docs?: boolean
          show_customer_phone_on_docs?: boolean
          show_supplier_mobile_on_docs?: boolean
          show_supplier_phone_on_docs?: boolean
          strn?: string | null
          tenant_id?: string | null
          updated_at?: string
          warranty_note_text?: string | null
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
      credit_note_applications: {
        Row: {
          amount: number
          created_at: string
          credit_note_id: string
          date: string
          id: string
          invoice_id: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          credit_note_id: string
          date?: string
          id?: string
          invoice_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_id?: string
          date?: string
          id?: string
          invoice_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_applications_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_applications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_applications_tenant_id_fkey"
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
          applied_amount: number
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount?: number
          applied_amount?: number
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          applied_amount?: number
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
      customer_staging: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          area: string | null
          business_name: string | null
          city: string | null
          cnic: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_days: number | null
          credit_limit: number | null
          customer_status: string | null
          district: string | null
          email: string | null
          errors: Json | null
          first_name: string | null
          id: string
          import_batch_id: string | null
          last_name: string | null
          migration_batch_id: string | null
          mobile: string | null
          notes: string | null
          old_erp_account_code: string | null
          old_erp_id: string | null
          opening_balance: number | null
          phone: string | null
          postal_code: string | null
          province: string | null
          raw: Json | null
          row_number: number | null
          sms_mobile: string | null
          status: string
          tax_number: string | null
          tenant_id: string | null
          title: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          area?: string | null
          business_name?: string | null
          city?: string | null
          cnic?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          customer_status?: string | null
          district?: string | null
          email?: string | null
          errors?: Json | null
          first_name?: string | null
          id?: string
          import_batch_id?: string | null
          last_name?: string | null
          migration_batch_id?: string | null
          mobile?: string | null
          notes?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          raw?: Json | null
          row_number?: number | null
          sms_mobile?: string | null
          status?: string
          tax_number?: string | null
          tenant_id?: string | null
          title?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          area?: string | null
          business_name?: string | null
          city?: string | null
          cnic?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          customer_status?: string | null
          district?: string | null
          email?: string | null
          errors?: Json | null
          first_name?: string | null
          id?: string
          import_batch_id?: string | null
          last_name?: string | null
          migration_batch_id?: string | null
          mobile?: string | null
          notes?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          raw?: Json | null
          row_number?: number | null
          sms_mobile?: string | null
          status?: string
          tax_number?: string | null
          tenant_id?: string | null
          title?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staging_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staging_tenant_id_fkey"
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
          address_line2: string | null
          area: string | null
          balance: number
          city: string | null
          cnic: string | null
          company: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          credit_days: number | null
          credit_limit: number
          customer_code: string | null
          district: string | null
          email: string | null
          first_name: string | null
          id: string
          import_batch_id: string | null
          is_active: boolean
          last_name: string | null
          name: string
          notes: string | null
          ntn: string | null
          old_erp_account_code: string | null
          old_erp_id: string | null
          opening_balance: number
          phone: string | null
          phones: Json
          postal_code: string | null
          province: string | null
          sms_mobile: string | null
          status: string | null
          strn: string | null
          tax_number: string | null
          tenant_id: string | null
          title: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          address_line2?: string | null
          area?: string | null
          balance?: number
          city?: string | null
          cnic?: string | null
          company?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number
          customer_code?: string | null
          district?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          last_name?: string | null
          name: string
          notes?: string | null
          ntn?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          province?: string | null
          sms_mobile?: string | null
          status?: string | null
          strn?: string | null
          tax_number?: string | null
          tenant_id?: string | null
          title?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          address_line2?: string | null
          area?: string | null
          balance?: number
          city?: string | null
          cnic?: string | null
          company?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number
          customer_code?: string | null
          district?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          last_name?: string | null
          name?: string
          notes?: string | null
          ntn?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          province?: string | null
          sms_mobile?: string | null
          status?: string | null
          strn?: string | null
          tax_number?: string | null
          tenant_id?: string | null
          title?: string | null
          website?: string | null
          whatsapp?: string | null
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
      debit_note_applications: {
        Row: {
          amount: number
          created_at: string
          date: string
          debit_note_id: string
          id: string
          invoice_id: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          debit_note_id: string
          id?: string
          invoice_id: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          debit_note_id?: string
          id?: string
          invoice_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debit_note_applications_debit_note_id_fkey"
            columns: ["debit_note_id"]
            isOneToOne: false
            referencedRelation: "debit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_applications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          amount: number
          applied_amount: number
          created_at: string
          date: string
          debit_note_number: string
          id: string
          notes: string | null
          party_id: string
          party_type: string
          reason: string | null
          reference: string | null
          status: string
          tenant_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount?: number
          applied_amount?: number
          created_at?: string
          date?: string
          debit_note_number: string
          id?: string
          notes?: string | null
          party_id: string
          party_type: string
          reason?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          applied_amount?: number
          created_at?: string
          date?: string
          debit_note_number?: string
          id?: string
          notes?: string | null
          party_id?: string
          party_type?: string
          reason?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      delivery_notes: {
        Row: {
          agent_id: string | null
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agent_id?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agent_id?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "drap_registrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drap_registrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          freight_provider_id: string | null
          gst_amount: number
          id: string
          ledger_id: string | null
          notes: string | null
          payment_method: string
          status: string
          tenant_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          freight_provider_id?: string | null
          gst_amount?: number
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method?: string
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          freight_provider_id?: string | null
          gst_amount?: number
          id?: string
          ledger_id?: string | null
          notes?: string | null
          payment_method?: string
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
            foreignKeyName: "expenses_freight_provider_id_fkey"
            columns: ["freight_provider_id"]
            isOneToOne: false
            referencedRelation: "freight_providers"
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
          status: string
          supplier_id: string | null
          tenant_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          grn_number: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          grn_number?: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          import_batch_id: string | null
          item_name: string
          manufacturing_date: string | null
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
          import_batch_id?: string | null
          item_name: string
          manufacturing_date?: string | null
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
          import_batch_id?: string | null
          item_name?: string
          manufacturing_date?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
      import_batches: {
        Row: {
          column_mapping: Json | null
          created_at: string
          created_by: string | null
          entity_type: string
          error_summary: Json | null
          file_name: string | null
          file_size: number | null
          id: string
          invalid_count: number
          mapped_count: number
          options: Json | null
          posted_at: string | null
          posted_count: number
          rollback_reason: string | null
          rolled_back_at: string | null
          row_count: number
          status: string
          tenant_id: string
          valid_count: number
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type: string
          error_summary?: Json | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          invalid_count?: number
          mapped_count?: number
          options?: Json | null
          posted_at?: string | null
          posted_count?: number
          rollback_reason?: string | null
          rolled_back_at?: string | null
          row_count?: number
          status?: string
          tenant_id: string
          valid_count?: number
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          error_summary?: Json | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          invalid_count?: number
          mapped_count?: number
          options?: Json | null
          posted_at?: string | null
          posted_count?: number
          rollback_reason?: string | null
          rolled_back_at?: string | null
          row_count?: number
          status?: string
          tenant_id?: string
          valid_count?: number
        }
        Relationships: []
      }
      import_staging_rows: {
        Row: {
          batch_id: string
          created_at: string
          errors: Json | null
          id: string
          normalized: Json | null
          posted_entity_id: string | null
          raw: Json | null
          row_number: number
          status: string
          tenant_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          errors?: Json | null
          id?: string
          normalized?: Json | null
          posted_entity_id?: string | null
          raw?: Json | null
          row_number: number
          status?: string
          tenant_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          errors?: Json | null
          id?: string
          normalized?: Json | null
          posted_entity_id?: string | null
          raw?: Json | null
          row_number?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_staging_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_staging: {
        Row: {
          batch_cost: number | null
          batch_number: string | null
          batch_supplier: string | null
          created_at: string
          created_by: string | null
          errors: Json | null
          expiry_date: string | null
          id: string
          import_batch_id: string | null
          location: string | null
          manufacturing_date: string | null
          migration_batch_id: string | null
          notes: string | null
          product_name: string | null
          purchase_reference: string | null
          quantity: number | null
          raw: Json | null
          row_number: number | null
          sku: string | null
          status: string
          tenant_id: string | null
          unit: string | null
        }
        Insert: {
          batch_cost?: number | null
          batch_number?: string | null
          batch_supplier?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          expiry_date?: string | null
          id?: string
          import_batch_id?: string | null
          location?: string | null
          manufacturing_date?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          product_name?: string | null
          purchase_reference?: string | null
          quantity?: number | null
          raw?: Json | null
          row_number?: number | null
          sku?: string | null
          status?: string
          tenant_id?: string | null
          unit?: string | null
        }
        Update: {
          batch_cost?: number | null
          batch_number?: string | null
          batch_supplier?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          expiry_date?: string | null
          id?: string
          import_batch_id?: string | null
          location?: string | null
          manufacturing_date?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          product_name?: string | null
          purchase_reference?: string | null
          quantity?: number | null
          raw?: Json | null
          row_number?: number | null
          sku?: string | null
          status?: string
          tenant_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_staging_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_staging_tenant_id_fkey"
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      migration_batches: {
        Row: {
          after_counts: Json | null
          before_counts: Json | null
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          source_file: string | null
          started_at: string
          started_by: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          after_counts?: Json | null
          before_counts?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_file?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          after_counts?: Json | null
          before_counts?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_file?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_errors: {
        Row: {
          created_at: string
          entity: string
          field: string | null
          id: string
          import_batch_id: string | null
          message: string
          migration_batch_id: string | null
          raw: Json | null
          row_number: number | null
          severity: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          entity: string
          field?: string | null
          id?: string
          import_batch_id?: string | null
          message: string
          migration_batch_id?: string | null
          raw?: Json | null
          row_number?: number | null
          severity?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          entity?: string
          field?: string | null
          id?: string
          import_batch_id?: string | null
          message?: string
          migration_batch_id?: string | null
          raw?: Json | null
          row_number?: number | null
          severity?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_errors_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_errors_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_errors_tenant_id_fkey"
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
          agent_id: string | null
          amount: number
          bank_account_id: string | null
          cheque_date: string | null
          cheque_number: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          idempotency_key: string | null
          import_batch_id: string | null
          invoice_id: string | null
          notes: string | null
          party_id: string
          party_type: string
          payment_method: string
          payment_number: string
          reference: string | null
          source: string
          status: string
          tenant_id: string | null
          type: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agent_id?: string | null
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          idempotency_key?: string | null
          import_batch_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          party_id: string
          party_type: string
          payment_method?: string
          payment_number: string
          reference?: string | null
          source?: string
          status?: string
          tenant_id?: string | null
          type: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agent_id?: string | null
          amount?: number
          bank_account_id?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          idempotency_key?: string | null
          import_batch_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          party_id?: string
          party_type?: string
          payment_method?: string
          payment_number?: string
          reference?: string | null
          source?: string
          status?: string
          tenant_id?: string | null
          type?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sales_agents"
            referencedColumns: ["id"]
          },
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
      print_deliveries: {
        Row: {
          created_at: string
          date: string
          delivery_note_no: string | null
          id: string
          notes: string | null
          print_job_id: string
          qty_delivered: number
          received_by: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          delivery_note_no?: string | null
          id?: string
          notes?: string | null
          print_job_id: string
          qty_delivered: number
          received_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          delivery_note_no?: string | null
          id?: string
          notes?: string | null
          print_job_id?: string
          qty_delivered?: number
          received_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_deliveries_print_job_id_fkey"
            columns: ["print_job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_dispatches: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          print_job_id: string
          qty_dispatched: number
          supplier_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          print_job_id: string
          qty_dispatched: number
          supplier_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          print_job_id?: string
          qty_dispatched?: number
          supplier_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_dispatches_print_job_id_fkey"
            columns: ["print_job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_dispatches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_dispatches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          allotted_supplier_id: string | null
          cost_per_unit: number
          created_at: string
          date: string
          factory_name: string | null
          id: string
          job_number: string
          notes: string | null
          our_share_amount: number
          printer_id: string | null
          printer_share_amount: number
          printer_share_percent: number
          product_id: string | null
          purchase_order_id: string | null
          quantity_at_factory: number | null
          quantity_delivered: number
          quantity_dispatched_to_supplier: number
          quantity_ordered: number
          quantity_rejected: number
          rejection_reason: string | null
          special_instructions: string | null
          status: string
          tenant_id: string | null
          total_cost: number
        }
        Insert: {
          allotted_supplier_id?: string | null
          cost_per_unit?: number
          created_at?: string
          date?: string
          factory_name?: string | null
          id?: string
          job_number: string
          notes?: string | null
          our_share_amount?: number
          printer_id?: string | null
          printer_share_amount?: number
          printer_share_percent?: number
          product_id?: string | null
          purchase_order_id?: string | null
          quantity_at_factory?: number | null
          quantity_delivered?: number
          quantity_dispatched_to_supplier?: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          special_instructions?: string | null
          status?: string
          tenant_id?: string | null
          total_cost?: number
        }
        Update: {
          allotted_supplier_id?: string | null
          cost_per_unit?: number
          created_at?: string
          date?: string
          factory_name?: string | null
          id?: string
          job_number?: string
          notes?: string | null
          our_share_amount?: number
          printer_id?: string | null
          printer_share_amount?: number
          printer_share_percent?: number
          product_id?: string | null
          purchase_order_id?: string | null
          quantity_at_factory?: number | null
          quantity_delivered?: number
          quantity_dispatched_to_supplier?: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          special_instructions?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "print_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "print_jobs_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_proformas"
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
      print_rejections: {
        Row: {
          cost_per_unit: number
          created_at: string
          date: string
          debit_note_id: string | null
          evidence_notes: string | null
          expense_id: string | null
          id: string
          our_share_amount: number
          our_share_percent: number
          print_job_id: string
          qty_rejected: number
          reason: string | null
          tenant_id: string | null
          total_cost: number
          vendor_share_amount: number
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          date?: string
          debit_note_id?: string | null
          evidence_notes?: string | null
          expense_id?: string | null
          id?: string
          our_share_amount?: number
          our_share_percent?: number
          print_job_id: string
          qty_rejected: number
          reason?: string | null
          tenant_id?: string | null
          total_cost?: number
          vendor_share_amount?: number
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          date?: string
          debit_note_id?: string | null
          evidence_notes?: string | null
          expense_id?: string | null
          id?: string
          our_share_amount?: number
          our_share_percent?: number
          print_job_id?: string
          qty_rejected?: number
          reason?: string | null
          tenant_id?: string | null
          total_cost?: number
          vendor_share_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_rejections_debit_note_id_fkey"
            columns: ["debit_note_id"]
            isOneToOne: false
            referencedRelation: "debit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_rejections_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_rejections_print_job_id_fkey"
            columns: ["print_job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_rejections_tenant_id_fkey"
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
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
      product_staging: {
        Row: {
          barcode: string | null
          batch_tracking: boolean | null
          brand: string | null
          category: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          errors: Json | null
          expense_account: string | null
          expiry_tracking: boolean | null
          generic_name: string | null
          id: string
          import_batch_id: string | null
          income_account: string | null
          large_pack_size: string | null
          low_stock_level: number | null
          manufacturer: string | null
          migration_batch_id: string | null
          notes: string | null
          old_erp_id: string | null
          product_code: string | null
          product_name: string | null
          product_status: string | null
          raw: Json | null
          reorder_level: number | null
          retail_price: number | null
          row_number: number | null
          sale_price: number | null
          sku: string | null
          status: string
          stock_account: string | null
          sub_category: string | null
          supplier: string | null
          tax_percent: number | null
          tenant_id: string | null
          trade_price: number | null
          unit: string | null
          weight: string | null
        }
        Insert: {
          barcode?: string | null
          batch_tracking?: boolean | null
          brand?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          expense_account?: string | null
          expiry_tracking?: boolean | null
          generic_name?: string | null
          id?: string
          import_batch_id?: string | null
          income_account?: string | null
          large_pack_size?: string | null
          low_stock_level?: number | null
          manufacturer?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          old_erp_id?: string | null
          product_code?: string | null
          product_name?: string | null
          product_status?: string | null
          raw?: Json | null
          reorder_level?: number | null
          retail_price?: number | null
          row_number?: number | null
          sale_price?: number | null
          sku?: string | null
          status?: string
          stock_account?: string | null
          sub_category?: string | null
          supplier?: string | null
          tax_percent?: number | null
          tenant_id?: string | null
          trade_price?: number | null
          unit?: string | null
          weight?: string | null
        }
        Update: {
          barcode?: string | null
          batch_tracking?: boolean | null
          brand?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          expense_account?: string | null
          expiry_tracking?: boolean | null
          generic_name?: string | null
          id?: string
          import_batch_id?: string | null
          income_account?: string | null
          large_pack_size?: string | null
          low_stock_level?: number | null
          manufacturer?: string | null
          migration_batch_id?: string | null
          notes?: string | null
          old_erp_id?: string | null
          product_code?: string | null
          product_name?: string | null
          product_status?: string | null
          raw?: Json | null
          reorder_level?: number | null
          retail_price?: number | null
          row_number?: number | null
          sale_price?: number | null
          sku?: string | null
          status?: string
          stock_account?: string | null
          sub_category?: string | null
          supplier?: string | null
          tax_percent?: number | null
          tenant_id?: string | null
          trade_price?: number | null
          unit?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_staging_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_staging_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          batch_tracking: boolean
          brand: string | null
          category: string
          cost_price: number
          created_at: string
          drap_reg_number: string | null
          expense_account: string | null
          expiry_tracking: boolean
          generic_name: string | null
          gst_rate: number
          id: string
          import_batch_id: string | null
          income_account: string | null
          is_active: boolean
          legacy_codes: Json | null
          low_stock_level: number | null
          manufacturer: string | null
          mrp: number
          name: string
          notes: string | null
          old_erp_id: string | null
          pack_size: string | null
          product_code: string | null
          reorder_level: number
          retail_price: number | null
          selling_price: number
          sku: string | null
          status: string | null
          stock_account: string | null
          stock_quantity: number
          sub_category: string | null
          supplier_id: string | null
          tax_percent: number | null
          tenant_id: string | null
          trade_price: number | null
          unit: string
        }
        Insert: {
          barcode?: string | null
          batch_tracking?: boolean
          brand?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          drap_reg_number?: string | null
          expense_account?: string | null
          expiry_tracking?: boolean
          generic_name?: string | null
          gst_rate?: number
          id?: string
          import_batch_id?: string | null
          income_account?: string | null
          is_active?: boolean
          legacy_codes?: Json | null
          low_stock_level?: number | null
          manufacturer?: string | null
          mrp?: number
          name: string
          notes?: string | null
          old_erp_id?: string | null
          pack_size?: string | null
          product_code?: string | null
          reorder_level?: number
          retail_price?: number | null
          selling_price?: number
          sku?: string | null
          status?: string | null
          stock_account?: string | null
          stock_quantity?: number
          sub_category?: string | null
          supplier_id?: string | null
          tax_percent?: number | null
          tenant_id?: string | null
          trade_price?: number | null
          unit?: string
        }
        Update: {
          barcode?: string | null
          batch_tracking?: boolean
          brand?: string | null
          category?: string
          cost_price?: number
          created_at?: string
          drap_reg_number?: string | null
          expense_account?: string | null
          expiry_tracking?: boolean
          generic_name?: string | null
          gst_rate?: number
          id?: string
          import_batch_id?: string | null
          income_account?: string | null
          is_active?: boolean
          legacy_codes?: Json | null
          low_stock_level?: number | null
          manufacturer?: string | null
          mrp?: number
          name?: string
          notes?: string | null
          old_erp_id?: string | null
          pack_size?: string | null
          product_code?: string | null
          reorder_level?: number
          retail_price?: number | null
          selling_price?: number
          sku?: string | null
          status?: string | null
          stock_account?: string | null
          stock_quantity?: number
          sub_category?: string | null
          supplier_id?: string | null
          tax_percent?: number | null
          tenant_id?: string | null
          trade_price?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          approved_at: string | null
          bill_number: string
          created_at: string
          date: string
          due_date: string | null
          grn_id: string | null
          gst: number
          id: string
          import_batch_id: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string | null
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wht_amount: number
        }
        Insert: {
          approved_at?: string | null
          bill_number: string
          created_at?: string
          date?: string
          due_date?: string | null
          grn_id?: string | null
          gst?: number
          id?: string
          import_batch_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_amount?: number
        }
        Update: {
          approved_at?: string | null
          bill_number?: string
          created_at?: string
          date?: string
          due_date?: string | null
          grn_id?: string | null
          gst?: number
          id?: string
          import_batch_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          batch_number: string | null
          description: string | null
          expiry_date: string | null
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
          batch_number?: string | null
          description?: string | null
          expiry_date?: string | null
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
          batch_number?: string | null
          description?: string | null
          expiry_date?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      purchase_print_allocations: {
        Row: {
          created_at: string
          grn_id: string | null
          id: string
          print_job_id: string
          printing_cost_per_unit: number
          product_id: string
          purchase_invoice_id: string | null
          quantity_consumed: number
          quantity_reserved: number
          source: string
          status: string
          supplier_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          grn_id?: string | null
          id?: string
          print_job_id: string
          printing_cost_per_unit?: number
          product_id: string
          purchase_invoice_id?: string | null
          quantity_consumed?: number
          quantity_reserved?: number
          source: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          grn_id?: string | null
          id?: string
          print_job_id?: string
          printing_cost_per_unit?: number
          product_id?: string
          purchase_invoice_id?: string | null
          quantity_consumed?: number
          quantity_reserved?: number
          source?: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_print_allocations_print_job_id_fkey"
            columns: ["print_job_id"]
            isOneToOne: false
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_proforma_items: {
        Row: {
          amount: number
          batch_number: string | null
          expiry_date: string | null
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
          batch_number?: string | null
          expiry_date?: string | null
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
          batch_number?: string | null
          expiry_date?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          return_reason: string | null
          status: string
          supplier_id: string | null
          tenant_id: string | null
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          purchase_invoice_id?: string | null
          reason?: string | null
          return_number: string
          return_reason?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          purchase_invoice_id?: string | null
          reason?: string | null
          return_number?: string
          return_reason?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      reconciliation_log: {
        Row: {
          computed_value: number | null
          drift: number | null
          entity_id: string | null
          entity_label: string | null
          id: string
          notes: string | null
          run_at: string
          scope: string
          status: string
          stored_value: number | null
          tenant_id: string
        }
        Insert: {
          computed_value?: number | null
          drift?: number | null
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          notes?: string | null
          run_at?: string
          scope: string
          status?: string
          stored_value?: number | null
          tenant_id: string
        }
        Update: {
          computed_value?: number | null
          drift?: number | null
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          notes?: string | null
          run_at?: string
          scope?: string
          status?: string
          stored_value?: number | null
          tenant_id?: string
        }
        Relationships: []
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reorder_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
      role_capabilities: {
        Row: {
          can_approve: boolean
          can_read: boolean
          can_void: boolean
          can_write: boolean
          resource: string
          role: Database["public"]["Enums"]["tenant_role"]
        }
        Insert: {
          can_approve?: boolean
          can_read?: boolean
          can_void?: boolean
          can_write?: boolean
          resource: string
          role: Database["public"]["Enums"]["tenant_role"]
        }
        Update: {
          can_approve?: boolean
          can_read?: boolean
          can_void?: boolean
          can_write?: boolean
          resource?: string
          role?: Database["public"]["Enums"]["tenant_role"]
        }
        Relationships: []
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
          is_active: boolean
          name: string
          phone: string | null
          status: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          commission_rate?: number
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          commission_rate?: number
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
          user_id?: string | null
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
          expiry_date: string | null
          gst_rate: number
          id: string
          import_batch_id: string | null
          invoice_id: string
          mrp: number | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity: number
          rate: number
          tenant_id: string | null
          unit_cost: number
        }
        Insert: {
          amount?: number
          batch_number?: string | null
          discount_percent?: number
          expiry_date?: string | null
          gst_rate?: number
          id?: string
          import_batch_id?: string | null
          invoice_id: string
          mrp?: number | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          rate?: number
          tenant_id?: string | null
          unit_cost?: number
        }
        Update: {
          amount?: number
          batch_number?: string | null
          discount_percent?: number
          expiry_date?: string | null
          gst_rate?: number
          id?: string
          import_batch_id?: string | null
          invoice_id?: string
          mrp?: number | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          rate?: number
          tenant_id?: string | null
          unit_cost?: number
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          approved_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          discount: number
          due_date: string | null
          fbr_qr_data: string | null
          gst_amount: number
          id: string
          idempotency_key: string | null
          import_batch_id: string | null
          invoice_number: string
          notes: string | null
          status: string
          subtotal: number
          tenant_id: string | null
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agent_id?: string | null
          amount_paid?: number
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          due_date?: string | null
          fbr_qr_data?: string | null
          gst_amount?: number
          id?: string
          idempotency_key?: string | null
          import_batch_id?: string | null
          invoice_number: string
          notes?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agent_id?: string | null
          amount_paid?: number
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount?: number
          due_date?: string | null
          fbr_qr_data?: string | null
          gst_amount?: number
          id?: string
          idempotency_key?: string | null
          import_batch_id?: string | null
          invoice_number?: string
          notes?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
          return_reason: string | null
          status: string
          tenant_id: string | null
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          return_number: string
          return_reason?: string | null
          status?: string
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          return_number?: string
          return_reason?: string | null
          status?: string
          tenant_id?: string | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      stock_audit_log: {
        Row: {
          created_at: string
          id: string
          new_quantity: number
          old_quantity: number
          performed_by: string | null
          product_id: string
          reason: string | null
          tenant_id: string | null
          variance: number
        }
        Insert: {
          created_at?: string
          id?: string
          new_quantity: number
          old_quantity: number
          performed_by?: string | null
          product_id: string
          reason?: string | null
          tenant_id?: string | null
          variance: number
        }
        Update: {
          created_at?: string
          id?: string
          new_quantity?: number
          old_quantity?: number
          performed_by?: string | null
          product_id?: string
          reason?: string | null
          tenant_id?: string | null
          variance?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_number: string | null
          created_at: string
          date: string
          id: string
          import_batch_id: string | null
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          status: string
          tenant_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          date?: string
          id?: string
          import_batch_id?: string | null
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          date?: string
          id?: string
          import_batch_id?: string | null
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
      supplier_staging: {
        Row: {
          address: string | null
          area: string | null
          bank_account: string | null
          bank_name: string | null
          business_name: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          errors: Json | null
          id: string
          import_batch_id: string | null
          migration_batch_id: string | null
          mobile: string | null
          notes: string | null
          ntn: string | null
          old_erp_id: string | null
          opening_balance: number | null
          payment_terms_days: number | null
          phone: string | null
          postal_code: string | null
          province: string | null
          raw: Json | null
          row_number: number | null
          status: string
          strn: string | null
          supplier_code: string | null
          supplier_status: string | null
          tax_registration: string | null
          tenant_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          bank_account?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          errors?: Json | null
          id?: string
          import_batch_id?: string | null
          migration_batch_id?: string | null
          mobile?: string | null
          notes?: string | null
          ntn?: string | null
          old_erp_id?: string | null
          opening_balance?: number | null
          payment_terms_days?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          raw?: Json | null
          row_number?: number | null
          status?: string
          strn?: string | null
          supplier_code?: string | null
          supplier_status?: string | null
          tax_registration?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          bank_account?: string | null
          bank_name?: string | null
          business_name?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          errors?: Json | null
          id?: string
          import_batch_id?: string | null
          migration_batch_id?: string | null
          mobile?: string | null
          notes?: string | null
          ntn?: string | null
          old_erp_id?: string | null
          opening_balance?: number | null
          payment_terms_days?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          raw?: Json | null
          row_number?: number | null
          status?: string
          strn?: string | null
          supplier_code?: string | null
          supplier_status?: string | null
          tax_registration?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_staging_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_staging_tenant_id_fkey"
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
          area: string | null
          balance: number
          bank_account: string | null
          bank_name: string | null
          city: string | null
          company: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          import_batch_id: string | null
          is_active: boolean
          license_expiry_date: string | null
          license_number: string | null
          name: string
          notes: string | null
          ntn: string | null
          old_erp_account_code: string | null
          old_erp_id: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          phones: Json
          postal_code: string | null
          province: string | null
          status: string | null
          strn: string | null
          supplier_code: string | null
          tax_registration: string | null
          tenant_id: string | null
          whatsapp: string | null
          wht_rate: number
        }
        Insert: {
          address?: string | null
          area?: string | null
          balance?: number
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          license_expiry_date?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          ntn?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          province?: string | null
          status?: string | null
          strn?: string | null
          supplier_code?: string | null
          tax_registration?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
          wht_rate?: number
        }
        Update: {
          address?: string | null
          area?: string | null
          balance?: number
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          license_expiry_date?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          ntn?: string | null
          old_erp_account_code?: string | null
          old_erp_id?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          province?: string | null
          status?: string | null
          strn?: string | null
          supplier_code?: string | null
          tax_registration?: string | null
          tenant_id?: string | null
          whatsapp?: string | null
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      whatsapp_templates: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          id: string
          is_active: boolean
          is_default: boolean
          message_body: string
          template_name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          message_body: string
          template_name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          message_body?: string
          template_name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      agent_batch_availability: {
        Row: {
          available_qty: number | null
          batch_number: string | null
          expiry_date: string | null
          expiry_status: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          selling_price: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agent_stock_availability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sales_product_catalog_view"
            referencedColumns: ["product_id"]
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
      agent_stock_availability: {
        Row: {
          available_qty: number | null
          batch_count: number | null
          brand: string | null
          category: string | null
          generic_name: string | null
          gst_rate: number | null
          low_stock_level: number | null
          mrp: number | null
          name: string | null
          nearest_expiry: string | null
          pack_size: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          reorder_level: number | null
          sale_price: number | null
          selling_price: number | null
          sku: string | null
          stock_status: string | null
          sub_category: string | null
          supplier_name: string | null
          tenant_id: string | null
          unit: string | null
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
      mv_trial_balance: {
        Row: {
          account_id: string | null
          account_type: string | null
          code: string | null
          credit: number | null
          debit: number | null
          name: string | null
          net: number | null
          period: string | null
          tenant_id: string | null
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
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_product_catalog_view: {
        Row: {
          available_qty: number | null
          batch_count: number | null
          brand: string | null
          category: string | null
          generic_name: string | null
          gst_rate: number | null
          low_stock_level: number | null
          mrp: number | null
          name: string | null
          nearest_expiry: string | null
          pack_size: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          reorder_level: number | null
          sale_price: number | null
          selling_price: number | null
          sku: string | null
          stock_status: string | null
          sub_category: string | null
          supplier_name: string | null
          tenant_id: string | null
          unit: string | null
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
      v_trial_balance: {
        Row: {
          account_id: string | null
          account_type: string | null
          code: string | null
          credit: number | null
          debit: number | null
          name: string | null
          net: number | null
          period: string | null
          tenant_id: string | null
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
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _backup_cron_secret: { Args: never; Returns: string }
      agent_can_see_customer: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      current_sales_agent_id: { Args: never; Returns: string }
      current_tenant_role: {
        Args: never
        Returns: Database["public"]["Enums"]["tenant_role"]
      }
      current_user_can: {
        Args: { p_action: string; p_resource: string }
        Returns: boolean
      }
      customers_cities: { Args: never; Returns: string[] }
      customers_summary: { Args: never; Returns: Json }
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
      delete_invoice_with_grace: {
        Args: { p_id: string; p_reason: string; p_table: string }
        Returns: undefined
      }
      generate_document_number: {
        Args: { p_document_type: string }
        Returns: string
      }
      generate_document_number_for_tenant: {
        Args: { p_document_type: string; p_tenant_id: string }
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
      invoice_delete_grace_remaining: {
        Args: { p_id: string; p_table: string }
        Returns: string
      }
      is_agent_customer: { Args: { p_customer_id: string }; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      migration_pre_snapshot: { Args: never; Returns: Json }
      preview_wipe_counts: { Args: never; Returns: Json }
      recalc_customer_invoice_status: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalc_note_applied: {
        Args: { p_kind: string; p_note_id: string }
        Returns: undefined
      }
      recalc_supplier_invoice_status: {
        Args: { p_supplier_id: string }
        Returns: undefined
      }
      recompute_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      recompute_bank_balance: { Args: { p_bank_id: string }; Returns: number }
      recompute_party_balance: {
        Args: { p_party_id: string; p_party_type: string }
        Returns: number
      }
      recompute_product_stock: {
        Args: { p_product_id: string }
        Returns: number
      }
      recompute_tenant_all: { Args: { p_tenant: string }; Returns: undefined }
      refresh_trial_balance: { Args: never; Returns: undefined }
      report_payables_aging: {
        Args: { p_as_of?: string }
        Returns: {
          amount_paid: number
          bill_number: string
          bucket: string
          city: string
          contact: string
          days_overdue: number
          due_date: string
          invoice_id: string
          outstanding: number
          supplier_id: string
          supplier_name: string
          total: number
        }[]
      }
      report_profit_loss: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_receivables_aging: {
        Args: { p_as_of?: string }
        Returns: {
          amount_paid: number
          bucket: string
          city: string
          contact: string
          customer_id: string
          customer_name: string
          days_overdue: number
          due_date: string
          invoice_id: string
          invoice_number: string
          outstanding: number
          total: number
        }[]
      }
      report_sales_summary: {
        Args: {
          p_city?: string
          p_customer?: string
          p_from: string
          p_product?: string
          p_to: string
        }
        Returns: Json
      }
      rollback_import_batch: {
        Args: { p_batch_id: string; p_reason: string }
        Returns: Json
      }
      rollback_migration_batch: {
        Args: { p_migration_id: string; p_reason: string }
        Returns: Json
      }
      run_reconciliation: {
        Args: { p_auto_fix?: boolean; p_tenant: string }
        Returns: {
          computed: number
          drift: number
          entity_id: string
          entity_label: string
          scope: string
          status: string
          stored: number
        }[]
      }
      suppliers_cities: { Args: never; Returns: string[] }
      suppliers_summary: { Args: never; Returns: Json }
      table_resource: { Args: { p_table: string }; Returns: string }
      void_document: {
        Args: { p_id: string; p_reason: string; p_table: string }
        Returns: undefined
      }
      wipe_my_tenant: { Args: { confirm_text: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      tenant_role:
        | "owner"
        | "staff"
        | "accountant"
        | "sales_mgr"
        | "sales_agent"
        | "inventory"
        | "purchase_mgr"
        | "viewer"
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
      tenant_role: [
        "owner",
        "staff",
        "accountant",
        "sales_mgr",
        "sales_agent",
        "inventory",
        "purchase_mgr",
        "viewer",
      ],
    },
  },
} as const
