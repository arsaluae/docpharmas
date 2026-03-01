

# Plan: Unified Cross-Workable Purchase & Sales Workflow

## Current Issues Found

1. **Sales Proforma delete uses `window.confirm()`** — blocked in preview iframe, delete silently fails (same bug that was fixed on Purchase side)
2. **Sales Invoice delete uses `window.confirm()`** — same problem
3. **Delivery Note delete uses `window.confirm()`** — same problem
4. **No flow indicators on Delivery Notes page** — user doesn't know DN comes from Sales Invoice
5. **Purchase side**: Proforma → PO → GRN works, but GRN doesn't auto-trigger Purchase Invoice (Bill) creation
6. **Sales side**: Proforma → Invoice → DN works, but the Approve flow on sales proforma has a stale-state bug (same as the one fixed on purchase side — it tries `proformas.find()` which may use old state)
7. **Document columns inconsistent**: Proformas and Invoices should show rate/amount. DN and GRN should show only item name, quantity, batch, expiry. Currently correct but needs enforcement.
8. **No cross-linking visibility**: PO doesn't show which GRN was created from it. Invoice doesn't show which DN was created from it.
9. **Purchase Invoice (Bill) page** has no sequential flow enforcement — users can create standalone bills. Should only be created from GRN.

## Changes

### 1. Fix all `window.confirm()` → Custom Dialog
**Files**: `ProformaInvoices.tsx`, `SalesInvoices.tsx`, `DeliveryNotes.tsx`
- Add `deleteConfirmOpen` + `deleteIds` state pattern (same as PurchaseProforma)
- Replace all `window.confirm()` calls with custom confirmation Dialog

### 2. Fix Sales Proforma Approve stale-state bug
**File**: `ProformaInvoices.tsx`
- In `handleApprove`, after updating status, fetch the proforma directly from DB (not from `proformas.find()`) before calling `openConvertDialog`

### 3. Add flow indicators everywhere
**File**: `DeliveryNotes.tsx`
- Add flow indicator banner: `① Proforma → ② Sales Invoice → ③ Delivery Note`
- Add "Go to Sales Invoices" button in header
- Update empty state message to guide user

### 4. Auto-create Purchase Invoice (Bill) from GRN
**File**: `GoodsReceivedNotes.tsx`
- After GRN is saved and stock updated, auto-create a `purchase_invoice` record with the same supplier, items, and totals from the PO
- Navigate to `/purchase-invoices` after creation with a success toast
- Update PO status to "received" (already done)

### 5. Enforce sequential flow on Purchase Invoices page
**File**: `PurchaseInvoicesPage.tsx`
- Remove standalone "New Bill" button if it exists
- Add flow indicator: `① Proforma → ② PO → ③ GRN → ④ Purchase Invoice`
- Add "Go to GRN" button
- Update empty state message

### 6. Cross-reference visibility
**File**: `PurchaseOrders.tsx`
- Show GRN status/number in PO table when a GRN has been created (query `goods_received_notes` by `po_id`)

**File**: `SalesInvoices.tsx`
- Show DN number in invoice table when a DN has been created (query `delivery_notes` by `reference_id`)

### 7. Sidebar label cleanup
**File**: `AppSidebar.tsx`
- Rename "Proforma" → "Sales Orders" and "Purchase Proforma" → "Purchase Orders" for clarity
- Or keep as-is based on user's pharma terminology (they called them "quotations / unconfirmed orders")
- Add "Purchase Bills" label clarity

## Files Changed

| File | Change |
|------|--------|
| `ProformaInvoices.tsx` | Fix delete (custom Dialog), fix approve stale-state bug |
| `SalesInvoices.tsx` | Fix delete (custom Dialog), show linked DN number |
| `DeliveryNotes.tsx` | Fix delete (custom Dialog), add flow indicator + nav button |
| `GoodsReceivedNotes.tsx` | Auto-create purchase invoice after GRN save |
| `PurchaseInvoicesPage.tsx` | Remove standalone creation, add flow indicator |
| `PurchaseOrders.tsx` | Show linked GRN number in table |
| `AppSidebar.tsx` | Minor label clarity updates |

## Technical Notes
- Purchase Invoice auto-creation reuses the PO's items (fetched from `purchase_order_items`), with rates from the confirmed PO
- No database schema changes needed — all tables already exist
- The `purchase_invoices` table has `grn_id` column for linking back to the GRN
- All delete confirmations use the same Dialog pattern already proven in PurchaseProforma

