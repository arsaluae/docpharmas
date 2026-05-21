# Sales/Purchase Engine Rebuild + Branding + 4 Functional Blocks

This rebuilds the order→invoice flow on top of what's already there. No schema changes are required — every feature maps to existing tables (`proforma_invoices`, `sales_invoices`, `sales_invoice_items`, `stock_movements`, `additional_costs`, `customers.city`).

## What already exists (kept)

- `ProformaInvoices.tsx` → soft Sales Order, already converts to `sales_invoices` via "Submit". Today it picks batches inside the order form.
- `stock_movements` carries `batch_number` + `expiry_date` per movement → this is our batch ledger.
- `additional_costs` already records Printing / Freight / Packaging per product/PO.
- `WarrantyInvoices.tsx` already pulls batch + uses MRP-based pricing.
- `customers.city` populated for territory checks.

## 0. Branding cleanup

- Remove `<img>` logo from `AppSidebar.tsx`, `Auth.tsx`. Keep wordmark "Mouj Pharmaceuticals" only.
- `index.html` favicon → simple inline SVG monogram "M" (no image asset).
- Delete unused import `docpharmasLogo` references.

## 1. Purchase & Landed Cost Engine (Admin-only)

**Product Profile dialog** (new component `ProductBatchProfileDialog.tsx`, opened from Products list):
- Header: product name, code, true cost.
- **Active Batches table** — derived live from `stock_movements`:
  - Group by `batch_number`; sum signed quantities; show Mfg/Expiry from first inbound row.
  - Columns: Batch No · Mfg Date · Expiry · On-hand Qty · Status badge (Active / Expiring <90d / Expired).
- **Landed Cost calculator** (inline):
  - Inputs: Supplier Base, Printing, Inward Freight (controlled state).
  - `true_cost = base + printing + freight` recomputed on every keystroke (no debounce, plain `useMemo`).
  - "Save" writes the cost components as `additional_costs` rows tagged `reference_type='product'`, `reference_id=product.id`, and updates `products.cost_price` to `true_cost`.
- Admin-only gate via `useUserRole` — Staff sees disabled button with tooltip.

## 2. Quotation → Invoice Batch-Lock Modal

**Phase 1 — Sales Order (Proforma) form**:
- Strip the per-row batch picker that's there today. Order form only needs: Product, Qty, Rate.
- On add/qty change, validate against `products.stock_quantity` total only ("Insufficient stock" toast if short). No batch reservation.
- Save status `draft` / `sent`.

**Phase 2 — Convert to Invoice**:
- Replace current silent `handleSubmit` with a mandatory `<BatchAllocationDialog>`:
  - For each line item, fetch available batches (group `stock_movements` by `batch_number`, oldest-expiry first, FEFO).
  - Render one row per item: Product · Qty needed · `<Select>` of batches showing `BATCH-001 (Exp 2026-03 · 240 avail)`.
  - "Confirm & Invoice" button is **disabled until every line has a batch selected** with sufficient qty.
  - On confirm: insert `sales_invoices` + `sales_invoice_items` (carrying `batch_number` + `expiry_date`) + `stock_movements` with `movement_type='sale'` against the chosen batch. The existing DB triggers handle stock decrement & invoice status.
- Modal traps focus, blocks ESC/backdrop dismiss until either Confirm or explicit Cancel.

**Purchase mirror**: Purchase Proforma stays batch-less; on "Receive" (GRN), prompt user for batch number + mfg/expiry per line (this already exists; just tighten validation so the field is required).

## 3. Territory Exclusivity Engine

No new table — pure read query at order-time.

- New helper `src/lib/territory.ts` → `checkTerritoryLock(productId, customerId)`:
  ```ts
  // Pseudocode
  const city = customers.find(c=>c.id===customerId).city;
  const conflicts = await supabase.rpc('check_territory') OR a direct query:
    sales_invoice_items JOIN sales_invoices JOIN customers
    WHERE product_id = $1 AND customers.city = $2
      AND customers.id <> $1 AND status <> 'cancelled'
    LIMIT 1;
  ```
- Wired into the **Proforma product picker** and **Convert-to-Invoice modal**:
  - On product select, run check. If conflict, hard-block: disable the row, replace input with destructive alert "This product is exclusively allocated to another distributor in this territory." (red banner, blocks form submit).
- Allocated-products view (existing) gets a "Locked Cities" badge listing cities where each product is committed.

## 4. Non-Ledger Warranty Document

Rework `WarrantyInvoices.tsx`:

- **Top banner** (sticky): cyan #00AEEF background, white text, label "NON-FINANCIAL COMPLIANCE DOCUMENT" + small subtext "No accounting/inventory impact".
- **Flow**:
  1. Step 1: Select Parent Distributor (customer).
  2. Step 2: Reveals Retailer sub-form: Name, Address, Phone, Drug License #, License Expiry (stored in `customer_distributors` if user wants to save, or one-off).
  3. Step 3: Add items. On product select, auto-pull active batch (latest with stock) and rate = `products.mrp`. Net Wholesale Rate ignored.
- **Generate**: opens existing `PdfPreviewDialog` with the layout. **No** DB writes to `sales_invoices`, no `stock_movements`, no ledger entries. Optional: persist a row to `delivery_notes` with `reference_type='warranty_compliance'` only if user clicks "Save copy" (off by default).

## UI / Design tokens

- Global radius override in `tailwind.config.ts` + `index.css`: `--radius: 4px` (currently larger). Cards, inputs, dialogs all sharpen.
- Tables: add `tabular-nums` to every numeric column header (utility already added last turn).
- Color additions to `index.css`:
  - `--medical-cyan: 196 100% 47%;` (#00AEEF)
  - `--territory-lock: 0 72% 51%;` (reuse destructive)
- Sales/Purchase list pages: tighten row height to 36px, switch headers to uppercase 11px tracking-wide.

## Files

**New**: `src/components/ProductBatchProfileDialog.tsx`, `src/components/BatchAllocationDialog.tsx`, `src/lib/territory.ts`, `src/lib/batches.ts` (shared "get active batches for product" util).

**Edited**: `AppSidebar.tsx`, `Auth.tsx`, `index.html`, `Products.tsx`, `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `WarrantyInvoices.tsx`, `LandedCosts.tsx`, `index.css`, `tailwind.config.ts`.

**No DB migrations**.

## Out of scope

- No rewrite of payments / printing / reports.
- No changes to RLS, triggers, or schema.
- Last-turn perf work (lazy routes, toast fix, queryClient cache clear) stays in place.

## Execution order

1. Branding strip (5 lines).
2. Token / radius sweep.
3. `src/lib/batches.ts` + `src/lib/territory.ts` utilities.
4. `BatchAllocationDialog` + rewire Proforma "Convert to Invoice".
5. Strip batch fields from Proforma order form; add territory check on product select.
6. `ProductBatchProfileDialog` + Landed Cost true-cost calc, wire into Products page.
7. Warranty cyan banner + retailer sub-form + MRP autofetch; remove any DB side-effects.
8. Verify in preview: create order → convert → modal forces batch → invoice saves; warranty generate writes nothing; territory conflict blocks second order.
