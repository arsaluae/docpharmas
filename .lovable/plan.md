
# Products & Stock — Costing, SKU, Opening Stock & Batch Drawer Fix

This rebuilds the costing model so **purchase cost** and **landed cost** are first-class separate fields, fixes margin math, replaces the duplicate Code/SKU column, and ships a real Opening Stock flow with multi-batch support. Scope is limited to the Products module, Purchase Order display, the landed-cost drawer, batch drawer, and the three reports that consume cost.

## 1. Data model changes (migration)

### `products` table
- Add `purchase_cost numeric default 0` (new source of truth for supplier base cost).
- Keep `selling_price` (= Net Price) and `mrp` as today (per existing memory `product-pricing-mrp-vs-net`).
- Keep `cost_price` as a **derived landed cost cache** (updated only by the landed-cost engine, never by edit form). Backfill `purchase_cost = cost_price` for existing rows.
- `product_code` → hidden in UI everywhere; SKU becomes the only identifier. Backfill `sku = coalesce(nullif(sku,''), product_code)` for rows missing SKU. Column stays in DB for legacy joins.
- Add unique partial index `(tenant_id, lower(sku)) where sku is not null and is_active` to block duplicate SKUs per tenant.

### New `product_landed_costs` table
Columns: `id, tenant_id, product_id, purchase_cost, printing_cost, freight_cost, customs_cost, handling_cost, other_cost, other_cost_label, landed_cost (generated as sum), effective_from date, source ('manual'|'purchase_invoice'), source_ref uuid, created_by, created_at`.
- RLS: tenant-scoped, `sa_deny_*` for sales agents (same pattern as `additional_costs`).
- Trigger `after insert` → update `products.cost_price = NEW.landed_cost` so the products row always carries the latest landed cost for fast list queries.

### Stock movements
- Add `'opening_stock'` to the allowed `movement_type` values (alongside existing `opening`). Existing `opening` rows keep working; new flow writes `opening_stock`.
- No ledger impact (movement-only).

### Settings (`company_settings`)
Add columns: `sku_prefix text default 'PRD'`, `sku_next_number int default 1`, `sku_auto_generate boolean default true`, `sku_manual_override_admin_only boolean default true`.

### RPC `generate_sku(tenant uuid)`
Returns `<prefix>-<padded 4-digit next>` and atomically bumps `sku_next_number`. Replaces ad-hoc `generate_document_number('product')` for SKU.

## 2. Products page UI

### Table columns (replaces today's mixed Code+SKU)
`SKU · Product Name · Category · Supplier · Purchase Cost · Landed Cost · Sale Price · MRP · Margin % · Stock · Actions`

Margin formula (client-side):
```
landed = product.cost_price > 0 ? product.cost_price : product.purchase_cost
margin = sale > 0 ? ((sale - landed) / sale) * 100 : null   // render "—" if null
```
If `cost_price === purchase_cost` (no landed costs recorded), show a small "Landed cost missing" warning chip next to the margin.

Sales agents continue using `sales_product_catalog_view` — no cost/margin columns rendered for them.

### Create/Edit Product dialog
- Remove the "Code" input.
- SKU input is **read-only + auto-filled** from `generate_sku` RPC on open. Admin sees a "Manual override" toggle when `sku_manual_override_admin_only=true` and they are admin.
- Cost section split into:
  - **Purchase Cost** (writes `purchase_cost`) — only field editable here.
  - **Landed Cost** — read-only display of `cost_price`, with "Manage landed cost →" link that opens the drawer.
- `QuickCreateProductDialog` updated to the same SKU + purchase-cost model.

### "Add Opening Stock" button (top of page, next to "Add Product")
Opens a new `OpeningStockDialog`:
- Product selector (SearchableSelect) → auto-shows SKU + name.
- Repeating **batch rows**: `batch_number*, mfg_date, expiry_date*, quantity*, purchase_cost, mrp, sale_price, location, supplier_id, notes`.
- "Add another batch" button.
- Validation: product required, batch number required, expiry required, quantity > 0, location required, no duplicate `(product, batch, expiry, location)` against existing batches unless user picks **Merge / Separate location / Cancel** in a confirmation prompt.
- On Save: for each batch row insert one `stock_movements` row with `movement_type='opening_stock'` + batch fields + cost. No supplier ledger, no purchase invoice, no payment.
- Writes one `audit_log` entry per batch via existing `logAudit()` helper.

