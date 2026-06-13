## Goal

All transactional documents render on the **top half of an A4 page** (≈148mm), with the lower half blank. When content exceeds the safe threshold, automatically switch to full-A4 multipage. Preview = Print = PDF, pixel-faithful.

## Scope (document types)

Sales Order, Sales Invoice, Delivery Note, Warranty Note, Sales Return, Purchase Order, Purchase Invoice, Purchase Return, Payment Receipt, Customer Ledger (compact).

All of these flow through two builders:
- `src/lib/pdf-generator.ts` → `buildA4Html` / `buildWarrantyNoteHtml`
- `src/components/PdfPreviewDialog.tsx` (preview + print + PDF download)

One change in those two files reaches every page (`DeliveryNotes`, `ProformaInvoices`, `PurchaseProforma`, `WarrantyInvoices`, `PrintJobs`).

## Design

### 1. New page size mode

Add a `pageMode: "half" | "full" | "auto"` field to `PdfOptions` and `WarrantyNoteOptions`. Default = `"auto"`.

```text
auto:  rows ≤ 5  → half       rows > 5  → full
half:  always half (caller acknowledges overflow risk; we still hard-clip via @page)
full:  current A4 behavior
```

Resolution happens inside the builder using `opts.rows.length` (and `opts.items.length` for warranty). When auto promotes to full, builder also emits a small inline banner:

> "Document exceeds half-page layout. Using full-page format."

### 2. Half-A4 template geometry

Half-page printable target = **190mm × 138mm** (10mm @page margins; 138mm leaves a 1mm safety strip before the fold).

```text
@page { size: A4 portrait; margin: 10mm; }
.half-doc {
  width: 190mm;
  height: 138mm;
  max-height: 138mm;
  overflow: hidden;            /* hard guarantee no spill */
  page-break-after: always;    /* lower half stays blank */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
```

Density adjustments inside `.half-doc` (only when half mode is active):
- Logo max-height 80px → 56px; company info font 14px → 11px
- Title block padding 16px → 6px; underline accent shrinks
- Doc-info / party card padding 14/16 → 6/10; font 15px → 11px
- Items table row padding 10px → 5px; font 15px → 10.5px; header 14px → 10px
- Totals card width 380px → 260px; grand-total font 30px → 18px
- Amount-in-words / notes / bank / footer-cert collapse to single 9.5pt lines (or omit when missing)
- Signatures top-margin 42px → 14px, line height 36 → 18

Columns auto-trim in half mode: drop optional `mrp_inc_tax`, `discount_pct`, and tax columns when their values are all empty, to keep the table readable.

### 3. Warranty Note half mode

`buildWarrantyNoteHtml` already uses 190mm container. Add a `compact` variant:
- Drop description column, narrow Sr/Batch
- Warranty declaration: render as a single justified paragraph (joined clauses) at 8pt
- Signature block collapses to a single row
- If declaration text length × items > budget, fall back to full A4 with the banner

### 4. PdfPreviewDialog — same surface for preview / print / download

Add an HTML hint the builder emits on the root: `<html data-page-mode="half">`. The dialog reads it and:

- **Preview iframe**: wraps the document in a CSS shell that paints a full A4 sheet (210×297mm) with the half-doc anchored to the top; lower half is visibly blank so the user sees print truth.
- **Print** (`handlePrint`): the same HTML opens in a new tab; `@page A4 portrait + margin 10mm` plus `.half-doc { height: 138mm; overflow: hidden; page-break-after: always; }` keep content in the top half. No browser-side scaling — content is already sized in mm.
- **Download** (`handleDownloadPdf`): switch from "capture body, paginate by canvas height" to **fixed A4-page snapshot**:
  - Render iframe at `794 × 1123 px` (A4 @96dpi).
  - In half mode, force the iframe body min-height to 1123 so the lower half is captured as white.
  - Use `html2pdf` with `pagebreak: { mode: ['css'], before: '.html2pdf__page-break' }` and have the builder insert a `<div class="html2pdf__page-break"></div>` after `.half-doc` only when more than one half-doc is rendered (e.g., future batch printing). For single-doc half mode, no page break needed — content fits.
  - `jsPDF.margin: 0` (margins live inside the HTML via `@page` + `.half-doc` positioning).
  - This guarantees PDF page count = HTML page count and preview = PDF.

### 5. New setting: Documents → Print Size

Add to `company_settings` (already has 36 columns):
- `document_page_mode TEXT NOT NULL DEFAULT 'auto'` — `'half' | 'full' | 'auto'`

UI: Settings → Documents tab adds a radio group:
```
Document Print Size
  ○ Half A4 (Default for short docs)
  ● Auto  — ≤5 items half, >5 items full
  ○ Full A4
```

All call sites pass `pageMode: settings?.document_page_mode ?? 'auto'` into `generatePdfHtml` / warranty builder. No per-call wiring beyond that one prop.

### 6. Smart-switch threshold

Constant `HALF_PAGE_ROW_LIMIT = 5` in `pdf-generator.ts`. Warranty uses `HALF_PAGE_WARRANTY_LIMIT = 4` (declaration eats space).

When auto promotes to full, builder logs to console + renders the banner; no toast (preview already shows result).

## Testing plan

For each row count {1, 3, 5, 6, 10} on Sales Invoice (representative) + Warranty Note:
1. Open Preview → confirm A4 sheet with content in top half, lower half blank
2. Click Print → use Chrome's Save-as-PDF; compare to preview screenshot
3. Click Save as PDF → open output; verify
   - PDF page is A4
   - Content sits in top half only
   - Totals visible, signatures visible
   - No clipping at the 138mm fold
4. Repeat with setting forced to `half` then `full` to verify override

QA harness: render the iframe HTML to a 794×1123 canvas (already in download flow) and assert non-white pixels are 0 below y=560px (half-fold) when pageMode resolves to half.

## Files touched

- `src/lib/pdf-generator.ts` — `PdfOptions.pageMode`, `WarrantyNoteOptions.pageMode`, half-mode CSS branches, smart-switch logic, banner
- `src/components/PdfPreviewDialog.tsx` — read `data-page-mode`, A4-sheet preview shell, simplified fixed-page PDF capture
- `src/pages/Settings.tsx` — Documents tab radio for `document_page_mode`
- `src/hooks/useCompanySettings.ts` — type addition (no logic change)
- Migration: `ALTER TABLE company_settings ADD COLUMN document_page_mode TEXT NOT NULL DEFAULT 'auto'`
- Call sites (one-liner each): `DeliveryNotes.tsx`, `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `WarrantyInvoices.tsx`, `PrintJobs.tsx` — pass `pageMode` from settings

No layout redesign, no changes to fields or columns shown.

## Acceptance checklist

- Preview, Print, PDF all show identical top-half-only output
- Lower half remains blank (verified pixel-wise)
- Totals + signatures stay inside the top half in half mode
- >5-item docs auto-promote to full A4 with banner
- Setting respected (Half / Full / Auto)
- All 9 document types behave identically (single pipeline)
