
-- 1. Create tenant_role enum
CREATE TYPE public.tenant_role AS ENUM ('owner', 'staff');

-- 2. Tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  owner_email text,
  phone text,
  plan text DEFAULT 'monthly',
  setup_paid boolean DEFAULT false,
  is_active boolean DEFAULT true,
  max_users integer DEFAULT 2,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_tenants" ON public.tenants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_tenants" ON public.tenants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_tenants" ON public.tenants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_tenants" ON public.tenants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Tenant users mapping
CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role tenant_role NOT NULL DEFAULT 'owner',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_tenant" ON public.tenant_users FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_tu" ON public.tenant_users FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_tu" ON public.tenant_users FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_tu" ON public.tenant_users FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role::text FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1 $$;

-- Auto-set tenant_id trigger function
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN IF NEW.tenant_id IS NULL THEN NEW.tenant_id := public.get_user_tenant_id(); END IF; RETURN NEW; END; $$;

-- 5. Add tenant_id and triggers to all business tables
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customers','suppliers','products','printers',
    'proforma_invoices','sales_invoices','sales_invoice_items',
    'purchase_proformas','purchase_proforma_items','purchase_orders','purchase_order_items',
    'purchase_invoices','purchase_returns','purchase_return_items',
    'sales_returns','sales_return_items',
    'warranty_invoices','delivery_notes',
    'payments','expenses','bank_accounts',
    'stock_movements','print_jobs',
    'customer_licenses','drap_registrations',
    'additional_costs','tax_records',
    'goods_received_notes','grn_items',
    'journal_entries','journal_lines',
    'chart_of_accounts','company_settings','document_templates','document_counters'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', tbl);
    EXECUTE format('CREATE TRIGGER set_tenant_%s BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()', tbl, tbl);
  END LOOP;
END $$;

-- 6. Drop old RLS policies and create tenant-scoped ones
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customers','suppliers','products','printers',
    'proforma_invoices','sales_invoices','sales_invoice_items',
    'purchase_proformas','purchase_proforma_items','purchase_orders','purchase_order_items',
    'purchase_invoices','purchase_returns','purchase_return_items',
    'sales_returns','sales_return_items',
    'warranty_invoices','delivery_notes',
    'payments','expenses','bank_accounts',
    'stock_movements','print_jobs',
    'customer_licenses','drap_registrations',
    'additional_costs','tax_records',
    'goods_received_notes','grn_items',
    'journal_entries','journal_lines',
    'chart_of_accounts','company_settings','document_templates','document_counters'
  ])
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY "tenant_select_%s" ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), ''admin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), ''admin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_update_%s" ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), ''admin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "tenant_delete_%s" ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), ''admin''))', tbl, tbl);
  END LOOP;
END $$;

-- 7. Admin manage user_roles
CREATE POLICY "Admin insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Drop orphaned function
DROP FUNCTION IF EXISTS public.handle_sales_item_stock() CASCADE;
