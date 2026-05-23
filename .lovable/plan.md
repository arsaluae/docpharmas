## Remaining work — continuing from approved plan

Picking up where the last batch left off. The bulk-delete infrastructure and `AddDistributorDialog` are already built. Now finishing the rest in this order:

### 1. Warranty Invoice — full TP rebuild
- Add **"Import from Sales Invoice"** dialog inside `WarrantyInvoices.tsx`. Lists customer's past sales invoices → user picks one → pulls all line items (product, batch, expiry, sold qty, MRP).
- Each row: editable Qty + MRP. **TP auto = MRP × 0.85** (read-only). **Line amount = Qty × TP**.
- Distributor combobox filtered by selected customer + inline **"+ Add Distributor"** button wired to the new `AddDistributorDialog`. No ledger impact.
- PDF template: columns `Product | Batch | Expiry | Qty | MRP | TP | Amount`.
- Add **"Warranty Invoices" tab** to `CustomerProfileDialog` listing past warranty invoices for that customer, clickable → opens PDF preview.

### 2. Ledger pages — work-of-art rebuild
Rebuild `CustomerLedger.tsx` and `SupplierLedger.tsx`:
- Dashboard strip: existing KPI cards + 6-month balance sparkline (Recharts) + aging buckets (0–30 / 31–60 / 61–90 / 90+).
- Filter bar: date range (default 90d, "All" toggle), multi-select type chips, search, **Export CSV + Export PDF**.
- **Clickable rows** open source documents: invoices → PDF preview dialog; payments → Payments page filtered; returns/notes → list page highlighted.
- Hairline borders, indigo accent, glass-kpi cards — matches system.

### 3. Bulk delete — remaining lists
Add `BulkActionBar` + row checkboxes to:
- `DebitNotes.tsx`
- `Payments.tsx`
- `Expenses.tsx`
- `SalesReturns.tsx` (already done — verify)
- Sales Invoices, Purchase Invoices (respect grace window per row)
- Sales Orders, Purchase Orders, Proforma, Purchase Proforma

### 4. UI alignment fixes
CSS-only pass on:
- **Sales Invoice form**: line-items header vs body column misalignment.
- **Warranty Invoice form**: total strip overlap on <1280px.
- **Sales Return dialog**: reason/notes grid + total row edges.

### 5. Print Job ↔ Purchase Order cross-link
- When a product is added to a PO, query `print_jobs` with matching `product_id` + active status. Show inline amber banner with link to job.
- "Use printed stock" button splits the PO line (print qty at print rate + remainder from supplier).
- In `PrintJobs.tsx`, reverse-link showing POs that consumed each job.

### Technical notes
- No schema changes. Uses existing tables (`warranty_invoices`, `warranty_invoice_items`, `customer_distributors`, `print_jobs`, `purchase_orders`).
- New components: `WarrantyImportDialog`, `LedgerFilters`, `LedgerSparkline`, `PrintJobMatchBanner`.
- Existing CSV/PDF helpers (`pdf-generator.ts`) reused.

### Out of scope
- Ledger impact for distributors (per your spec — print-only, no balance).
- Print-rejection split logic (kept at 50/50 editable per earlier answer).
- New triggers / migrations.

Implementing in order 1 → 5 so you can spot-check each piece as it lands.