## 3. Landed Cost Drawer (replaces current Landed Cost Engine block)

Reworked `ProductBatchProfileDialog` → split into two panels:

**Landed Cost panel**
- Read-only Purchase Cost (from `products.purchase_cost`).
- Repeating cost rows: type select (`printing|freight|loading|handling|customs|other`), amount, notes. "Add cost" button.
- Live Landed Cost total = purchase + Σ amounts.
- Live Gross Margin % from current sale price.
- **Save** → inserts one `product_landed_costs` row (purchase + per-type amounts + computed landed_cost). Trigger updates `products.cost_price`. **Never** mutates `products.purchase_cost`.

**Active Batches panel** — fix the empty-state bug:
- Replace current movement-aggregation logic in `src/lib/batches.ts` that only counts `IN_TYPES = ['purchase','purchase_in','return_in','adjustment_in','opening']`. Add `'opening_stock','sale','adjustment'` handling so any movement that affects stock is counted; treat `quantity` sign as the source of truth when present.
- Show "No active batches" only when the aggregated on-hand is 0 across all batches. When `products.stock_quantity > 0` but no batch rows exist, render a "Stock present but no batch history — add opening stock to record batches" hint instead of a misleading empty state.

## 4. Purchase Order display

In Purchase Order form/table/PDF (search hits in `PurchaseProforma.tsx`, `purchase_order_items`, the PO PDF template in `pdf-generator.ts`):
- Columns shown: SKU, Product, Qty, **Purchase Cost**, Discount, Tax, Line Total. Remove any "Landed Cost" column.
- Purchase Invoice + GRN keep their existing landing-expense allocation; on allocation, write to `product_landed_costs` with `source='purchase_invoice'` so the drawer history matches.

## 5. Reports

Switch these three to read `products.cost_price` (= landed cost) instead of `cost_price` raw:
- `ItemWiseReport.tsx` — profit column uses landed.
- `reports/ProductPerformance.tsx`, `reports/ProductCosting.tsx`, `reports/ProfitLoss.tsx` COGS lines.
- `Stock Valuation` (in Reports) — show two columns: **Value @ Purchase Cost** (qty × purchase_cost) and **Value @ Landed Cost** (qty × cost_price).
- Sales agent RLS already hides costs — no change needed.

## 6. Out of scope (explicitly not touched)

- Sales invoice / delivery note PDFs (recent fixes stay).
- Customer/supplier ledger logic.
- Warranty invoice flow.
- `selling_price` semantics (still Net Price per existing memory).

## 7. Acceptance / manual QA

1. Create Product A → SKU auto = `PRD-0001`. Purchase=48, Sale=65. Table shows Purchase 48, Landed 48, Margin **26.15%** with "Landed cost missing" chip.
2. Open Landed Cost drawer → add Printing 2, Freight 3, Other 1, Save. Table now: Landed 54, Margin **16.92%**, chip gone.
3. Create Product B (Purchase=100, Sale=150) → Margin **33.33%** with missing-landed chip.
4. Open Opening Stock dialog for Acuvit Syrup, add 3 batches (1000, 500, 200). Save. Product stock = 1700. Batch drawer lists all 3 with correct expiries. `stock_movements` has 3 `opening_stock` rows. No payment/ledger row created.
5. Create PO with 10× Product A → PDF and form show Purchase Cost only, no Landed column.
6. Convert PO → Purchase Invoice → allocate Freight 50. `product_landed_costs` gains a `source='purchase_invoice'` row; `products.cost_price` updates; old PO PDF unchanged.
7. Login as sales agent → no Purchase/Landed/Margin columns visible; opening-stock + landed drawers blocked by RLS.

## 8. Memory updates after build

- Update `mem://features/product-pricing-mrp-vs-net` with the new purchase_cost vs cost_price (landed) split.
- New memory `mem://features/landed-costs` already exists — append `product_landed_costs` table + drawer behaviour.
- Add `mem://features/opening-stock` describing the multi-batch flow and movement type.
