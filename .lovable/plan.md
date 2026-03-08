

# Plan: Fix Order Flows + PDF Preview

## Problems Found

1. **Row click opens PDF dialog instead of Sheet** — both Sales and Purchase `openPreview()` now bypass the Sheet (which has Submit/Confirm/Receive action buttons). Users can't progress orders because the workflow buttons are in the Sheet.
2. **Sales Submit fails** — likely because no purchase_in stock movements exist yet (no batches available), blocking invoice creation.
3. **Purchase Confirm works from table button** but is inaccessible from preview since Sheet no longer opens.
4. **PDF preview only shows header** — the iframe renders the document but items may be missing if state isn't loaded.

## Fix

### 1. Restore Row Click → Sheet (both files)
Change `openPreview()` back to opening the Sheet with details + action buttons. The Sheet is the primary interaction point for Submit/Confirm/Receive/Edit/Delete.

### 2. Dedicated PDF Button → PdfPreviewDialog
Keep the Download button in both the table AND the Sheet opening PdfPreviewDialog. For invoiced/ordered orders, show the appropriate document (Invoice PDF for invoiced sales, PO PDF for confirmed purchase).

### 3. Sales Submit: Show clearer error + fix batch check
If no batches exist, show actionable error ("Purchase and receive stock first"). The flow itself is correct but the batch requirement blocks it when no stock exists.

### 4. Purchase: Ensure Confirm flow works end-to-end
The `handleConfirmOrder` function looks correct. Will add explicit error toasts at each step to surface any silent failures.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Restore `openPreview` to open Sheet; keep PDF button separate; add error clarity to submit |
| `src/pages/PurchaseProforma.tsx` | Restore `openPreview` to open Sheet; keep PDF button separate; add error handling to confirm |

