
-- Fresh-start wipe for tenant c7548f94-57c2-4004-b3bf-972e1e7d1bd6
-- Disables all triggers so balance updates and audit immutability don't fire/block
SET session_replication_role = 'replica';

DO $$
DECLARE t uuid := 'c7548f94-57c2-4004-b3bf-972e1e7d1bd6';
BEGIN
  -- Child / dependent rows first
  DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = t);
  DELETE FROM sales_return_items WHERE return_id IN (SELECT id FROM sales_returns WHERE tenant_id = t);
  DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE tenant_id = t);
  DELETE FROM purchase_order_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE tenant_id = t);
  DELETE FROM purchase_proforma_items WHERE proforma_id IN (SELECT id FROM purchase_proformas WHERE tenant_id = t);
  DELETE FROM grn_items WHERE tenant_id = t;
  DELETE FROM journal_lines WHERE tenant_id = t;
  DELETE FROM credit_note_applications WHERE tenant_id = t;
  DELETE FROM debit_note_applications WHERE tenant_id = t;
  DELETE FROM print_deliveries WHERE print_job_id IN (SELECT id FROM print_jobs WHERE tenant_id = t);
  DELETE FROM print_rejections WHERE print_job_id IN (SELECT id FROM print_jobs WHERE tenant_id = t);

  -- Transactions
  DELETE FROM stock_movements WHERE tenant_id = t;
  DELETE FROM stock_audit_log WHERE tenant_id = t;
  DELETE FROM sales_invoices WHERE tenant_id = t;
  DELETE FROM sales_returns WHERE tenant_id = t;
  DELETE FROM purchase_invoices WHERE tenant_id = t;
  DELETE FROM purchase_returns WHERE tenant_id = t;
  DELETE FROM proforma_invoices WHERE tenant_id = t;
  DELETE FROM purchase_proformas WHERE tenant_id = t;
  DELETE FROM purchase_orders WHERE tenant_id = t;
  DELETE FROM goods_received_notes WHERE tenant_id = t;
  DELETE FROM delivery_notes WHERE tenant_id = t;
  DELETE FROM warranty_invoices WHERE tenant_id = t;
  DELETE FROM credit_notes WHERE tenant_id = t;
  DELETE FROM debit_notes WHERE tenant_id = t;
  DELETE FROM payments WHERE tenant_id = t;
  DELETE FROM expenses WHERE tenant_id = t;
  DELETE FROM salary_payments WHERE tenant_id = t;
  DELETE FROM additional_costs WHERE tenant_id = t;
  DELETE FROM print_jobs WHERE tenant_id = t;
  DELETE FROM agent_commissions WHERE tenant_id = t;
  DELETE FROM journal_entries WHERE tenant_id = t;
  DELETE FROM tax_records WHERE tenant_id = t;
  DELETE FROM reorder_alerts WHERE tenant_id = t;
  DELETE FROM accounting_periods WHERE tenant_id = t;
  DELETE FROM audit_log WHERE tenant_id = t;

  -- Master data linking tables
  DELETE FROM agent_customers WHERE tenant_id = t;
  DELETE FROM customer_products WHERE tenant_id = t;
  DELETE FROM supplier_products WHERE tenant_id = t;
  DELETE FROM customer_distributors WHERE tenant_id = t;
  DELETE FROM customer_licenses WHERE tenant_id = t;
  DELETE FROM drap_registrations WHERE tenant_id = t;

  -- Master data
  DELETE FROM customers WHERE tenant_id = t;
  DELETE FROM suppliers WHERE tenant_id = t;
  DELETE FROM products WHERE tenant_id = t;
  DELETE FROM printers WHERE tenant_id = t;
  DELETE FROM sales_agents WHERE tenant_id = t;
  DELETE FROM staff WHERE tenant_id = t;
  DELETE FROM bank_accounts WHERE tenant_id = t;
  DELETE FROM areas WHERE tenant_id = t;
  DELETE FROM freight_providers WHERE tenant_id = t;
  DELETE FROM expense_ledgers WHERE tenant_id = t;

  -- CoA: keep system accounts, wipe user-created, reset balances
  DELETE FROM chart_of_accounts WHERE tenant_id = t AND is_system = false;
  UPDATE chart_of_accounts SET balance = 0 WHERE tenant_id = t;

  -- Reset document numbering to start at 0001
  UPDATE document_counters SET current_value = 0 WHERE tenant_id = t;
END $$;

SET session_replication_role = 'origin';
