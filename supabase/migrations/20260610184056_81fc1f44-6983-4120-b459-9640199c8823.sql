
-- ============ 1. Column additions on existing tables ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS sms_mobile text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS credit_days integer,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS old_erp_id text;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS tax_registration text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS old_erp_id text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS generic_name text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS trade_price numeric,
  ADD COLUMN IF NOT EXISTS retail_price numeric,
  ADD COLUMN IF NOT EXISTS tax_percent numeric,
  ADD COLUMN IF NOT EXISTS low_stock_level numeric,
  ADD COLUMN IF NOT EXISTS stock_account text,
  ADD COLUMN IF NOT EXISTS income_account text,
  ADD COLUMN IF NOT EXISTS expense_account text,
  ADD COLUMN IF NOT EXISTS batch_tracking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_tracking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS old_erp_id text;

ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS manufacturing_date date;

-- ============ 2. migration_batches (parent record per migration run) ============
CREATE TABLE IF NOT EXISTS public.migration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  source_file text,
  before_counts jsonb,
  after_counts jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_batches TO authenticated;
GRANT ALL ON public.migration_batches TO service_role;
ALTER TABLE public.migration_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mb_tenant_select" ON public.migration_batches;
CREATE POLICY "mb_tenant_select" ON public.migration_batches FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
DROP POLICY IF EXISTS "mb_tenant_insert" ON public.migration_batches;
CREATE POLICY "mb_tenant_insert" ON public.migration_batches FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.current_user_can('settings','write'));
DROP POLICY IF EXISTS "mb_tenant_update" ON public.migration_batches;
CREATE POLICY "mb_tenant_update" ON public.migration_batches FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP POLICY IF EXISTS "mb_tenant_delete" ON public.migration_batches;
CREATE POLICY "mb_tenant_delete" ON public.migration_batches FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.current_tenant_role() = 'owner');
DROP TRIGGER IF EXISTS set_tenant_migration_batches ON public.migration_batches;
CREATE TRIGGER set_tenant_migration_batches BEFORE INSERT ON public.migration_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- ============ 3. Per-entity staging tables (preserve every legacy field) ============
-- Helper macro inlined per table because postgres has no macros.

CREATE TABLE IF NOT EXISTS public.customer_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  created_by uuid,
  row_number integer,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  errors jsonb,
  -- canonical legacy fields
  old_erp_account_code text, business_name text, title text, first_name text, last_name text,
  contact_person text, mobile text, sms_mobile text, phone text, whatsapp text, email text,
  website text, cnic text, tax_number text, credit_limit numeric, credit_days integer,
  opening_balance numeric, address_line1 text, address_line2 text, area text, city text,
  district text, province text, country text, postal_code text, notes text, customer_status text,
  old_erp_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_staging TO authenticated;
GRANT ALL ON public.customer_staging TO service_role;
ALTER TABLE public.customer_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_tenant_all" ON public.customer_staging;
CREATE POLICY "cs_tenant_all" ON public.customer_staging FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_customer_staging ON public.customer_staging;
CREATE TRIGGER set_tenant_customer_staging BEFORE INSERT ON public.customer_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.supplier_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  created_by uuid,
  row_number integer,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  errors jsonb,
  supplier_code text, business_name text, contact_person text, mobile text, phone text,
  whatsapp text, email text, ntn text, strn text, tax_registration text, payment_terms_days integer,
  opening_balance numeric, bank_account text, bank_name text, address text, area text, city text,
  province text, country text, postal_code text, notes text, supplier_status text, old_erp_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_staging TO authenticated;
GRANT ALL ON public.supplier_staging TO service_role;
ALTER TABLE public.supplier_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ss_tenant_all" ON public.supplier_staging;
CREATE POLICY "ss_tenant_all" ON public.supplier_staging FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_supplier_staging ON public.supplier_staging;
CREATE TRIGGER set_tenant_supplier_staging BEFORE INSERT ON public.supplier_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.product_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  created_by uuid,
  row_number integer,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  errors jsonb,
  product_code text, sku text, barcode text, product_name text, generic_name text, brand text,
  manufacturer text, supplier text, category text, sub_category text, unit text,
  large_pack_size text, cost_price numeric, trade_price numeric, retail_price numeric,
  sale_price numeric, tax_percent numeric, weight text, low_stock_level numeric,
  reorder_level numeric, stock_account text, income_account text, expense_account text,
  batch_tracking boolean, expiry_tracking boolean, product_status text, notes text,
  old_erp_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_staging TO authenticated;
