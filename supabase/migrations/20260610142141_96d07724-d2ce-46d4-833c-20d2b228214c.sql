
-- ============================================================
-- ERP Data Import / Migration Wizard
-- Staging tables + import_batch_id stamping + rollback RPC
-- ============================================================

-- 1. import_batches
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN (
    'products','customers','suppliers','opening_stock','batches',
    'customer_opening','supplier_opening','bank_opening',
    'chart_of_accounts','sales_invoices','purchase_invoices'
  )),
  file_name text,
  file_size integer,
  row_count integer NOT NULL DEFAULT 0,
  mapped_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  posted_count integer NOT NULL DEFAULT 0,
  column_mapping jsonb,
  options jsonb,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded','validated','failed','posting','completed','rolled_back'
  )),
  error_summary jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  rolled_back_at timestamptz,
  rollback_reason text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_import_batches" ON public.import_batches
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_insert_import_batches" ON public.import_batches
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_update_import_batches" ON public.import_batches
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_delete_import_batches" ON public.import_batches
  FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER set_tenant_id_import_batches
  BEFORE INSERT ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE INDEX idx_import_batches_tenant_created
  ON public.import_batches(tenant_id, created_at DESC);
CREATE INDEX idx_import_batches_entity_status
  ON public.import_batches(tenant_id, entity_type, status);

-- 2. import_staging_rows
CREATE TABLE public.import_staging_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw jsonb,
  normalized jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','valid','invalid','posted','skipped'
  )),
  errors jsonb,
  posted_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_staging_rows TO authenticated;
GRANT ALL ON public.import_staging_rows TO service_role;

ALTER TABLE public.import_staging_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_staging" ON public.import_staging_rows
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_insert_staging" ON public.import_staging_rows
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_update_staging" ON public.import_staging_rows
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_delete_staging" ON public.import_staging_rows
  FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER set_tenant_id_staging
  BEFORE INSERT ON public.import_staging_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE INDEX idx_staging_batch_status
  ON public.import_staging_rows(batch_id, status);

-- 3. Stamp import_batch_id on target tables (nullable, indexed)
ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.customers           ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.suppliers           ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.stock_movements     ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.grn_items           ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.payments            ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.chart_of_accounts   ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.sales_invoices      ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.sales_invoice_items ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.purchase_invoices   ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.bank_accounts       ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_products_import_batch            ON public.products(import_batch_id)            WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_import_batch           ON public.customers(import_batch_id)           WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_import_batch           ON public.suppliers(import_batch_id)           WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_import_batch     ON public.stock_movements(import_batch_id)     WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_items_import_batch           ON public.grn_items(import_batch_id)           WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_import_batch            ON public.payments(import_batch_id)            WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coa_import_batch                 ON public.chart_of_accounts(import_batch_id)   WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_import_batch      ON public.sales_invoices(import_batch_id)      WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_import_batch ON public.sales_invoice_items(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_import_batch   ON public.purchase_invoices(import_batch_id)   WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_import_batch       ON public.bank_accounts(import_batch_id)       WHERE import_batch_id IS NOT NULL;

-- 4. Rollback RPC — owner only, advisory lock, cascading deletes by import_batch_id
CREATE OR REPLACE FUNCTION public.rollback_import_batch(p_batch_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_entity text;
  v_status text;
  v_deleted jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;
  IF v_role IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can rollback an import batch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A rollback reason (min 3 chars) is required';
  END IF;

  SELECT entity_type, status INTO v_entity, v_status
    FROM public.import_batches
   WHERE id = p_batch_id AND tenant_id = v_tenant;

  IF v_entity IS NULL THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;
  IF v_status = 'rolled_back' THEN
    RAISE EXCEPTION 'Batch is already rolled back';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('import_rollback:'||v_tenant::text));

  -- Children first, parents after.
  DELETE FROM public.sales_invoice_items WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_invoice_items', v_n);

  DELETE FROM public.sales_invoices      WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_invoices', v_n);

  DELETE FROM public.purchase_invoices   WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_invoices', v_n);

  DELETE FROM public.grn_items           WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('grn_items', v_n);

  DELETE FROM public.stock_movements     WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('stock_movements', v_n);

  DELETE FROM public.payments            WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('payments', v_n);

  DELETE FROM public.products            WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('products', v_n);

  DELETE FROM public.customers           WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('customers', v_n);

  DELETE FROM public.suppliers           WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('suppliers', v_n);

  DELETE FROM public.chart_of_accounts   WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('chart_of_accounts', v_n);

  DELETE FROM public.bank_accounts       WHERE import_batch_id = p_batch_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('bank_accounts', v_n);

  UPDATE public.import_batches
     SET status = 'rolled_back',
         rolled_back_at = now(),
         rollback_reason = p_reason,
         error_summary = COALESCE(error_summary,'{}'::jsonb) || jsonb_build_object('rollback_deleted', v_deleted)
   WHERE id = p_batch_id;

  UPDATE public.import_staging_rows
     SET status = 'skipped'
   WHERE batch_id = p_batch_id AND status = 'posted';

  RETURN jsonb_build_object('batch_id', p_batch_id, 'entity_type', v_entity, 'deleted', v_deleted);
END $$;
