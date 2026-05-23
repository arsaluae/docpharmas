
## Fresh-Start Wipe — Scope: "Everything except login & settings"

⚠️ **Irreversible.** Before I run this, please reply with the word **DELETE** to confirm. (You skipped the confirmation field — I won't proceed without it.)

### What gets wiped (your current tenant only)

**Transactions & ledgers**
- sales_invoices + sales_invoice_items
- purchase_invoices + purchase_invoice_items
- proforma_invoices + items
- purchase_proformas + items
- sales_orders, purchase_orders + items
- goods_received_notes + grn_items
- delivery_notes
- sales_returns, purchase_returns + items
- credit_notes + credit_note_applications
- debit_notes + debit_note_applications
- payments
- expenses
- salary_payments
- print_jobs, print_deliveries, print_rejections
- landed_costs, additional_costs
- stock_movements
- journal_entries + journal_lines
- agent_commissions
- warranty_invoices + items
- audit_log
- accounting_periods

**Master data**
- customers, customer_distributors, customer_licenses, customer_products
- suppliers, supplier_products
- products, product_batches, drap_registrations
- printers
- sales_agents, agent_customers
- bank_accounts
- areas, freight_providers, expense_ledgers
- chart_of_accounts (non-system rows)

**Balance reset**
- All remaining balances (none — master tables are wiped) — N/A.

### What is KEPT

- Your auth user, tenant row, and `tenant_users` membership (login works)
- `company_settings` (company name, NTN, GST/WHT toggles, WhatsApp number, logo)
- `document_templates` (your PDF layouts)
- `document_counters` rows — but **`current_value` reset to 0** so numbering restarts at 0001
- System chart_of_accounts rows (`is_system = true`) — required by triggers (e.g. Printing Rejection Expense 5300)
- `payment_submissions` (subscription history) and `pending_signups`
- Storage buckets are untouched (uploaded logos/screenshots remain). Say so if you want those cleared too.

### Technical approach

One `supabase--insert` call running a single transaction:

```sql
-- Disable period-lock & audit-immutability for this wipe
SET session_replication_role = 'replica';  -- skips triggers (incl. balance updaters, period lock, audit immutability)

-- Delete in FK-safe order, scoped to tenant
WITH t AS (SELECT '<tenant_id>'::uuid AS id)
DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = (SELECT id FROM t));
... (repeat per table above) ...

-- Reset counters
UPDATE document_counters SET current_value = 0 WHERE tenant_id = '<tenant_id>';

-- Reset system CoA balances
UPDATE chart_of_accounts SET balance = 0 WHERE tenant_id = '<tenant_id>' AND is_system = true;

SET session_replication_role = 'origin';
```

Using `session_replication_role = replica` is critical so balance triggers don't try to update already-deleted parent rows, and so `enforce_period_lock` / `prevent_audit_log_mutation` don't block the wipe.

### After you confirm

1. I'll fetch your `tenant_id` via `supabase--read_query`.
2. Run the wipe in one `supabase--insert` call.
3. Verify with row counts on the major tables.
4. Reply with a short summary and you can immediately start adding fresh customers/products.

---

**Please reply with `DELETE` (and tell me if you also want storage buckets cleared) before I execute.**
