

# System Audit: Landed Cost, Print Jobs & Sales Invoice Improvements

## Issues Found

### 1. Additional Costs are disconnected from Product Costing
The `additional_costs` table exists and is used in Purchase Proformas, but the **Product Costing report** (`reports/ProductCosting.tsx`) completely ignores it. It only shows raw `cost_price` vs `selling_price` — no landed cost calculation at all.

### 2. Print Jobs don't sync costs back to products
When a print job is settled, the packaging cost is recorded on the printer's balance but never flows into the product's landed cost. There is no link between `print_jobs` and `additional_costs`.

### 3. Cost types are not pharma-relevant
The current `costType` defaults to `"printing"` with no structured list. Pharma distribution needs: **Packaging/Printing, Freight/Transport, Clearing/Customs, Insurance, Storage, Registration (DRAP), Testing/QC, Other**.

### 4. No "Landed Cost" page — costs are buried inside Purchase Proformas
Users can only add costs during purchase creation or via a small dialog. There's no dedicated view to see all costs by product, by type, or by period.

### 5. Sales Invoice missing discount field
The sales invoice form has no line-level or order-level discount capability — a standard requirement for pharma distribution.

### 6. Print Jobs have no PDF/document generation
Unlike every other module, Print Jobs have no preview/print document capability.

---

## Implementation Plan

### Phase 1: Rename & Restructure "Additional Costs" → "Landed Costs"

**Sidebar**: Rename the concept. Add a dedicated **"Landed Costs"** page under the Inventory section.

**Cost Types** (pharma-relevant):
- `packaging` — Packaging material (cartons, boxes, labels)
- `printing` — Print jobs (linked from Print Jobs module)
- `freight` — Transport/delivery charges
- `clearing` — Customs/clearing charges
- `insurance` — Cargo/goods insurance
- `storage` — Warehousing/cold-chain
- `registration` — DRAP fees
- `testing` — QC/lab testing
- `other`

**Files**: Update `src/pages/PurchaseProforma.tsx` cost type dropdown.

### Phase 2: Auto-sync Print Jobs → Landed Costs

When a print job is **settled**, automatically insert an `additional_costs` record:
- `reference_type`: `"print_job"`
- `reference_id`: print job ID
- `cost_type`: `"printing"`
- `amount`: settled `total_cost`
- `vendor_id`: `printer_id`

This links printing costs into the landed cost system.

**File**: `src/pages/PrintJobs.tsx` — update `handleSettle()`.

### Phase 3: New Landed Costs Page

Create `src/pages/LandedCosts.tsx`:
- Table showing all `additional_costs` records with filters by cost_type, date range, product
- Summary cards: Total by cost type (packaging, freight, printing, etc.)
- Ability to add standalone landed costs (not tied to a purchase order)
- Link to source document (purchase order, print job)

Add to sidebar under Inventory section.

**Files**: Create `src/pages/LandedCosts.tsx`, update `src/components/AppSidebar.tsx`, update `src/App.tsx` routes.

### Phase 4: Enhanced Product Costing Report

Rebuild `src/pages/reports/ProductCosting.tsx` to calculate **true landed cost**:
- Base cost (from `products.cost_price`)
- + Packaging costs (from `additional_costs` where cost_type = 'packaging' or 'printing')
- + Freight (from `additional_costs` where cost_type = 'freight')
- + Other landed costs
- = **Total Landed Cost**
- vs Selling Price → True Margin

Query `additional_costs` joined with purchase items to calculate per-product landed cost.

### Phase 5: Sales Invoice Discount Support

Add discount fields to the sales invoice:
- Line-level discount % per item
- Order-level discount amount
- Show discount on PDF

**File**: `src/pages/ProformaInvoices.tsx` — add discount to item rows and totals calculation.

### Phase 6: Print Job Document Generation

Add PDF preview/print capability to Print Jobs, matching the pattern used everywhere else.

**File**: `src/pages/PrintJobs.tsx` — add preview button and PDF generation.

---

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/LandedCosts.tsx` | **Create** — dedicated landed costs management page |
| `src/pages/reports/ProductCosting.tsx` | **Rewrite** — include landed costs in margin calculation |
| `src/pages/PrintJobs.tsx` | **Edit** — auto-create additional_cost on settle, add PDF preview |
| `src/pages/PurchaseProforma.tsx` | **Edit** — update cost type dropdown to pharma-relevant list |
| `src/pages/ProformaInvoices.tsx` | **Edit** — add discount field to items and totals |
| `src/components/AppSidebar.tsx` | **Edit** — add Landed Costs link under Inventory |
| `src/App.tsx` | **Edit** — add route for `/landed-costs` |
| `src/lib/pdf-generator.ts` | No changes needed (already supports flexible columns) |

No database migrations needed — the existing `additional_costs` table already has the right structure (`cost_type`, `reference_type`, `reference_id`, `vendor_id`, `amount`).

