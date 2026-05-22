## Fix Plan — Critical ERP Hardening

Addresses the failures from the QA audit, in priority order.

### 1. Multi-tenant uniqueness (CRITICAL)
Drop global unique constraints and replace with `(tenant_id, field)` composites on:
- `products.sku`, `products.product_code`
- `chart_of_accounts.code`
- `customers.customer_code`
- `document_counters (tenant_id, document_type)` — primary key fix
- Document number columns: `sales_invoices.invoice_number`, `purchase_invoices.invoice_number`, `goods_received_notes.grn_number`, `purchase_proformas.po_number`, `proforma_invoices.pi_number`, `sales_returns.return_number`, `purchase_returns.return_number`, `delivery_notes.dn_number`, `payments.payment_number`, `credit_notes.credit_note_number`, `debit_notes.debit_note_number`, `expenses.expense_number`, `print_jobs.job_number`.

### 2. Inventory safety (CRITICAL)
- **DB trigger** `prevent_negative_stock` on `stock_movements` BEFORE INSERT — raises exception if resulting `products.stock_quantity` would go below zero (skipped for opening/adjustment_in).
- **Batch-level guard** in `ProformaInvoices.tsx` line item picker: compute on-hand per batch via `getActiveBatches()`; block save if any line exceeds available qty (toast with the offending product + batch).
- Same guard in `SalesReturns` reverse path and `WarrantyInvoices`.

### 3. Ledger automation (HIGH)
Add `post_journal_entry(p_ref_type, p_ref_id)` SQL function + triggers for:
- `sales_invoices` INSERT → DR AR / CR Sales + CR GST Payable
- `purchase_invoices` INSERT → DR Inventory + DR GST Input / CR AP
- `payments` INSERT → DR/CR Bank vs AR/AP based on type
- `expenses` INSERT → DR Expense / CR Bank or Cash
Resolve accounts via `chart_of_accounts.code` lookups; seed missing system accounts (1100 AR, 2100 AP, 4000 Sales, 2200 GST Payable, 1300 Inventory, 1000 Cash, 1010 Bank, 5000 COGS, 6000 Expenses) per tenant on first post.
Mirror DELETE → reversing entries.

### 4. Master-data `is_active` (HIGH)
- ALTER `customers`, `suppliers`, `products`, `printers`, `sales_agents`, `couriers` ADD `is_active boolean NOT NULL DEFAULT true`.
- Add toggle button + filter chip on each list page; default hides inactive. Dropdowns in document forms filter `is_active = true`.

### 5. FEFO enforcement (MEDIUM)
In `ProformaInvoices.tsx` batch selector: if user picks a batch with later expiry while an earlier-expiry batch has stock, show a yellow warning row with "Override reason" required note (stored in line `notes`). No hard block (user can override with reason).

### 6. Void / rollback workflow (HIGH)
New `voidDocument(table, id, reason)` helper:
- Deletes child `stock_movements` (triggers reverse stock)
- Deletes child `journal_lines` + entry (reverses ledger)
- Sets parent `status = 'voided'`, `void_reason`, `voided_at`
- Wrapped in single transaction via RPC `void_document(p_table text, p_id uuid, p_reason text)` SECURITY DEFINER.
Add "Void" action to Sales Invoices, Purchase Invoices, GRNs, Payments. Confirm dialog.

### 7. Validation polish (LOW)
Replace generic "Required fields missing" with field-level errors using react-hook-form's existing setup where present; for ad-hoc forms add inline red helper text under each missing field. Scope: Customers, Suppliers, Products, Proforma item rows.

### 8. Expiry dashboard alert (LOW)
Dashboard KPI card "Expiring ≤60 days" → click drills to `/reports/batch` pre-filtered. Source: `grn_items` joined to remaining batch on-hand.

---

### Technical notes
- All schema changes in one migration with safe `DROP CONSTRAINT IF EXISTS` + recreate.
- Backfill: before adding composite uniques, dedupe by appending `-{n}` to duplicates across tenants if any. Migration will detect & report.
- New RPC `void_document` + trigger `post_sales_invoice_journal` etc. — all `SECURITY DEFINER`, `set search_path = public`.
- Types regenerate automatically post-migration.

### Files
**Migration**: 1 large file with constraint changes + triggers + RPCs + seed accounts.
**Edit (~12)**: `ProformaInvoices.tsx`, `SalesInvoices`-equivalents, `PurchaseInvoices` flow, `Customers/Suppliers/Products/Printers/SalesAgents/Couriers.tsx` (active toggle), `Payments.tsx` (void), `Dashboard` (expiry KPI).
**New**: `src/lib/void-document.ts` helper.

### Out of scope
- Refactoring existing reports beyond consuming the new ledger (kept current calc as fallback).
- Subscription / auth changes.
