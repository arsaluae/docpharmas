## Goal
Rebuild the document PDF/print pipeline so the downloaded file looks premium, fits A4 cleanly, and matches the on-screen preview exactly. Apply to Sales Order, Sales Invoice, Delivery Note, Proforma, GRN, PO, Returns, Warranty.

## Root causes of current issues
- Watermark `<span>` rendered before logo creates the faded "Mouj Pharmaceuticals" ghost text at the top.
- Logo capped at 64px and right block is bold/large → header looks unbalanced, lots of vertical air.
- Customer block uses padded card with big fonts → eats half the page.
- Table column widths are loose → "BATCH N", "QUAN1", "MRP INC. TAX" headers clip and Qty visually merges with Expiry.
- `.page-frame { overflow:hidden }` plus dialog scaling causes totals to feel pushed/cut.
- html2pdf snapshots the full sheet at screen scale → A4 mapping is approximate; alignment between preview and PDF drifts.

## Plan

### 1. Header (compact, ≤90px)
- Logo top-left, `height:auto; max-height:56px; max-width:150px`. No min-height wrapper.
- Company block top-right: name 22px bold, address/phone/email 12px, line-height 1.4.
- Single flex row, `align-items:center`, `padding-bottom:8px`, hairline divider.
- Remove all top page padding above the row (≤6mm).

### 2. Watermark — make it invisible/ghost-free
- Drop the centered text watermark entirely (it's what shows as the faint "Mouj Pharmaceuticals" at top in the PDF). Replace with an extremely faint diagonal repeating logo mark only when `logo_url` exists, opacity `0.04`, behind content, NOT in header bounds.
- If user prefers no watermark at all → remove the watermark layer.

### 3. Title
- "SALES INVOICE" centered, 22px bold, 6px top margin, tiny 60px blue underline. Sits directly under header divider.

### 4. Document + Customer two-column
- Left column (40%): Document #, Date, Sales Agent, Payment Terms — rows 13px, label muted, value bold.
- Right column (60%): Customer card — padding 10px 12px, name 15px bold, phone 13px, city/area 13px, address 12px muted. Always render phone when present (currently sometimes omitted).
- Card height auto, no fixed min-height.

### 5. Items table (fixed widths)
- `table-layout:fixed; border-collapse:collapse; width:100%`.
- Columns: Sr 7%, Product 32%, Batch 12%, Expiry 11%, Qty 8%, Rate 9%, Amount 13%, MRP 8%.
- Header 12px bold uppercase, `white-space:normal; line-height:1.15` so "MRP Inc. Tax" wraps cleanly.
- Cell 12.5px, row padding 7px 8px, `word-break:break-word; overflow-wrap:anywhere`.
- Numeric cols right-aligned tabular-nums; Batch/Expiry centered; Product left.
- Delivery Note keeps its leaner column preset; other docs use document-aware presets already in `useDocumentTemplates`.

### 6. Totals
- Right-aligned card directly under table, width ~45%, 8px gap from table.
- Rows: Subtotal, Discount (if >0), Tax (if >0), Grand Total.
- Grand Total: 20px bold, "PKR" prefix, top hairline border.

### 7. Amount in words
- Single line under totals card, 12px italic muted: `Amount in Words: …`.

### 8. Half-A4 logic
- Delivery Note + small invoices: render in top-half (148mm) via the existing half-page transformer, but keep `overflow:visible` so totals are never clipped.
- If measured content height > 138mm, auto-promote to full A4 in `PdfPreviewDialog.buildPdf` (already partially in place; finish the auto-promote branch and stop deleting pages blindly).
- Hard guarantee: no blank second page.

### 9. Clean print route + isolated export
- Add route `/print-preview/:docType/:docId` rendered by a new `PrintPreviewPage` that:
  - Loads the document via the same fetch helpers already used by `ProformaInvoices`/`SalesInvoicesList`.
  - Renders ONLY the print HTML (no `AppLayout`, no sidebar). White body, `.print-document` wrapper, no toolbar.
- `PdfPreviewDialog`'s Download/Print buttons:
  - Open `/print-preview/...?auto=pdf` (download) or `?auto=print` (print) in a new tab.
  - The page generates the PDF from its own DOM (html2pdf), so preview = PDF byte-for-byte. Removes any app chrome from the snapshot.
- Keep in-app dialog preview for quick view, but the actual export always goes through the clean route.

### 10. Global print CSS
```css
@page { size: A4 portrait; margin: 8mm; }
.print-document { width:190mm; max-width:190mm; margin:0 auto; background:#fff; color:#111827; }
@media print {
  body { margin:0; background:#fff; }
  .no-print { display:none !important; }
  table { width:100%; table-layout:fixed; border-collapse:collapse; }
  td, th { word-break:break-word; overflow-wrap:anywhere; }
}
```

### 11. Files to change
- `src/lib/pdf-generator.ts` — header, watermark removal, table presets, totals, amount-in-words, half-page overflow fix.
- `src/components/PdfPreviewDialog.tsx` — route open vs blob; auto-promote half→full; keep blob fallback.
- `src/App.tsx` — add `/print-preview/:docType/:docId` route (no `AppLayout`).
- New: `src/pages/PrintPreview.tsx` — fetches doc, renders pdf-generator HTML in a clean shell, auto-triggers download/print on query flag.

### 12. QA checklist (must pass)
- Sales Invoice with 1, 3, 5 items → single page, totals visible, no ghost text, phone shows.
- Long product name + long address → wraps, no column merge.
- Delivery Note 1–5 items → top half A4, blank lower half, no 2nd page.
- Delivery Note 12 items → auto promotes to full A4.
- Save as PDF and Print produce byte-identical output to the new clean preview tab.
- Logo prominent (≥56px), header ≤90px tall, no extra top whitespace.

## Confirmations needed
1. **Watermark**: drop entirely, or keep only as a very faint corner logo mark (not behind content)?
2. **Clean print route**: OK to add `/print-preview/:docType/:docId` and make Download/Print open it in a new tab (instead of generating PDF inside the dialog)? This is the only reliable way to guarantee "preview matches PDF exactly".