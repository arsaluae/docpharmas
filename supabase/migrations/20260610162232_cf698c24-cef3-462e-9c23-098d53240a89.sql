
CREATE OR REPLACE FUNCTION public.wipe_my_tenant(confirm_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant_name text;
  v_expected text;
  v_deleted jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;
  IF v_role IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner can wipe tenant data'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = v_tenant;
  v_expected := 'WIPE ' || COALESCE(v_tenant_name,'');
  IF confirm_text IS NULL OR confirm_text <> v_expected THEN
    RAISE EXCEPTION 'Confirmation text must be exactly: %', v_expected;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wipe_tenant:'||v_tenant::text));

  -- ============ Transactional / accounting (children → parents) ============
  DELETE FROM public.journal_lines              WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('journal_lines', v_n);
  DELETE FROM public.journal_entries            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('journal_entries', v_n);
  DELETE FROM public.credit_note_applications   WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('credit_note_applications', v_n);
  DELETE FROM public.debit_note_applications    WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('debit_note_applications', v_n);
  DELETE FROM public.credit_notes               WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('credit_notes', v_n);
  DELETE FROM public.debit_notes                WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('debit_notes', v_n);
  DELETE FROM public.payments                   WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('payments', v_n);
  DELETE FROM public.payment_submissions        WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('payment_submissions', v_n);
  DELETE FROM public.sales_return_items         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_return_items', v_n);
  DELETE FROM public.sales_returns              WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_returns', v_n);
  DELETE FROM public.purchase_return_items      WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_return_items', v_n);
  DELETE FROM public.purchase_returns           WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_returns', v_n);
  DELETE FROM public.sales_invoice_items        WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_invoice_items', v_n);
  DELETE FROM public.warranty_invoices          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('warranty_invoices', v_n);
  DELETE FROM public.delivery_notes             WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('delivery_notes', v_n);
  DELETE FROM public.sales_invoices             WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_invoices', v_n);
  DELETE FROM public.proforma_invoices          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('proforma_invoices', v_n);
  DELETE FROM public.purchase_invoices          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_invoices', v_n);
  DELETE FROM public.grn_items                  WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('grn_items', v_n);
  DELETE FROM public.goods_received_notes       WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('goods_received_notes', v_n);
  DELETE FROM public.purchase_order_items       WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_order_items', v_n);
  DELETE FROM public.purchase_orders            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_orders', v_n);
  DELETE FROM public.purchase_proforma_items    WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_proforma_items', v_n);
  DELETE FROM public.purchase_proformas         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_proformas', v_n);
  DELETE FROM public.additional_costs           WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('additional_costs', v_n);
  DELETE FROM public.print_rejections           WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('print_rejections', v_n);
  DELETE FROM public.print_dispatches           WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('print_dispatches', v_n);
  DELETE FROM public.print_deliveries           WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('print_deliveries', v_n);
  DELETE FROM public.purchase_print_allocations WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('purchase_print_allocations', v_n);
  DELETE FROM public.print_jobs                 WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('print_jobs', v_n);
  DELETE FROM public.agent_commissions          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('agent_commissions', v_n);
  DELETE FROM public.salary_payments            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('salary_payments', v_n);
  DELETE FROM public.expenses                   WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('expenses', v_n);
  DELETE FROM public.tax_records                WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('tax_records', v_n);
  DELETE FROM public.reconciliation_log         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('reconciliation_log', v_n);
  DELETE FROM public.stock_movements            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('stock_movements', v_n);
  DELETE FROM public.stock_audit_log            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('stock_audit_log', v_n);
  DELETE FROM public.reorder_alerts             WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('reorder_alerts', v_n);

  -- ============ Master data ============
  DELETE FROM public.customer_distributors      WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('customer_distributors', v_n);
  DELETE FROM public.customer_licenses          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('customer_licenses', v_n);
  DELETE FROM public.customer_products          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('customer_products', v_n);
  DELETE FROM public.agent_customers            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('agent_customers', v_n);
  DELETE FROM public.city_products              WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('city_products', v_n);
  DELETE FROM public.supplier_products          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('supplier_products', v_n);
  DELETE FROM public.drap_registrations         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('drap_registrations', v_n);
  DELETE FROM public.customers                  WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('customers', v_n);
  DELETE FROM public.suppliers                  WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('suppliers', v_n);
  DELETE FROM public.sales_agents               WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('sales_agents', v_n);
  DELETE FROM public.staff                      WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('staff', v_n);
  DELETE FROM public.freight_providers          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('freight_providers', v_n);
  DELETE FROM public.printers                   WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('printers', v_n);
  DELETE FROM public.products                   WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('products', v_n);
  DELETE FROM public.areas                      WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('areas', v_n);
  DELETE FROM public.expense_ledgers            WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('expense_ledgers', v_n);
  DELETE FROM public.chart_of_accounts          WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('chart_of_accounts', v_n);
  DELETE FROM public.accounting_periods         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('accounting_periods', v_n);
  DELETE FROM public.bank_accounts              WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('bank_accounts', v_n);
  DELETE FROM public.document_templates         WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('document_templates', v_n);
  DELETE FROM public.import_staging_rows        WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('import_staging_rows', v_n);
  DELETE FROM public.import_batches             WHERE tenant_id = v_tenant; GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('import_batches', v_n);

  -- Reset document counters to zero (keep rows so prefixes persist)
  UPDATE public.document_counters SET current_value = 0 WHERE tenant_id = v_tenant;

  -- Reset company_settings business fields (keep tenant ownership + the row)
  UPDATE public.company_settings
     SET company_name = NULL, owner_name = NULL, phone = NULL, email = NULL,
         address = NULL, ntn = NULL, strn = NULL, license_number = NULL,
         logo_url = NULL, signature_url = NULL
   WHERE tenant_id = v_tenant;

  -- Clear audit log last, then leave a single trace entry
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('audit_log', v_n);

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, summary, metadata)
  VALUES (v_tenant, auth.uid(), 'tenant_wiped', 'tenant',
          'Tenant data wiped by owner',
          jsonb_build_object('deleted', v_deleted, 'tenant_name', v_tenant_name));

  RETURN jsonb_build_object('tenant_id', v_tenant, 'deleted', v_deleted);
END $$;

REVOKE ALL ON FUNCTION public.wipe_my_tenant(text) FROM public;
GRANT EXECUTE ON FUNCTION public.wipe_my_tenant(text) TO authenticated;
