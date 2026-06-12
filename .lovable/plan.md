# Fix Product → Sales Order → Sales Invoice flow (single master, batch-accurate)

## Reality of this codebase (important)
- There is **no** `sales_orders` or `inventory_batches` table. The ERP already uses:
  - `proforma_invoices` (+ items) as the **Sales Order**.
  - `sales_invoices` (+ `sales_invoice_items`) as the **Sales Invoice**.
  - `grn_items` as the source of truth for batch / expiry / received qty. The existing view `agent_batch_availability` already computes per-batch available = received − sold (voided excluded). FEFO is sorted by `expiry_date`.
- `agent_stock_availability` already hides `cost_price` / margin and is tenant-scoped via `get_user_tenant_id()`.
- Validation trigger `validate_sales_line_batch` already enforces: batch + expiry required on every sales invoice line, expiry guard, per-batch availability guard.
- Customers RLS for agents was already fixed in the prior migration.

The plan therefore **keeps the single product master** (`products`) and the existing proforma→invoice pipeline, and fixes the gaps you listed without adding parallel data.

## 1. Database — one safe catalog view + RLS sanity

Single migration:

1. **Replace `agent_stock_availability`** with the full catalog the spec needs (no cost columns):
   - `product_id, tenant_id, sku, product_code, product_name, generic_name, category, sub_category, brand, supplier_name, unit, pack_size, mrp, sale_price, available_qty, reorder_level, low_stock_level, stock_status, batch_count, nearest_expiry`.
   - LEFT JOIN `suppliers` for `supplier_name`. Aggregate `batch_count` and `MIN(expiry_date)` from `agent_batch_availability`.
2. **Add `sales_product_catalog_view`** as a thin alias of the above (the spec asks for this exact name). Both views grant `SELECT` to `authenticated`; the underlying `sa_deny_products` RESTRICTIVE policy stays so agents can never hit `products` directly.
3. **Confirm `agent_batch_availability` exposes**: `batch_number, expiry_date, available_qty, expiry_status, selling_price, mrp` (add `mrp` if missing). Order is FEFO via `ORDER BY expiry_date NULLS LAST`.
4. **Products RLS — keep admin edits, lock agent edits**: confirm only `current_user_can('master','write')` roles can `UPDATE/INSERT/DELETE` on `products`. Agents (`sales_agent`/`staff`) have no `master.write` capability, so admin edits to name/MRP/sale price/supplier/cost flow through unchanged; agents read via the view only.
5. **Snapshot columns on `sales_invoice_items`** (and `proforma_invoice_items`): ensure `product_name`, `product_code`, `mrp`, `unit_price`, `batch_number`, `expiry_date` are stored on the line (most already exist — verify and add any missing as nullable text/numeric). Frontend will always write them at save time so editing the product master never mutates historical documents.
6. **Audit triggers** on `products` UPDATE (name, mrp, selling_price, cost_price, supplier_id) → insert into `audit_log` via `logAudit`-equivalent server trigger. Status of sales order conversion and invoice posting is already audited via existing flows; add only the missing product-field events.

No new `sales_orders`/`inventory_batches` tables — the existing pipeline already meets the spec via proformas + grn-derived batches.

## 2. Frontend — single source of data per role

**`src/pages/Products.tsx`**
- Admin/manager (anyone with `master.write`): unchanged — reads `products`, edit dialog already exists. Verify the edit form exposes name, generic_name, category, supplier, unit, MRP, sale price, cost price (admin only), low_stock_level, reorder_level, status.
- Sales agent: source from `sales_product_catalog_view`; hide cost/margin columns; remove the "+ New Product" / edit / delete actions; add a read-only batch drawer that queries `agent_batch_availability` for the selected product (batch, expiry, available qty, MRP, sale price).

**`src/pages/ProformaInvoices.tsx` (Sales Order)**
- Product picker: agent → `sales_product_catalog_view`; admin → `products`. Search by SKU, name, generic_name, supplier, category, batch (batch search hits `agent_batch_availability`).
- After product select: show MRP, sale price, available stock, nearest expiry, supplier.
- Batch selector populated from `agent_batch_availability` (FEFO default; block expired unless `company_settings.allow_expired_sale`).
- Persist line snapshots: `product_id, product_code, product_name, mrp, unit_price, batch_number, expiry_date`.
- Customer strip (mobile, city, address, outstanding, credit limit) — already wired now that customers RLS is fixed.
- No stock deduction. Reservation toggle is out of scope unless `company_settings.reserve_on_order` exists (it does not today — skip).

**Convert to Sales Invoice**
- The existing "Convert to Invoice" action on a proforma already copies lines into `sales_invoices`. Harden it:
  - Re-query `agent_batch_availability` per line; if `available_qty < requested`, surface inline warning "Stock changed since order creation. Please review batch availability." and require user to re-pick batch before posting.
  - Carry `linked_proforma_id` (already exists) and `agent_id` (already stamped by trigger).
  - On successful insert, set proforma `status = 'converted'`.
- Posting the invoice runs through the existing `handle_sales_invoice_balance` (customer ledger) + `validate_sales_line_batch` (stock + expiry) + `handle_stock_movement` triggers. No new server logic needed.

**`src/pages/SalesInvoicesList.tsx`, `SalesReturns.tsx`, `DeliveryNotes.tsx`, `WarrantyInvoices.tsx`, `CustomerProfileDialog.tsx`, `QuickCreateProductDialog.tsx` (agent-reachable only)**
- Where they `from('products')` for a picker and the user is an agent → switch to `sales_product_catalog_view`. Admin path unchanged.

**Two close (X) buttons in dialogs**
- Audit the dialog wrappers (`PdfPreviewDialog`, ProformaInvoices create dialog, etc.) and remove the manually-added close button where the shadcn `DialogContent` already renders one. Keep only the built-in `<DialogClose>`.

## 3. Validation & permission gates (client mirror; DB re-enforces)
- Disable "Save Invoice" until: customer, every line has product + batch + expiry + qty > 0 + qty ≤ available, sale price > 0.
- Sales Order draft: allow missing batch only if `company_settings.require_batch_on_order = false` (new setting, default true). Invoice always requires batch.
- Sale price field is read-only for agents (server already blocks edits via no `master.write`, but UI mirrors).

## 4. Testing checklist (manual in preview after migration)
1. Admin edits product name + MRP → agent product list reflects it on refresh.
2. Admin adds GRN with batch + expiry → batch shows in agent picker with correct available qty.
3. Agent creates proforma with that batch → stock unchanged, no ledger movement.
4. Agent converts to invoice → stock deducted from that batch, ledger updated, invoice visible to admin, proforma marked converted.
5. Editing the product master after the invoice is posted does not mutate the historical line (snapshot intact).
6. Agent direct `SELECT` on `products` / `purchase_invoices` / `expenses` returns 0 rows.
7. Voiding the invoice restores batch qty and reverses ledger (existing triggers).

## Technical notes
- ~85% of the work is one DB migration (view rebuild + alias + snapshot columns + audit triggers) plus targeted swaps from `products` → `sales_product_catalog_view` in agent-reachable pickers. No new tables, no parallel master, no schema rename of the proforma/invoice tables.
- The "inventory_batches" concept in the spec is satisfied by the existing `grn_items` + `agent_batch_availability` view; introducing a new table would duplicate stock data and break the established `validate_sales_line_batch` and stock-movement triggers.
