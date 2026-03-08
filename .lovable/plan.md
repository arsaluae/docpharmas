

# Plan: Fix Order Flows, PDF Preview, and Stock Variance

## Issues Identified

After reviewing both `ProformaInvoices.tsx` (Sales) and `PurchaseProforma.tsx` (Purchase), here are the problems and fixes:

## Changes

### 1. View Order → Show PDF Preview (not side sheet)
Currently clicking "View" or an order row opens a `Sheet` side panel. Change this so clicking a row opens the `PdfPreviewDialog` with the full PDF document rendered inside. Keep the Sheet for Edit mode only.

**Both files**: `openPreview()` will generate PDF HTML and open `PdfPreviewDialog` instead of the Sheet. The Sheet will only open when user clicks "Edit".

### 2. Table Row Actions: Add Edit + Download PDF buttons
In both Sales and Purchase tables, the action column currently shows only Submit/Confirm + View + Delete. Change to:
- **Edit** button (pencil icon) — opens Sheet in edit mode (draft only)
- **Download PDF** button — opens PdfPreviewDialog
- **Submit/Confirm** button — existing behavior

### 3. Fix Sales Submit Flow
The submit flow code (lines 348-451 in ProformaInvoices.tsx) looks correct — it creates invoice, stock movements, and delivery note. The issue is likely that the `sales_invoices` table insert fails silently. Add proper error handling and ensure the table/columns match. Will add explicit error toasts at each step.

### 4. Fix Purchase Confirm Flow
The confirm flow (lines 262-313 in PurchaseProforma.tsx) creates a PO but doesn't ask for batch/expiry. Currently batch/expiry is only captured during "Receive". 

**Change**: When confirming a draft PO, open a dialog asking for batch number + expiry for each item (similar to sales submit dialog). Store these on the PO items. The confirm step will now:
1. Show batch/expiry input dialog
2. Create PO with batch info on items
3. Update proforma status

### 5. Receive: Quantity Confirmation + Stock Variance
The receive dialog already has qty received input. Add logic:
- Compare `quantity_ordered` vs `quantity_received` for each item
- If different, create a `stock_movements` entry with type `adjustment_in` (over-received) or `adjustment_out` (under-received) with notes explaining the variance
- Show variance summary in a toast

### 6. Fix PdfPreviewDialog Accessibility
Add hidden `DialogTitle` and `DialogDescription` to fix console warnings.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | View → PDF dialog, add Edit/PDF buttons in table, fix submit error handling |
| `src/pages/PurchaseProforma.tsx` | View → PDF dialog, add Edit/PDF buttons in table, batch/expiry on confirm, stock variance on receive |
| `src/components/PdfPreviewDialog.tsx` | Add DialogTitle + DialogDescription for accessibility |

## No database changes needed
All tables and columns already exist. Stock variance uses existing `stock_movements` with `adjustment_in`/`adjustment_out` types which are already handled by the `handle_stock_movement` trigger.

