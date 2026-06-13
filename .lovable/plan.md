## Goal
Make the document engine produce professional A4-ready documents where preview, Save as PDF, and Print all use the same clean source and layout.

## What I will fix
- Redesign the shared invoice/order document template so it looks like a proper MOUJ-branded invoice, not a cramped screenshot.
- Make the MOUJ logo prominent and reliably visible in downloaded PDFs and print output.
- Fix clipped/cut text, especially MRP, totals, headers, product names, and narrow numeric columns.
- Fix Delivery Note layout so product names use the available width and the batch/expiry/qty columns do not float far away.
- Make Delivery Notes print as top-half A4 only when item count is small; if there are more items, automatically use full A4.
- Keep the lower half blank for half-A4 delivery notes.
- Stop unnecessary second PDF pages for half-A4 documents.
- Make Print use the exact same PDF rendering as Save as PDF so the app sidebar/chrome and bad browser HTML formatting do not appear.
- Add preview/print/PDF actions for Sales Return and Purchase Return screens, which currently list returns but do not use the shared document preview flow.

## Implementation plan

### 1. Rework the shared document HTML in `src/lib/pdf-generator.ts`
- Replace the current loose `.page-frame` sizing with a stable A4 sheet:
  - `210mm x 297mm` for full documents.
  - `210mm x 148.5mm` printable content zone inside a full A4 PDF for half-page mode.
- Redesign the header as a two-column brand header:
  - Larger logo block on the left.
  - Company name/contact block on the right.
  - If a logo exists, load it with `crossorigin="anonymous"`, fixed max dimensions, and visible fallback company name.
- Add explicit document section wrappers for header, meta/customer, items, totals, notes, bank, and signatures so page breaks stay clean.
- Use tighter but readable typography and spacing tuned for Pakistani pharma invoices.

### 2. Fix columns and clipping globally
- Replace brittle inline width guesses with document-aware column presets:
  - Sales Order / Sales Invoice: product gets priority; MRP and Amount have enough width and wrap headers safely.
  - Delivery Note: product column expands; Batch, Expiry, Qty, MRP stay compact.
  - Purchase docs: balanced Batch / Expiry / Ordered / Received / Rate / Amount columns.
  - Returns: product, batch, quantity, rate, amount columns.
- Allow numeric headers such as `MRP Inc. Tax`, `Qty Received`, and `Amount` to wrap without cutting.
- Use `overflow-wrap:anywhere` for long product names and keep numeric values tabular.

### 3. Make half-A4 logic correct
- Introduce document-type-aware page mode resolution:
  - Delivery Note: half-page only when item count is within the small-item limit; otherwise full A4.
  - Other documents continue to follow the configured/auto mode but will no longer clip or create fake second pages.
- For half-A4:
  - Render only at the top of A4.
  - Keep bottom half intentionally blank.
  - Do not use `overflow:hidden` that hides rows.
  - If content exceeds the safe half-page height, promote to full A4 instead of cutting content.

### 4. Fix `PdfPreviewDialog.tsx` PDF/print generation
- Capture only the document sheet, never the whole app/body.
- For half-A4 output, generate a real single A4 PDF page with the captured document placed in the top half and the bottom half blank.
- For full A4 output, use clean pagination and avoid splitting important sections like totals/signatures.
- Change Save as PDF to open a clean PDF preview tab and download from the same blob/source, so preview and saved PDF match.
- Change Print to open/print that same PDF blob instead of raw HTML.

### 5. Wire missing return documents
- Update `SalesReturns.tsx`:
  - Load enough customer/product/item detail for printable return documents.
  - Add PDF/Print action using `PdfPreviewDialog` and shared template.
- Update `PurchaseReturns.tsx`:
  - Load enough supplier/product/item detail.
  - Add PDF/Print action using the same shared template.

### 6. Verify after build mode
- Open Sales Order, Sales Invoice, Delivery Note previews from `/proforma`.
- Check small Delivery Note uses top-half A4 and no second page.
- Check larger Delivery Note promotes to full A4.
- Check PDF blob preview, downloaded PDF, and Print all match.
- Check MOUJ logo visibility/size and MRP readability.
- Check Sales Return and Purchase Return document previews render professionally.