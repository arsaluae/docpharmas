

# Fix: Stock Movement Constraint, PDF Preview Size, and Product Name Visibility

## Issues Found

### 1. Stock movement fails on sales invoice creation
The database `stock_movements_movement_type_check` constraint only allows: `purchase_in, sale_out, return_in, return_out, adjustment`.
But the code inserts:
- `"sale"` (ProformaInvoices.tsx line 396) — should be `"sale_out"`
- `"adjustment_in"` (PurchaseProforma.tsx line 401) — not in constraint
- `"adjustment_out"` (PurchaseProforma.tsx line 408) — not in constraint

The `handle_stock_movement` trigger already handles all these types, but the CHECK constraint blocks them.

**Fix**: Update the CHECK constraint to include all types the trigger supports: `purchase_in, sale_out, return_in, return_out, adjustment, adjustment_in, adjustment_out, opening, damage, expired`. Also change `"sale"` to `"sale_out"` in ProformaInvoices.tsx for consistency.

### 2. PDF preview opens as a popup requiring "Open in Tab"
The `PdfPreviewDialog` uses an iframe inside a dialog. The dialog is `max-w-4xl w-[90vw] h-[85vh]` which should be large enough, but the iframe content may have large margins and the page-frame styling inside the generated HTML may not scale to fit.

**Fix**: Make the PdfPreviewDialog truly full-screen (`w-[98vw] h-[95vh] max-w-none`) and inject CSS into the iframe to scale the document to fit the viewport width so the entire invoice is visible at a glance without scrolling horizontally.

### 3. Product names truncated/hidden in purchase draft and invoice tables
The items grid in the create/edit dialog uses `col-span-4` out of 12 columns for the product select, but the SearchableSelect trigger text gets cut off. The PDF document rows also may truncate product names.

**Fix**: Give the product column more space in the items grid (increase from `col-span-4` to `col-span-5`) and ensure the SearchableSelect doesn't truncate text.

## Changes

| File | Change |
|------|--------|
| Migration SQL | Expand `stock_movements_movement_type_check` to include all valid types |
| `src/pages/ProformaInvoices.tsx` | Change `movement_type: "sale"` to `"sale_out"` |
| `src/components/PdfPreviewDialog.tsx` | Make dialog full-screen, inject fit-to-width CSS into iframe |
| `src/pages/PurchaseProforma.tsx` | Widen product column in items grid |

