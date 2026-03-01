

# Plan: End-to-End Workflow Fixes for Purchase & Sales Cycles

## Current Problems Identified

**Purchase cycle**: Approving a proforma just changes status silently. Converting to PO doesn't auto-open the PO or download PDF. GRN requires batch but not expiry date. Items don't start with a blank row.

**Sales cycle**: Converting proforma to invoice doesn't auto-download PDF. Creating a Delivery Note just copies items without batch selection. No stock/batch validation on DN creation. No multi-batch support (e.g., 100 qty from two batches of 50 each). Items don't start with a blank row.

---

## Changes

### 1. Purchase Proforma (`PurchaseProforma.tsx`)
- **Approve action**: After approving, auto-trigger `convertToPO` immediately (approve = confirm & create PO in one click)
- **`convertToPO`**: After PO is created, navigate to `/purchase-orders` and auto-download the PO PDF via URL param `?print=PO_ID`
- **New item dialog**: Start with 1 blank item row auto-added when dialog opens

### 2. Purchase Orders (`PurchaseOrders.tsx`)
- **Auto-print on arrival**: Read `?print=PO_ID` from URL params, if present auto-download that PO's PDF
- **Create GRN button**: Currently navigates to `/grn?po=id` — this works, keep it
- **New item dialog**: Start with 1 blank item row

### 3. GRN (`GoodsReceivedNotes.tsx`)
- **Require both batch AND expiry**: Validate that every item has both `batch_number` and `expiry_date` before saving. Show clear error if missing
- **Auto-open with 1 blank item** when not pre-filled from PO
- **After GRN save**: Auto-download GRN PDF

### 4. Sales Proforma (`ProformaInvoices.tsx`)
- **Approve action**: After approving, auto-open the Convert to Invoice dialog immediately
- **After conversion**: Auto-download the new sales invoice PDF and navigate to `/sales-invoices`
- **New item dialog**: Start with 1 blank item row

### 5. Sales Invoices (`SalesInvoices.tsx`)
- **New item dialog**: Start with 1 blank item row
- **DN button → Batch Selection Dialog**: Replace the current instant-create with a new dialog that:
  - Shows each invoice item with product name and required quantity
  - For each item, fetches available batches from `stock_movements` (grouped by product_id + batch_number, with net available qty)
  - Allows adding multiple batch rows per item (e.g., 50 from Batch-A, 50 from Batch-B)
  - Validates: total batch quantities must equal invoice quantity for each item
  - Validates: each batch row must have batch_number and expiry_date
  - Validates: requested qty per batch must not exceed available stock for that batch
  - Only creates the DN if all validations pass
  - Shows "Insufficient stock" error if not enough quantity available

### 6. Delivery Notes (`DeliveryNotes.tsx`)
- Items in DN will now contain batch_number and expiry_date from the batch selection dialog (already stored in items JSON)

---

## Files Changed

| File | Change |
|------|--------|
| `PurchaseProforma.tsx` | Approve → auto-convert to PO → navigate with print param; auto-add 1 item on dialog open |
| `PurchaseOrders.tsx` | Read `?print` param and auto-download PDF; auto-add 1 item on dialog open |
| `GoodsReceivedNotes.tsx` | Require expiry_date on all items; auto-download PDF after save; auto-add 1 item |
| `ProformaInvoices.tsx` | Approve → auto-open convert dialog; after convert → auto-download invoice PDF; auto-add 1 item |
| `SalesInvoices.tsx` | DN button → batch selection dialog with multi-batch support and stock validation; auto-add 1 item |

## Technical Notes
- Batch availability is calculated from `stock_movements` table: sum of inbound types minus outbound types, grouped by `(product_id, batch_number)`
- Expiry dates for batch selection come from `grn_items` where that batch was first received
- Multi-batch support means each invoice line item can be split into multiple DN line items with different batch numbers
- No database changes needed — all logic is client-side using existing tables

