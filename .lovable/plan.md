

# Replace Side Sheet with Full PDF Preview Popup

## Problem
Clicking an order row opens a side sheet with a custom HTML preview. The user wants a full-screen popup showing the actual formatted invoice/order document with download option instead.

## Approach
Replace the `openPreview` function to directly open `PdfPreviewDialog` with the appropriate document:
- **Draft orders**: Generate and show the Sales Order / Purchase Order PDF
- **Invoiced/Dispatched orders**: Fetch invoice data and show the Sales Invoice / Purchase Invoice PDF
- Remove the `Sheet` component entirely from both pages
- Keep all action buttons (Submit, Edit, Void, Delete, WhatsApp, Download) in the table row — they already exist there

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Replace `openPreview` to generate PDF and open `PdfPreviewDialog` instead of Sheet; remove Sheet and all Sheet-related state (`previewOpen`, `previewOrder`, `editMode` etc.); move edit into a Dialog; keep edit mode in a separate Dialog |
| `src/pages/PurchaseProforma.tsx` | Same — replace `openPreview` to open PDF popup; remove Sheet; keep edit in a Dialog |

## Technical Details

**Sales `openPreview` replacement:**
- If order is `draft`: call existing `printOrder()` which already generates PDF and opens `PdfPreviewDialog`
- If order is `invoiced`/`dispatched`: call existing `printInvoice()` which fetches invoice data and opens `PdfPreviewDialog`

**Purchase `openPreview` replacement:**
- Fetch proforma items, then call `printOrder()` to open PDF popup

**Edit mode:**
- Move edit form from Sheet into a standalone `Dialog` (same form, just wrapped in `DialogContent` instead of `SheetContent`)
- `openEditSheet` will open this edit Dialog instead

**Removals:**
- Remove `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` imports and usage
- Remove `previewOpen`/`previewOrder` state (keep only what's needed for edit)
- Remove the entire Sheet JSX block (~150 lines per file)

This keeps all functionality intact while giving users the full formatted document popup they want.

