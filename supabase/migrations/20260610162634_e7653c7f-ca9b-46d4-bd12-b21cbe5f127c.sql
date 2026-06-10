
CREATE OR REPLACE FUNCTION public.preview_wipe_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_out jsonb := '{}'::jsonb;
  v_tables text[] := ARRAY[
    'journal_lines','journal_entries','credit_note_applications','debit_note_applications',
    'credit_notes','debit_notes','payments','payment_submissions',
    'sales_return_items','sales_returns','purchase_return_items','purchase_returns',
    'sales_invoice_items','warranty_invoices','delivery_notes','sales_invoices','proforma_invoices',
    'purchase_invoices','grn_items','goods_received_notes','purchase_order_items','purchase_orders',
    'purchase_proforma_items','purchase_proformas','additional_costs',
    'print_rejections','print_dispatches','print_deliveries','purchase_print_allocations','print_jobs',
    'agent_commissions','salary_payments','expenses','tax_records','reconciliation_log',
    'stock_movements','stock_audit_log','reorder_alerts',
    'customer_distributors','customer_licenses','customer_products','agent_customers',
    'city_products','supplier_products','drap_registrations',
    'customers','suppliers','sales_agents','staff','freight_providers','printers','products',
    'areas','expense_ledgers','chart_of_accounts','accounting_periods','bank_accounts',
    'document_templates','import_staging_rows','import_batches','audit_log'
  ];
  t text;
  n bigint;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;
  IF v_role IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can preview the wipe'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', t)
      INTO n USING v_tenant;
    v_out := v_out || jsonb_build_object(t, n);
  END LOOP;

  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.preview_wipe_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.preview_wipe_counts() TO authenticated;
