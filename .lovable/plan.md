## Continue Sales Order Hub – Remaining Items

Picking up from where we left off. No new DB migrations needed — all schema (freight_providers, delivery_notes.freight_provider_id, sales_returns) is already in place.

### 1. Dispatch + Batch Confirmation dialog
- New `src/components/sales/DispatchConfirmDialog.tsx` triggered on Sales Order "Submit/Dispatch".
- Step 1 – Batch picker: lists active batches per item (FEFO from `stock_movements`) showing **Batch #, On-hand, Expiry date**. User allocates ordered qty across batches.
- Step 2 – Courier picker: "Dispatched through?" dropdown from `freight_providers` (NCCS / ADDA / Self), plus optional tracking note.
- On confirm: create `sales_invoices` + `sales_invoice_items` (split per batch), `stock_movements` (`sale_out`), `delivery_notes` with `freight_provider_id` + `delivery_type_label` + `batch_number` + `expiry_date`, mark order `dispatched`, link `converted_invoice_id`.

### 2. Sales Order page polish (`src/pages/ProformaInvoices.tsx`)
- Rename remaining UI strings: page title → **Sales Orders**, all "Proforma/Invoice" labels → "Sales Order", primary button → **+ Create Sales Order**.
- Rebuild Items section as proper table with header row: **Product | Quantity | Price | Total**, right-aligned numerics, sticky totals footer, clean dividers.
- Row actions dropdown: add **Return Items** (opens existing `SalesReturnDialog`) and **Dispatch** (opens new `DispatchConfirmDialog`).
- Rebuild top KPI strip: custom glass card with month nav (← May 2026 →), 4 tiles — Orders / Pending / Dispatched / Returned — each with inline sparkline. Replaces the generic 3-box layout.

### 3. Sales Invoice row – Return entry point
- In `src/pages/SalesInvoices.tsx` row actions: add **Return Items** → opens `SalesReturnDialog` pre-filled with that invoice.

### 4. Delivery Notes page (`src/pages/DeliveryNotes.tsx`)
- New **Courier** column showing `delivery_type_label` with colored chip per provider.
- Filter chips at top: All / NCCS / ADDA / Self.
- Fix View Invoice / View DN action buttons to deep-link correctly.

### 5. Settings – Courier management
- New card in `src/pages/Settings.tsx`: list `freight_providers` with inline add/edit/toggle-active. Uses `useFreightProviders` hook.

### 6. Couriers page (already created) – minor wire-up
- Confirm sidebar link visible and KPI cards pulling current month data.

### Files

**Create**
- `src/components/sales/DispatchConfirmDialog.tsx`
- `src/components/settings/FreightProvidersCard.tsx`

**Edit**
- `src/pages/ProformaInvoices.tsx` (labels, items table, KPI strip, row actions)
- `src/pages/SalesInvoices.tsx` (Return Items action)
- `src/pages/DeliveryNotes.tsx` (courier column + filters)
- `src/pages/Settings.tsx` (mount FreightProvidersCard)

### Out of scope (this turn)
- No schema changes. No new tables. No changes to triggers or ledger logic — batch confirm reuses existing `sales_invoices` insert path which already fires balance + stock triggers.
