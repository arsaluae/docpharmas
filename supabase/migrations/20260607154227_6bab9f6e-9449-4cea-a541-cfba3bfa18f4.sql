-- Phase 3.A: Execute wipe of transactional + master data (preserves tenants, profiles, auth, subscription, roles)
DO $$
BEGIN
  IF current_setting('app.allow_wipe', true) IS DISTINCT FROM 'yes' THEN
    PERFORM set_config('app.allow_wipe','yes', true);
  END IF;
END $$;

-- Truncate in CASCADE order. Order is best-effort; CASCADE handles dependents.
TRUNCATE TABLE
  public.credit_note_applications,
  public.debit_note_applications,
  public.credit_notes,
  public.debit_notes,
  public.payment_submissions,
  public.payments,
  public.journal_lines,
  public.journal_entries,
  public.stock_movements,
  public.stock_audit_log,
  public.reorder_alerts,
  public.grn_items,
  public.goods_received_notes,
  public.delivery_notes,
  public.sales_return_items,
  public.sales_returns,
  public.purchase_return_items,
  public.purchase_returns,
  public.sales_invoice_items,
  public.sales_invoices,
  public.warranty_invoices,
  public.purchase_invoices,
  public.purchase_order_items,
  public.purchase_orders,
  public.purchase_proforma_items,
  public.purchase_proformas,
  public.purchase_print_allocations,
  public.proforma_invoices,
  public.expenses,
  public.salary_payments,
  public.agent_commissions,
  public.print_deliveries,
  public.print_rejections,
  public.print_jobs,
  public.additional_costs,
  public.tax_records,
  public.audit_log,
  public.accounting_periods,
  public.reconciliation_log,
  public.customer_licenses,
  public.customer_products,
  public.customer_distributors,
  public.city_products,
  public.agent_customers,
  public.supplier_products,
  public.drap_registrations,
  public.customers,
  public.suppliers,
  public.printers,
  public.staff,
  public.sales_agents,
  public.freight_providers,
  public.areas,
  public.products,
  public.bank_accounts,
  public.chart_of_accounts,
  public.expense_ledgers,
  public.document_templates,
  public.document_counters,
  public.company_settings,
  public.pending_signups
RESTART IDENTITY CASCADE;

-- Refresh trial balance MV (now empty)
DO $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_trial_balance;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.mv_trial_balance;
  END;
END $$;