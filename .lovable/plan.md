## Goal
Tighten the document header and make Save-as-PDF feel professional with a subtle watermark behind content. Apply across Sales Order, Sales Invoice, Delivery Note, Purchase Order, GRN, Returns, Proforma, Warranty.

## Changes (all in `src/lib/pdf-generator.ts`, single shared template)

### 1. Header: logo inline with company text
- Replace the current two-column block (logo left, big empty gap, company right) with a single flex row:
  - Left: logo (height ~64px full / ~52px half), vertically centered.
  - Right: company name (bold, 20–22pt) + address/phone/email stacked, right-aligned, vertically centered to logo.
  - Thin divider directly under the row.
- Remove the large top padding/margin on `.page-frame` and the empty space above the logo. Top padding becomes ~10mm (full) / ~6mm (half).
- If `logo_url` missing, only the company text block renders (no empty left column reserving space).

### 2. Remove white space above header
- Drop the current header wrapper's `margin-top` and any spacer divs.
- Page padding tuned so the brand row sits near the top edge with ~8mm breathing room.

### 3. Professional watermark behind content
- Add a fixed, centered watermark element behind the sheet content:
  - Diagonal "MOUJ PHARMACEUTICALS" text, very light grey (e.g. `rgba(15,23,42,0.05)`), letter-spaced, ~80pt, rotated -28deg.
  - Positioned absolutely inside `.page-frame`, `z-index:0`; all real content `position:relative; z-index:1`.
  - Single watermark per page (no tiling) to keep it clean and professional.
  - Applies only when `logo_url`/brand exists; uses company display name.
- Watermark renders in PDF because html2canvas captures the sheet; verify with a render pass.

### 4. Apply uniformly
- All document types share `pdf-generator.ts` template, so Sales Order, Sales Invoice, Delivery Note, Purchase Order, GRN, Sales Return, Purchase Return, Proforma, Warranty all inherit the new header + watermark automatically.
- Warranty template (`.warranty-document` / `.page`) gets the same header treatment and watermark wrapper.

### 5. Verify
- Open `/proforma`, preview Sales Order, Sales Invoice, Delivery Note. Confirm:
  - Logo inline with company text, no top whitespace.
  - Watermark visible but subtle, doesn't interfere with reading.
  - Save as PDF and Print produce identical, single-page (half-A4 where applicable) output.
- Check Purchase Order, GRN, Sales Return, Purchase Return, Warranty.

## Out of scope
- No changes to table columns, totals math, or business logic.
- No new dependencies.