GRANT ALL ON public.product_staging TO service_role;
ALTER TABLE public.product_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ps_tenant_all" ON public.product_staging;
CREATE POLICY "ps_tenant_all" ON public.product_staging FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_product_staging ON public.product_staging;
CREATE TRIGGER set_tenant_product_staging BEFORE INSERT ON public.product_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.inventory_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  created_by uuid,
  row_number integer,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  errors jsonb,
  sku text, product_name text, batch_number text, expiry_date date, manufacturing_date date,
  quantity numeric, unit text, location text, batch_cost numeric, batch_supplier text,
  purchase_reference text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_staging TO authenticated;
GRANT ALL ON public.inventory_staging TO service_role;
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "is_tenant_all" ON public.inventory_staging;
CREATE POLICY "is_tenant_all" ON public.inventory_staging FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_inventory_staging ON public.inventory_staging;
CREATE TRIGGER set_tenant_inventory_staging BEFORE INSERT ON public.inventory_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.accounting_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  created_by uuid,
  row_number integer,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  errors jsonb,
  kind text,           -- 'coa' | 'customer_opening' | 'supplier_opening' | 'bank_opening' | 'cash_opening' | 'ledger_opening'
  account_code text, account_name text, account_type text,
  party_code text, party_name text,
  bank_name text, account_number text, branch text,
  amount numeric, type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_staging TO authenticated;
GRANT ALL ON public.accounting_staging TO service_role;
ALTER TABLE public.accounting_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "as_tenant_all" ON public.accounting_staging;
CREATE POLICY "as_tenant_all" ON public.accounting_staging FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_accounting_staging ON public.accounting_staging;
CREATE TRIGGER set_tenant_accounting_staging BEFORE INSERT ON public.accounting_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- ============ 4. migration_errors ============
CREATE TABLE IF NOT EXISTS public.migration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  migration_batch_id uuid REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  entity text NOT NULL,
  row_number integer,
  field text,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_errors TO authenticated;
GRANT ALL ON public.migration_errors TO service_role;
ALTER TABLE public.migration_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "me_tenant_all" ON public.migration_errors;
CREATE POLICY "me_tenant_all" ON public.migration_errors FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
DROP TRIGGER IF EXISTS set_tenant_migration_errors ON public.migration_errors;
CREATE TRIGGER set_tenant_migration_errors BEFORE INSERT ON public.migration_errors
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- ============ 5. RPCs ============
CREATE OR REPLACE FUNCTION public.migration_pre_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v jsonb := '{}'::jsonb;
  v_n bigint;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;
  SELECT count(*) INTO v_n FROM public.customers WHERE tenant_id = v_tenant; v := v || jsonb_build_object('customers', v_n);
  SELECT count(*) INTO v_n FROM public.suppliers WHERE tenant_id = v_tenant; v := v || jsonb_build_object('suppliers', v_n);
  SELECT count(*) INTO v_n FROM public.products  WHERE tenant_id = v_tenant; v := v || jsonb_build_object('products', v_n);
  SELECT count(*) INTO v_n FROM public.grn_items WHERE tenant_id = v_tenant; v := v || jsonb_build_object('grn_items', v_n);
  SELECT count(*) INTO v_n FROM public.chart_of_accounts WHERE tenant_id = v_tenant; v := v || jsonb_build_object('chart_of_accounts', v_n);
  SELECT count(*) INTO v_n FROM public.bank_accounts WHERE tenant_id = v_tenant; v := v || jsonb_build_object('bank_accounts', v_n);
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.migration_pre_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.migration_pre_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.rollback_migration_batch(p_migration_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  r record;
  v_ok int := 0; v_fail int := 0;
  v_errs jsonb := '[]'::jsonb;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;
  IF v_role IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can rollback a migration'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.migration_batches WHERE id = p_migration_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Migration batch not found';
  END IF;

  FOR r IN
    SELECT id FROM public.import_batches
     WHERE tenant_id = v_tenant
       AND (options->>'migration_batch_id') = p_migration_id::text
     ORDER BY posted_at DESC NULLS LAST, created_at DESC
  LOOP
    BEGIN
      PERFORM public.rollback_import_batch(r.id, p_reason);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errs := v_errs || jsonb_build_object('batch_id', r.id, 'error', SQLERRM);
    END;
  END LOOP;

  UPDATE public.migration_batches
     SET status = CASE WHEN v_fail = 0 THEN 'rolled_back' ELSE 'partial_rollback' END,
         finished_at = now(),
         notes = COALESCE(notes,'') || ' | rollback: ' || p_reason
   WHERE id = p_migration_id;

  RETURN jsonb_build_object('ok', v_ok, 'failed', v_fail, 'errors', v_errs);
END $$;
REVOKE ALL ON FUNCTION public.rollback_migration_batch(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rollback_migration_batch(uuid, text) TO authenticated;
