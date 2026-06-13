## Goals

1. Remove the "Validity" row from the Sales Order / Sales Invoice document.
2. Make the logo ~1.5× larger in all document templates.
3. Delivery Note: tighten Product Name ↔ Batch No spacing, eliminate large whitespace at the bottom, fix preview/print misalignment.
4. Print / Save-as-PDF for Delivery Note: auto-pick **A5 (single)** when items are few, **A4 (single)** when many, and offer a **"2-up on A4"** mode so two delivery notes print on one A4 sheet (day-end batching).
5. Fix Sales Order create dialog losing data when user switches browser tab and comes back.

## Changes

### 1. Sales Invoice / Sales Order — remove Validity
- `src/pages/ProformaInvoices.tsx` line 651 — drop the `validity: \`Valid for ${order.validity_days} days\`` field passed to the PDF generator (keep `validity_days` in DB / form for internal expiry logic, just stop printing it).
- `src/lib/pdf-generator.ts` — keep the `validity` option but no callers will pass it; the row simply won't render.

### 2. Logo size × 1.5
- `src/lib/pdf-generator.ts`:
  - Legacy template (`.page-frame img` rule, line 452): `height: 90px → 135px`, `max-width: 240px → 360px`.
  - New A4 template logo (line 624): `width:200px → 300px`, `max-width:220px → 330px`, `max-height:140px → 200px`.
- Applies uniformly to Sales Order, Sales Invoice, Delivery Note, Warranty Note headers.

### 3. Delivery Note layout fixes
In the Delivery Note template block of `src/lib/pdf-generator.ts`:
- Tighten the product table: reduce the empty column gap between **Product Name** and **Batch No** by changing column widths so Product Name no longer spans 55% — distribute as `SR 6% · Product 44% · Batch 16% · Expiry 14% · Qty 12% · (rest)`.
- Remove forced minimum row heights and bottom padding that produce the long blank tail.
- Wrap the document body in a sized `.delivery-note` container so the preview iframe and the printed PDF render identically (no overflow, no large white gap before Dispatched/Received).

### 4. Delivery Note PDF — A5 / A4 / 2-up
`src/components/PdfPreviewDialog.tsx` already builds the PDF with html2pdf/jsPDF. Add Delivery-Note-aware sizing:

- Detect the doc kind from a new `data-doc-kind="delivery-note"` attribute on the root `.page`.
- Compute item count from `tr[data-row="item"]` count (added in the template).
- Sizing rule:
  - `≤ 8 items` → **A5 portrait, single page**.
  - `> 8 items` → **A4 portrait, single page** (existing behaviour).
- Add a third pill button next to Print / Save-as-PDF: **"2 per A4"**. When clicked, render the same delivery-note HTML twice stacked into a single A4 sheet (top half + bottom half separated by a cut line). Uses the existing iframe rendering pipeline, just changes the jsPDF `format` and stacks the sheet element twice via html2canvas before `addImage`.
- Section-aware page-break logic from the reference snippet (`data-pdf-section`, `avoid-all` for small docs) is applied so nothing is split mid-row.

### 5. Sales Order draft restore on tab return
`src/pages/ProformaInvoices.tsx`:
- The autosave hook already persists to localStorage but the **restore prompt** only shows when `items.length === 0 && !customerId` (line 1166). That hides the draft as soon as the user has typed anything, and on dialog close the in-memory state is wiped.
- Fix:
  - Auto-rehydrate the form state from `existingDraft` on dialog open (one-shot) instead of waiting for the user to click "Restore".
  - Keep autosaving while the dialog is open (already works) **and** on `visibilitychange` / `beforeunload` so a fresh tab switch always flushes the latest values.
  - Only `clearDraft()` after a successful save, not on dialog close.

## Files to edit
- `src/pages/ProformaInvoices.tsx` — remove validity from PDF payload, auto-rehydrate draft, flush on visibilitychange.
- `src/lib/pdf-generator.ts` — logo sizing, delivery-note column widths, remove trailing whitespace, add `data-doc-kind` + `data-row="item"` hooks.
- `src/components/PdfPreviewDialog.tsx` — A5/A4 auto-detect for delivery notes, new "2 per A4" action.

## Acceptance
- Sales Order / Sales Invoice PDF and preview no longer show "Validity: Valid for N days".
- Logo visually ~1.5× larger on all three document tabs.
- Delivery Note: Product Name and Batch No sit close together, no large empty band before the signatures, single A5 page for short notes, single A4 for long notes, and **2 per A4** stacks two notes on one sheet.
- Preview iframe matches the saved/printed PDF exactly (no clipping, no extra whitespace).
- Opening "Add Sales Order", typing a customer/items, switching browser tab, and returning restores all entered data automatically without showing an empty form.
