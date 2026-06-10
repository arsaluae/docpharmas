# Wipe Tenant Data — Plan

## Step 1 — Manual backup (safety net)
- Invoke the existing `weekly-backup` edge function with `{ manual: true }` from the Backups page (or via curl).
- Wait for the `backup_runs` row to flip to `status = 'success'` and confirm the signed download URL works.
- Abort the wipe if the backup fails.

## Step 2 — Identify scope
- Resolve `target_tenant := get_user_tenant_id(auth.uid())` for the logged-in owner.
- All deletes are scoped with `WHERE tenant_id = target_tenant`. No cross-tenant rows are touched.

## Step 3 — Wipe order (children → parents, FK-safe)
Run as one migration wrapped in a transaction so it either fully succeeds or fully rolls back.

**Transactional / accounting**
1. `journal_lines` → `journal_entries`
2. `credit_note_applications`, `debit_note_applications`
3. `credit_notes`, `debit_notes`
4. `payments`, `payment_submissions`
5. `sales_return_items` → `sales_returns`
6. `purchase_return_items` → `purchase_returns`
7. `sales_invoice_items` → `sales_invoices`
8. `warranty_invoices`
9. `delivery_notes`
10. `proforma_invoices`
11. `purchase_invoices`
12. `grn_items` → `goods_received_notes`
13. `purchase_order_items` → `purchase_orders`
14. `purchase_proforma_items` → `purchase_proformas`
15. `additional_costs`, `landed_costs` artifacts
16. `print_rejections`, `print_dispatches`, `print_deliveries`, `purchase_print_allocations`, `print_jobs`
17. `agent_commissions`, `salary_payments`, `expenses`, `tax_records`, `reconciliation_log`
18. `stock_movements`, `stock_audit_log`, `reorder_alerts`

**Master data (per user's choice — "business data + master settings")**
19. `customer_distributors`, `customer_licenses`, `customer_products`, `agent_customers`, `city_products`, `supplier_products`, `drap_registrations`
20. `customers`, `suppliers`, `sales_agents`, `staff`, `freight_providers`, `printers`
21. `products`
22. `areas`
23. `expense_ledgers`, `chart_of_accounts`, `accounting_periods`
24. `bank_accounts`
25. `document_templates`, `document_counters`
26. `import_staging_rows` → `import_batches`
27. `audit_log` (cleared so the new history starts fresh — or kept; see Question below)
28. `backup_runs` rows older than today (keep today's safety backup row)
29. Reset `company_settings` to defaults (keep the row, blank business fields, keep tenant ownership)

**Kept intentionally**
- `tenants`, `tenant_users`, `user_roles`, `pending_signups`, `role_capabilities`
- `auth.users` (your login)
- Storage bucket `tenant-backups` (so the just-taken backup remains downloadable)

## Step 4 — Reset sequences / counters
- `DELETE FROM document_counters WHERE tenant_id = target_tenant;` — next document numbers restart at 0001.

## Step 5 — Verification
- Run a single `SELECT` that counts rows in every wiped table for `target_tenant` — all must return 0 except the kept tables.
- Surface the result as a toast / console table.

## Technical details
- Implement as a `SECURITY DEFINER` RPC `public.wipe_my_tenant(confirm_text text)` that:
  - Requires `confirm_text = 'WIPE ' || tenant_name` to run.
  - Requires `has_role(auth.uid(), 'admin')`.
  - Performs all deletes above inside a single transaction.
  - Writes one `audit_log` entry (`action = 'tenant_wiped'`) **after** clearing audit_log, so a single trace row remains.
- Add a small "Danger Zone" panel on `/settings` (Owner-only) with the typed-confirmation modal that calls the RPC. This avoids me running destructive SQL directly and gives you a repeatable, auditable button.

## Open question
Do you want `audit_log` **cleared** too, or **kept** so you retain the historical trail of the old data lifecycle? Default in this plan: cleared, with a single post-wipe entry.
