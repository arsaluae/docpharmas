CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role tenant_role NOT NULL,
  resource text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_write boolean NOT NULL DEFAULT false,
  can_void boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, resource)
);
GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL    ON public.role_capabilities TO service_role;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone authenticated can read role_capabilities" ON public.role_capabilities;
CREATE POLICY "anyone authenticated can read role_capabilities"
  ON public.role_capabilities FOR SELECT TO authenticated USING (true);

TRUNCATE public.role_capabilities;
INSERT INTO public.role_capabilities(role, resource, can_read, can_write, can_void, can_approve) VALUES
  ('owner','sales',true,true,true,true),('owner','purchase',true,true,true,true),
  ('owner','inventory',true,true,true,true),('owner','finance',true,true,true,true),
  ('owner','accounting',true,true,true,true),('owner','master',true,true,true,true),
  ('owner','reports',true,true,false,false),('owner','settings',true,true,false,true),
  ('owner','team',true,true,false,true),('owner','billing',true,true,false,true),
  ('accountant','sales',true,false,false,false),('accountant','purchase',true,false,false,false),
  ('accountant','inventory',true,false,false,false),('accountant','finance',true,true,true,true),
  ('accountant','accounting',true,true,true,true),('accountant','master',true,false,false,false),
  ('accountant','reports',true,false,false,false),('accountant','settings',true,false,false,false),
  ('sales_mgr','sales',true,true,true,true),('sales_mgr','inventory',true,false,false,false),
  ('sales_mgr','purchase',true,false,false,false),('sales_mgr','master',true,true,false,false),
  ('sales_mgr','finance',true,false,false,false),('sales_mgr','reports',true,false,false,false),
  ('sales_agent','sales',true,true,false,false),('sales_agent','master',true,false,false,false),
  ('sales_agent','inventory',true,false,false,false),('sales_agent','reports',true,false,false,false),
  ('staff','sales',true,true,false,false),('staff','master',true,false,false,false),
  ('staff','inventory',true,false,false,false),('staff','reports',true,false,false,false),
  ('inventory','inventory',true,true,true,false),('inventory','purchase',true,false,false,false),
  ('inventory','sales',true,false,false,false),('inventory','master',true,true,false,false),
  ('inventory','reports',true,false,false,false),
  ('purchase_mgr','purchase',true,true,true,true),('purchase_mgr','inventory',true,false,false,false),
  ('purchase_mgr','sales',true,false,false,false),('purchase_mgr','master',true,true,false,false),
  ('purchase_mgr','finance',true,false,false,false),('purchase_mgr','reports',true,false,false,false),
  ('viewer','sales',true,false,false,false),('viewer','purchase',true,false,false,false),
  ('viewer','inventory',true,false,false,false),('viewer','finance',true,false,false,false),
  ('viewer','accounting',true,false,false,false),('viewer','master',true,false,false,false),
  ('viewer','reports',true,false,false,false);

CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS tenant_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.tenant_users
   WHERE user_id = auth.uid() AND is_active = true
   ORDER BY created_at ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_can(p_resource text, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role tenant_role; v_ok boolean;
BEGIN
  v_role := public.current_tenant_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RETURN true; END IF;
  SELECT CASE p_action
    WHEN 'read' THEN can_read WHEN 'write' THEN can_write
    WHEN 'void' THEN can_void WHEN 'approve' THEN can_approve
    ELSE false END
  INTO v_ok FROM public.role_capabilities
  WHERE role = v_role AND resource = p_resource;
  RETURN COALESCE(v_ok, false);
END $$;

REVOKE EXECUTE ON FUNCTION public.current_user_can(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.current_user_can(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_tenant_role() FROM anon;
GRANT  EXECUTE ON FUNCTION public.current_tenant_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.table_resource(p_table text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_table
    WHEN 'sales_invoices' THEN 'sales' WHEN 'sales_invoice_items' THEN 'sales'
    WHEN 'sales_orders' THEN 'sales' WHEN 'sales_returns' THEN 'sales'
    WHEN 'sales_return_items' THEN 'sales' WHEN 'proforma_invoices' THEN 'sales'
    WHEN 'delivery_notes' THEN 'sales' WHEN 'warranty_invoices' THEN 'sales'
    WHEN 'agent_commissions' THEN 'sales'
    WHEN 'purchase_invoices' THEN 'purchase' WHEN 'purchase_orders' THEN 'purchase'
    WHEN 'purchase_order_items' THEN 'purchase' WHEN 'purchase_proformas' THEN 'purchase'
    WHEN 'purchase_proforma_items' THEN 'purchase' WHEN 'purchase_returns' THEN 'purchase'
    WHEN 'purchase_return_items' THEN 'purchase' WHEN 'goods_received_notes' THEN 'purchase'
    WHEN 'grn_items' THEN 'purchase' WHEN 'additional_costs' THEN 'purchase'
    WHEN 'purchase_print_allocations' THEN 'purchase' WHEN 'print_jobs' THEN 'purchase'
    WHEN 'print_deliveries' THEN 'purchase' WHEN 'print_rejections' THEN 'purchase'
    WHEN 'stock_movements' THEN 'inventory' WHEN 'stock_audit_log' THEN 'inventory'
    WHEN 'reorder_alerts' THEN 'inventory'
    WHEN 'payments' THEN 'finance' WHEN 'payment_submissions' THEN 'finance'
    WHEN 'bank_accounts' THEN 'finance' WHEN 'expenses' THEN 'finance'
    WHEN 'salary_payments' THEN 'finance' WHEN 'credit_notes' THEN 'finance'
    WHEN 'debit_notes' THEN 'finance' WHEN 'credit_note_applications' THEN 'finance'
    WHEN 'debit_note_applications' THEN 'finance'
    WHEN 'journal_entries' THEN 'accounting' WHEN 'journal_lines' THEN 'accounting'
    WHEN 'chart_of_accounts' THEN 'accounting' WHEN 'expense_ledgers' THEN 'accounting'
    WHEN 'accounting_periods' THEN 'accounting' WHEN 'tax_records' THEN 'accounting'
    WHEN 'reconciliation_log' THEN 'accounting'
    WHEN 'customers' THEN 'master' WHEN 'customer_distributors' THEN 'master'
    WHEN 'customer_licenses' THEN 'master' WHEN 'customer_products' THEN 'master'
    WHEN 'suppliers' THEN 'master' WHEN 'supplier_products' THEN 'master'
    WHEN 'printers' THEN 'master' WHEN 'staff' THEN 'master'
    WHEN 'sales_agents' THEN 'master' WHEN 'agent_customers' THEN 'master'
    WHEN 'areas' THEN 'master' WHEN 'city_products' THEN 'master'
    WHEN 'freight_providers' THEN 'master' WHEN 'products' THEN 'master'
    WHEN 'drap_registrations' THEN 'master'
    WHEN 'company_settings' THEN 'settings' WHEN 'document_templates' THEN 'settings'
    WHEN 'document_counters' THEN 'settings'
    ELSE NULL END
$$;

DO $$
DECLARE r record; v_resource text;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
      'sales_invoices','sales_invoice_items','sales_orders','sales_returns','sales_return_items',
      'proforma_invoices','delivery_notes','warranty_invoices','agent_commissions',
      'purchase_invoices','purchase_orders','purchase_order_items','purchase_proformas','purchase_proforma_items',
      'purchase_returns','purchase_return_items','goods_received_notes','grn_items','additional_costs',
      'purchase_print_allocations','print_jobs','print_deliveries','print_rejections',
      'stock_movements','stock_audit_log','reorder_alerts',
      'payments','payment_submissions','bank_accounts','expenses','salary_payments',
      'credit_notes','debit_notes','credit_note_applications','debit_note_applications',
      'journal_entries','journal_lines','chart_of_accounts','expense_ledgers','accounting_periods','tax_records','reconciliation_log',
      'customers','customer_distributors','customer_licenses','customer_products',
      'suppliers','supplier_products','printers','staff','sales_agents','agent_customers',
      'areas','city_products','freight_providers','products','drap_registrations',
      'company_settings','document_templates','document_counters'
    )
  LOOP
    v_resource := public.table_resource(r.tablename);
    IF v_resource IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS rbac_read   ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS rbac_write  ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS rbac_update ON public.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY rbac_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.current_user_can(%L, %L))',
      r.tablename, v_resource, 'read');
    EXECUTE format(
      'CREATE POLICY rbac_write ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.current_user_can(%L, %L))',
      r.tablename, v_resource, 'write');
    EXECUTE format(
      'CREATE POLICY rbac_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.current_user_can(%L, %L)) WITH CHECK (public.current_user_can(%L, %L))',
      r.tablename, v_resource, 'write', v_resource, 'write');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.void_document(p_table text, p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_resource text := public.table_resource(p_table);
  v_allowed text[] := ARRAY[
    'sales_invoices','purchase_invoices','goods_received_notes','payments',
    'sales_orders','purchase_orders','proforma_invoices','purchase_proformas',
    'delivery_notes','credit_notes','debit_notes','expenses','warranty_invoices'
  ];
  v_party_type text; v_party_id uuid; v_bank_id uuid;
BEGIN
  IF NOT (p_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Void not supported for table %', p_table;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to void a document.';
  END IF;
  IF v_resource IS NULL OR NOT public.current_user_can(v_resource, 'void') THEN
    RAISE EXCEPTION 'You do not have permission to void %', p_table
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('void:'||v_tenant::text||':'||p_table));
  UPDATE stock_movements SET status='voided', voided_at=now(), void_reason=p_reason
   WHERE reference_id = p_id AND tenant_id = v_tenant AND COALESCE(status,'active') <> 'voided';
  EXECUTE format(
    'UPDATE public.%I SET status=''voided'', void_reason=$1, voided_at=now(), voided_by=auth.uid()
       WHERE id=$2 AND tenant_id=$3 AND COALESCE(status,''active'')<>''voided''',
    p_table) USING p_reason, p_id, v_tenant;
  IF p_table = 'sales_invoices' THEN
    SELECT 'customer', customer_id INTO v_party_type, v_party_id FROM sales_invoices WHERE id=p_id;
  ELSIF p_table = 'purchase_invoices' THEN
    SELECT 'supplier', supplier_id INTO v_party_type, v_party_id FROM purchase_invoices WHERE id=p_id;
  ELSIF p_table = 'payments' THEN
    SELECT party_type, party_id, bank_account_id INTO v_party_type, v_party_id, v_bank_id FROM payments WHERE id=p_id;
  ELSIF p_table = 'credit_notes' THEN
    SELECT party_type, party_id INTO v_party_type, v_party_id FROM credit_notes WHERE id=p_id;
  ELSIF p_table = 'debit_notes' THEN
    SELECT party_type, party_id INTO v_party_type, v_party_id FROM debit_notes WHERE id=p_id;
  ELSIF p_table = 'expenses' THEN
    SELECT bank_account_id INTO v_bank_id FROM expenses WHERE id=p_id;
  END IF;
  IF v_party_type IS NOT NULL AND v_party_id IS NOT NULL THEN
    PERFORM recompute_party_balance(v_party_type, v_party_id);
    IF v_party_type='customer' THEN PERFORM recalc_customer_invoice_status(v_party_id); END IF;
    IF v_party_type='supplier' THEN PERFORM recalc_supplier_invoice_status(v_party_id); END IF;
  END IF;
  IF v_bank_id IS NOT NULL THEN PERFORM recompute_bank_balance(v_bank_id); END IF;
  PERFORM recompute_product_stock(product_id)
    FROM (SELECT DISTINCT product_id FROM stock_movements WHERE reference_id=p_id AND product_id IS NOT NULL) s;
END $fn$;