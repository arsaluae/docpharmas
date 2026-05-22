## Goal
Turn the current "Proforma/Sales Invoice" page into a true **Sales Order hub**: order quantities are a wish-list (no ledger/stock impact), and only after the **Batch Confirmation** step does the system create the real Sales Invoice + Delivery Note + stock movement + customer ledger entry. Add freight provider tracking and inline returns.

## 1. Sales Order page (ProformaInvoices.tsx → renamed labels)
- Replace every visible "Sales Invoice" / "Proforma" label with **"Sales Order"** (button: *Create Sales Order*, title, dialog headings, toasts, PDF title). DB tables stay as-is.
- Rebuild the **Items section** (the off-looking row in screenshot #1):

```text
┌─────────────────────────────────────────────────────────────┐
│ Items                                          [+ Add Item] │
├────┬──────────────────┬──────────┬──────────┬──────┬───────┤
│ #  │ Product          │ Quantity │ Price    │ Total│   🗑   │
├────┼──────────────────┼──────────┼──────────┼──────┼───────┤
│ 1  │ [Searchable ▾]   │   [  ]   │  [  ]    │ auto │       │
└────┴──────────────────┴──────────┴──────────┴──────┴───────┘
```
  Labeled headers, proper column widths, right-aligned numerics, total auto-computed, single trash icon. No stray spinner stubs.

- Order rows show in a new **Sales Orders** table; status starts as `draft`. Quantities here are *requested* only.

## 2. Batch Confirmation flow (the real ledger trigger)
On clicking **Submit / Confirm** on a draft Sales Order:
1. Open **Batch Picker dialog** listing each line item.
2. For each item: show available batches from `stock_movements` (FEFO via `getActiveBatches`) with **batch #, on-hand qty, expiry date**. User allocates the order qty across one or more batches (cannot exceed on-hand). Inline warning if any batch is `expiring`/`expired`.
3. On confirm:
   - Create `sales_invoices` + `sales_invoice_items` (per batch split) — **this is the qty that hits ledgers**.
   - Create `stock_movements` rows (`sale_out`) per batch.
   - Create `delivery_notes` with items including `batch_number` + `expiry_date`.
   - Mark sales order `status = 'dispatched'` and link `converted_invoice_id`.
   - Customer balance updates via existing `handle_sales_invoice_balance` trigger.

If user voids the order before confirm → nothing to roll back (no ledger touched), matches your "order is dummy" rule.

## 3. Freight providers (NCCS / ADDA / Self, managed)
- New table `freight_providers` (id, tenant_id, name, code, is_active, notes).
- Seed three rows on first load: NCCS, ADDA, Self.
- Settings → new **"Couriers"** card: add / rename / deactivate providers.
- Add `freight_provider_id` (nullable uuid) + `delivery_type_label` (text snapshot) to `delivery_notes`.
- During Batch Confirmation final step → **Dispatch dialog** asks: *"Dispatched through?"* → dropdown of active providers. Saved to the new DN columns.
- The existing DN appears in Delivery Notes page with a new **Courier** column + filter chips.

## 4. Couriers dashboard
- New page **`/couriers`** (sidebar under Sales).
- Top: month picker + per-provider KPI cards: total DNs, total pcs dispatched.
- Click a provider card → drill-in table: customer name, city, dn_number, date, total pcs (sum of item qty).
- Data: aggregate `delivery_notes` joined with `customers` filtered by `freight_provider_id` and month.

## 5. Sales Return (inline, from both order row and invoice row)
- New "Return Items" action in the `···` menu on Sales Order rows **and** on Sales Invoice rows.
- Dialog lists each item that was actually sold (sourced from `sales_invoice_items` of the converted invoice). For each line: item name (read-only), **max returnable** = sold − already_returned (hard cap), qty input, price (default from invoice), reason (text/select).
- On submit: create `sales_returns` + `sales_return_items` (existing tables), which feed the existing `handle_sales_return_balance` trigger + stock-in movement. Block submit if qty > max or order/invoice has no dispatched items.

## 6. Top KPI section redesign
Replace the generic 3 colored boxes (screenshot #2 top) with a tighter custom strip:

```text
┌──────────────────────────────────────────────────────────────────┐
│  May 2026  ‹ ›    │ Orders ●●●     │ Pending     │ Dispatched  │
│                   │   2            │   0         │   2         │
│                   │ PKR 98,500     │ PKR 0       │ PKR 98,500  │
└──────────────────────────────────────────────────────────────────┘
```
- Glassmorphism, mesh-gradient accent border (matches existing `style/ui-patterns` memory).
- Inline sparkline of last 7 days per metric.
- Month nav stays left-aligned; cards collapse to horizontal scroll on <640px.

## 7. Delivery Notes page tweaks
- New **Courier** column showing `delivery_type_label`.
- Filter chips: All / NCCS / ADDA / Self / + custom.
- View Invoice / View DN buttons label corrected ("View Invoice" only appears if linked invoice exists).

## Technical details
**Migrations**
- `freight_providers` table + RLS (tenant-scoped, mirrors existing pattern).
- `delivery_notes`: add `freight_provider_id uuid`, `delivery_type_label text`.
- Seed function to insert NCCS/ADDA/Self per tenant on first call (idempotent via `ON CONFLICT (tenant_id, code)`).
- No changes to ledger triggers — they already key off `sales_invoices`/`sales_returns`.

**Files**
- `src/pages/ProformaInvoices.tsx` — label rename, items table redesign, top KPI strip, wire Batch Picker + Dispatch dialog into Submit flow, add Return action.
- `src/components/sales/BatchPickerDialog.tsx` *(new)* — per-line batch allocation using `getActiveBatches`.
- `src/components/sales/DispatchDialog.tsx` *(new)* — freight provider selector.
- `src/components/sales/SalesReturnDialog.tsx` *(new)* — capped return entry, used from both Order and Invoice rows.
- `src/pages/Couriers.tsx` *(new)* + route + sidebar entry.
- `src/pages/Settings.tsx` — Couriers management card.
- `src/pages/DeliveryNotes.tsx` — Courier column + filter chips.
- `src/hooks/useFreightProviders.tsx` *(new)* — cached list.
- `src/App.tsx` — `/couriers` route.

**Out of scope (ask before doing)**
- Renaming the underlying DB tables (`proforma_invoices` etc.) — only UI labels change.
- Editing PurchaseProforma side — request was Sales-only.
