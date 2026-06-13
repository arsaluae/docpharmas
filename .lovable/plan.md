I’ll make this a central document-engine fix, not another per-screen patch.

## Scope
Fix preview, Save as PDF, and Print for:
- Sales Order
- Sales Invoice
- Delivery Note
- Warranty Invoice / Warranty Note
- Purchase Order
- Purchase Invoice
- Sales Return
- Purchase Return
- Payment Receipt where available

## Root issues to fix
- The current half-A4 CSS uses fixed `height:138mm` plus `overflow:hidden`, which is cutting item rows/MRP and hiding table content.
- Half-page CSS still has `page-break-after: always`, which can create the extra second page.
- Print currently opens raw HTML and calls browser print, so browser headers/footers and layout differences still appear.
- The table uses fixed pixel widths that are too wide for half-A4, especially MRP/Amount, causing clipping.
- Some document types do not use the shared document preview/export pipeline consistently.

## Implementation plan

### 1. Rebuild the shared document template layout
In `src/lib/pdf-generator.ts`:
- Remove the half-page `overflow:hidden` behavior that hides rows.
- Remove all forced `page-break-after: always` from half-page documents.
- Add a stable `.erp-document-sheet` / `.document-content` structure so preview, print, and PDF target the exact same element.
- Add `data-pdf-section` wrappers around header, title/meta, item table, totals, words/bank, notes, and signatures.
- Keep half-A4 as an A4 sheet with content positioned in the top half and the lower half intentionally blank.
- Auto-promote to full A4 when content cannot fit cleanly in half-A4.

### 2. Fix table clipping and MRP readability
- Replace the current fixed-pixel table widths with safer percentage colgroups.
- Use compact pharma invoice presets:
  - Sales Order / Invoice: product gets priority, MRP and Amount wrap headers cleanly.
  - Delivery Note: product column expands; no wasted gap before batch/expiry/qty.
  - Purchase documents: batch/expiry/qty/rate/amount balanced for compact rendering.
- Allow all headers like `MRP Inc. Tax`, `Qty Received`, and `Amount` to wrap without clipping.
- Keep numeric cells readable with tabular mono formatting.

### 3. Make Save as PDF one-page when half-A4
In `src/components/PdfPreviewDialog.tsx`:
- Stop capturing the whole `body` with accidental extra height.
- Capture only the document sheet element.
- For half-A4, create exactly one A4 PDF page: document content in the top half, lower half blank.
- For full-A4, use section-aware pagination so totals/signatures do not split or disappear.
- Save button will open/download the generated PDF from the same rendered source used in preview.

### 4. Make Print use the PDF path, not raw browser HTML
- Print will generate the same PDF blob as Save as PDF, open it in a clean new tab, then trigger the PDF viewer print flow.
- This avoids app UI/sidebar printing and avoids raw web-page print headers/layout drift.
- Remove duplicate `window.print()` calls from the current print implementation.

### 5. Add/standardize missing return and receipt previews
- Add shared document preview support for Sales Returns and Purchase Returns if missing.
- Add a printable Payment Receipt document action if the page currently only supports WhatsApp/share.
- Ensure all these documents call the same `generateDocumentViews` + `PdfPreviewDialog` path.

### 6. Verify actual UI behavior
After implementation I will test the preview route manually for:
- Sales Order → preview, Save as PDF, Print
- Sales Invoice → preview, Save as PDF, Print
- Delivery Note → preview, Save as PDF, Print
- Purchase Order / Purchase Invoice / Delivery Note
- Sales Return / Purchase Return / Payment Receipt where records exist

Acceptance checks:
- No cut/missing text.
- MRP column/header visible.
- Item rows visible, not hidden behind totals.
- Half-A4 creates one PDF page only.
- Full-A4 works for larger documents.
- Print output uses the same PDF rendering as Save.
- App chrome/sidebar/toolbars are not part of exported/printed document.