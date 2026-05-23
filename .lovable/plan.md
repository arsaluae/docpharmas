
## Scope

Seven focused improvements based on your answers. No scope creep.

---

### 1. Warranty Invoice — full rebuild around TP pricing

**Form changes (`WarrantyInvoices.tsx`):**
- Add **"Import from Sales Invoice"** picker (per selected customer). Pulls each line: product, **batch, expiry, sold qty, MRP**.
- Each row becomes editable: **Quantity** and **MRP** (both editable). Batch + expiry locked from source.
- **TP auto-calculated** = `MRP × 0.85` (15% off), shown read-only beside MRP.
- **Line Amount = Qty × TP** (not MRP). MRP shown only as reference + printed on PDF.
- **Invoice total = sum of TP amounts.**
- PDF template updated: columns become `Product | Batch | Expiry | Qty | MRP | TP | Amount(TP)`.

**Distributor handling (lightweight — per your spec, no ledger hit):**
- Replace the heavy "distributor" picker with a simple combobox tied to `customer_distributors` filtered by the chosen customer.
- **"+ Add Distributor"** button inline → mini dialog (name, phone, license, address) → inserts into `customer_distributors` and selects it.
- Distributor name printed on PDF header only. **No balance, no ledger entry.**

**History view:**
- On `CustomerProfileDialog` (and a new tab on Customers list), show **"Warranty Invoices"** list for that customer — clickable rows open the existing PDF preview.

---

### 2. Ledger pages — work-of-art rebuild

**Both `CustomerLedger.tsx` and `SupplierLedger.tsx`:**

Layout:
```text
┌─────────────────────────────────────────────────┐
│  DASHBOARD STRIP (top)                          │
│  KPI cards + 6-mo trend sparkline + aging mini  │
├─────────────────────────────────────────────────┤
│  FILTER BAR  [date range] [type] [search] [⇩CSV]│
├─────────────────────────────────────────────────┤
│  LEDGER TABLE (clickable rows)                  │
└─────────────────────────────────────────────────┘
```

- **Clickable rows** → open the source document:
  - Sales Invoice / Purchase Bill → PDF preview dialog
  - Payment → Payments page filtered to that row
  - Return / CN / DN → respective list page with row highlighted
- **Date range filter** (default: last 90 days, "All" toggle).
- **Type filter** (multi-select chips: Invoice / Payment / Return / Note).
- **Export** — CSV + PDF (uses existing `pdf-generator.ts`).
- Dashboard strip: KPIs already there + new sparkline (Recharts area, last 6 months balance trend) + aging buckets (0-30 / 31-60 / 61-90 / 90+) when there's outstanding.
- Hairline borders, indigo accent, glass-kpi cards — matches the rest of the system.

---

### 3. Bulk delete on all transactional lists

Add checkbox column + sticky "Delete selected (N)" action bar to:
- Sales Returns, Purchase Returns
- Credit Notes, Debit Notes
- Payments, Expenses
- Sales Invoices, Purchase Invoices (respects existing grace window per row)
- Sales Orders, Purchase Orders

Bulk action calls existing per-row delete logic in a loop, surfaces per-row failures in a toast summary.

---

### 4. Sales/Purchase Returns — stock adjustment correctness

Audit existing flow:
- **Sales Return** already inserts `stock_movements` with `return_in` → stock goes up ✅ (trigger `handle_stock_movement` confirms this).
- **Purchase Return** — verify symmetric `return_out` movement is firing. If missing, add it inside `PurchaseReturns.tsx` save handler so supplier stock leaves our books.
- Add small "Stock impact" preview at the bottom of both return dialogs ("This will increase/decrease X units of N products").

---

### 5. Print Job ↔ Purchase Order cross-link

When creating a Purchase Order, after a product is added:
- Query `print_jobs` where `product_id` = added product **AND** status IN (`in_progress`, `ready`, `settled` with undelivered qty).
- If found, show an inline **amber banner** under the line:
  > "🖨 Print job `PJO-0042` has 5,000 units ready from Printer XYZ at PKR 12/unit. [Link to job]"
- Add **"Use printed stock"** button → splits the line: one row from print job (cost = print rate), remainder ordered from supplier.
- In `PrintJobs.tsx`, add reverse link showing POs that consumed each job.

---

### 6. Payments & Invoices, Credit & Debit Notes — separable views

- Payments page: add tab toggle **All / Received / Made** (already partially exists via `?tab=` deep links — formalize into top tabs).
- Invoices: nothing structurally changes — already separate (Sales vs Purchase).
- Credit Notes page: add filter tab **All / Customer / Supplier** (party_type filter).
- Debit Notes page: same.

---

### 7. UI alignment fixes (Sales Invoice, Warranty Invoice, Sales Return)

Targeted CSS-only pass on:
- **Sales Invoice form** — line-items header columns vs body columns (off by ~8px when batch column is shown).
- **Warranty Invoice form** — total strip overlaps action buttons on <1280px.
- **Sales Return dialog** — reason/notes grid drops below the table awkwardly; tighten spacing and align the total row with table edge.

No business logic touched in this step.

---

## Technical notes

- New migration needed: none for #1-#7 (uses existing tables). Only data writes through existing `customer_distributors`.
- New components: `BulkActionBar`, `LedgerFilters`, `LedgerSparkline`, `WarrantyImportDialog`, `PrintJobMatchBanner`, `MiniAddDistributorDialog`.
- Existing tables touched (no schema change): `warranty_invoices`, `warranty_invoice_items`, `customer_distributors`.
- Print-rejection 50/50 split stays as-is (per your answer).

## Out of scope (will not touch)

- Journal-entry shape for print rejections.
- Tax/WHT logic on warranty (TP-only as you specified).
- Any change to existing return triggers beyond auditing them.

---

After approval I'll implement in the order above (1 → 7) so you can spot-check each piece as it lands.
