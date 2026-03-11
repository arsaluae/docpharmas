

# Fix PDF Preview Dialog Issues

## Problems Identified
1. **"Sales Order" title** — The WhatsApp share path (line 390) conditionally uses "SALES ORDER". The `printOrder` function doesn't pass a template, so the template title doesn't apply. Need to ensure all paths use "SALES INVOICE".
2. **Close button overlaps Download/Print** — The dialog's built-in X close button (positioned `right-4 top-4`) overlaps with the header action buttons.
3. **Download/Print opens new tab** — Currently opens a blank window and writes HTML. Should trigger `window.print()` on the iframe content directly, or open the new tab and auto-trigger print.
4. **SR# and Product Name hidden in preview** — The embedded iframe strips the toolbar but the table columns get compressed. The `#` and `Product` columns need minimum widths in the PDF HTML.

## Changes

### File 1: `src/components/PdfPreviewDialog.tsx`
- Move close button into the custom header bar (right side, after action buttons) and hide the default dialog close button
- Change `handlePrint`: Open in new tab AND auto-call `window.print()` after load
- Merge Save + Download/Print into a single "Download / Print" button that opens new tab with auto-print

### File 2: `src/components/ui/dialog.tsx`
- No change needed — we'll use a custom className on PdfPreviewDialog's DialogContent to hide the default close button via CSS

### File 3: `src/pages/ProformaInvoices.tsx`
- Line 390: Change `"SALES ORDER"` to `"SALES INVOICE"` (WhatsApp share path)
- Line 427: Pass `template: getTemplate("sales_invoice")` to `printOrder` so template columns apply
- Line 310: Update console log text

### File 4: `src/lib/pdf-generator.ts`
- Add `min-width` to first two columns (SR# and Product Name) in the table header and body cells so they don't collapse
- Ensure Product Name column gets `min-width: 140px` and SR# gets `min-width: 40px`

### File 5: `src/pages/PurchaseProforma.tsx`
- Same pattern: ensure all `generatePdfHtml` calls pass the correct template and title

