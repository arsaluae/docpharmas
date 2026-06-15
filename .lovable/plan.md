# Inventory + Purchase Workflow Overhaul

Three connected upgrades: a real Opening Stock workspace, a Product page that stops hiding data, and a Purchase Invoice / Payment edit-and-lock cycle that keeps stock, supplier ledger, and reports in sync.

---

## Part 1 — Opening Stock (full-page workspace)

**Route:** `Inventory → Opening Stock` (`/opening-stock`), new page `src/pages/OpeningStock.tsx`. The embedded panel inside the product dialog is removed (opening stock is no longer a per-product action — it's a document).

**Layout**
- Full page, sticky header (date, location, ref no, notes, created by) and sticky footer (totals + Save / Save & New / Cancel).
- Wide batch grid (horizontal scroll on small screens), large rows, tabular numerics.

**Batch grid columns**
SKU · Product · Supplier · Batch No · Mfg · Expiry · Qty · Cost · MRP · Sale · Location · Row actions (duplicate / delete).

**Features**
- Product searchable select auto-fills Supplier, Cost, MRP, Sale from `products` + last `supplier_products` price.
- Add row, duplicate row, delete row, "Add 5 rows" helper.
- Paste from Excel: tab/newline-delimited paste anywhere in the grid fills cells across rows.
- Import wizard: upload `.xlsx` → map columns → preview → commit. Reuses existing import infrastructure (`src/lib/import/*`).
- Live totals: total qty, total cost value, distinct products, distinct batches.
- Duplicate detector (same product + batch + expiry + location): modal with **Merge qty / Keep separate / Cancel**.

**Validation**
SKU + product required, batch required, expiry required and ≥ today − 1y, qty > 0, cost ≥ 0. Errors highlight the offending cell.

**Persistence rules (unchanged contract)**
- Inserts into `stock_movements` (`movement_type = 'opening'`, `reference_type = 'opening_stock'`, `reference_id = opening_stock_batch.id`).
- New table `opening_stock_batches` (one row per batch line) for editability and reporting; rows belong to an `opening_stock_documents` header (date, location, ref_no, notes, status `draft|posted|locked`).
- **No** supplier ledger entry, **no** purchase invoice, **no** payable.
- Editable while `status = draft|posted` and not locked; after lock → adjustment only.

**Cleanup**
- Remove `src/components/OpeningStockDialog.tsx`.
- Remove the inline `OpeningStockPanel` from `Products.tsx` (panel file kept only if reused; otherwise deleted).
- Replace the product-form "Opening Stock" field with a read-only summary + "Open in Opening Stock workspace" link.

---

## Part 2 — Product page & detail drawer

**List page (`src/pages/Products.tsx`)**
- Wide ERP table with horizontal scroll. Columns:
  SKU · Name · Supplier · Category · Unit · Purchase Cost · Landed Cost · Sale · MRP · Margin % · Total Stock · Active Batches · Nearest Expiry · Reorder Level · Status · Actions.
- Remove the duplicate Code column — SKU only.
- Column visibility menu (persisted in localStorage) so users can hide what they don't need.
- Margin % = `(sale − landed_cost) / sale`, color-coded (red < 10, amber < 20, green ≥ 20).
- Nearest expiry pulled from active batches (FEFO).

**Detail drawer / dialog**
Replace icons-only with tabs:
1. **Overview** — identity, supplier, category, costs, prices, margin, totals.
2. **Batches** — batch no, mfg, expiry, qty, location, cost, landed cost, status (active / expiring / expired).
3. **Stock Movement** — paginated movements with type, ref no, qty, balance.
4. **Purchase History** — invoices with date, supplier, qty, rate, total.
5. **Sales History** — invoices with date, customer, qty, rate.
6. **Pricing** — current cost/MRP/sale + price-history timeline (existing `features/price-history-tracking`).

---

## Part 3-8 — Purchase Invoice edit window, payment correction, sync, lock, audit

**Settings**
`Settings → Purchase → Invoice Edit Window`: 7 / 15 / 30 / 60 / Custom (default 30). Stored on `company_settings.purchase_edit_window_days`.

**Statuses on `purchase_invoices`**
`draft` · `submitted` · `locked` · `cancelled` · `returned`. A submitted invoice is "Editable Submitted" while `now() − submitted_at < edit_window`; otherwise auto-lock.

**Lock checker**
- Trigger on read: server function `check_purchase_invoice_lock(invoice_id)` flips status to `locked` if window expired.
- Nightly `pg_cron` job runs the same check across all submitted invoices.

**Edit submitted invoice**
- Button "Edit Submitted Invoice" visible only when status is submitted and within window.
- Two-step UI: reason prompt → editable form → **Impact Preview** panel (stock Δ per batch, payable Δ, payment Δ) → Confirm.
- Server RPC `edit_purchase_invoice(invoice_id, patch, reason)` runs atomically:
  - Diffs lines (qty, rate, batch, expiry, tax, discount, supplier).
  - Adjusts `stock_movements` (insert reversal + new movement, never mutate history).
  - Adjusts `inventory batch` totals via the existing batch triggers.
  - Recomputes invoice totals and supplier payable.
  - Updates landed cost only when "auto-update purchase cost" setting is on.
  - **Guard:** if `qty_sold_from_batch > new_received_qty`, abort with "Cannot reduce received qty below qty already sold from this batch. Use Purchase Return or Adjustment."
  - Supplier change requires `admin` capability; moves payable between suppliers via reversal + new ledger entries.
- Every change writes to `audit_log` (entity = `purchase_invoice`) with `field, old, new, reason, stock_impact, ledger_impact`.

**Locked invoices**
- Lock badge + banner: "Locked. Use Purchase Return or Adjustment."
- Edit disabled. Buttons enabled: Create Purchase Return, Create Adjustment Request.

**Payment correction (`payments`)**
- Within window AND not reconciled: edit/delete allowed with reason; supplier ledger + bank balance adjust; audit entry written.
- Reconciled or out-of-window: edit/delete disabled; "Reverse Payment" creates a negative payment (`is_reversal = true`, links to original), then user creates a corrected payment. Supplier ledger shows original → reversal → corrected; no silent deletes.

**Cross-module sync (already partly handled by existing triggers — we extend, not replace)**
- Purchase submitted → ledger payable +, stock +, batches +, reports refresh.
- Purchase edited → diff-based reversal + replay across ledger, stock, reports.
- Purchase return → ledger −, stock −, links to original invoice.
- Payment out → ledger −, bank −.
- Payment edited / reversed → ledger + bank reconciled, audit entry.

---

## Part 9 — Audit log fields

Reuse existing `audit_log` table with the standard `logAudit()` helper. Extra fields packed into `changes` JSON: `{ field, old, new, reason, stock_impact, ledger_impact }`. Sensitive fields (qty, cost, supplier, payment, tax, batch, expiry) require `reason` — UI blocks save without it.

---

## Part 10 — QA pass

Manual scripted run through the QA scenarios in the request (opening stock 3 batches, product page columns, purchase qty 100 → 80 edit with stock & ledger check, payment correction, post-lock return). Plus a `vitest` unit test for `edit_purchase_invoice` diff math and the "sold-below-received" guard.

---

## Technical notes

**New tables**
```text
opening_stock_documents(id, tenant_id, doc_date, location, ref_no, notes,
  created_by, status, locked_at, totals_qty, totals_value, created_at, updated_at)
opening_stock_batches(id, document_id, tenant_id, product_id, supplier_id,
  batch_number, mfg_date, expiry_date, quantity, purchase_cost, mrp,
  sale_price, location, stock_movement_id)
```
Both get tenant-scoped RLS via `get_user_tenant_id()` + GRANTs (authenticated R/W, service_role all).

**company_settings additions**
`purchase_edit_window_days int default 30`, `purchase_edit_auto_update_cost bool default false`.

**purchase_invoices additions**
`submitted_at timestamptz`, `locked_at timestamptz`, `edit_count int default 0`, status enum widened.

**payments additions**
`is_reversal bool`, `reverses_payment_id uuid`, `reconciled bool`.

**RPCs**
`edit_purchase_invoice(invoice_id uuid, patch jsonb, reason text)`,
`reverse_payment(payment_id uuid, reason text)`,
`check_purchase_invoice_lock(invoice_id uuid)`.

**Files touched**
- New: `src/pages/OpeningStock.tsx`, `src/components/opening-stock/BatchGrid.tsx`, `src/components/opening-stock/ImportDialog.tsx`, `src/components/purchase/EditSubmittedInvoiceDialog.tsx`, `src/components/purchase/ImpactPreview.tsx`, `src/components/purchase/LockBanner.tsx`, `src/components/products/ProductDetailDrawer.tsx`.
- Edited: `src/pages/Products.tsx` (wide table + drawer), `src/pages/PurchaseInvoices.tsx` (or equivalent — confirmed during build), `src/pages/Settings.tsx` (edit-window setting), `src/components/AppSidebar.tsx` (Opening Stock link).
- Removed: `src/components/OpeningStockDialog.tsx`, embedded opening-stock UI in `Products.tsx`.
- Migrations: new tables, column additions, RPCs, lock cron.

---

## Open questions before I build

1. **Scope** — implement all 3 parts in one pass, or ship Opening Stock first, then Product page, then Purchase edit? (Big single PR vs three smaller ones.)
2. **Edit-window default** — confirm 30 days, and confirm Custom days is admin-only.
3. **Supplier change on edit** — should this be allowed at all, or always force a void + recreate?
4. **Cost auto-update** — when a purchase edit changes cost, should `products.purchase_cost` update automatically, or only via the existing landed-cost flow?
