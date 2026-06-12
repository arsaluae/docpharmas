# Warranty Note — Layout, PDF, Settings & Validation Overhaul

Treat the Warranty Note as a compliance document, not a sales invoice. Replace the bespoke warranty HTML with a paginated, print-CSS-driven A4 template; remove sales/financial KPIs from the page; restore the editable declaration in Settings; and add admin toggles for required fields with hard validation before download.

## 1. Database — admin toggles + editable declaration

Single migration adding columns to `company_settings` (all default sensible). No new tables.

```text
warranty_declaration_text          text       -- editable template (seed with current MOUJ text)
warranty_require_mobile            boolean    default true
warranty_require_address           boolean    default true
warranty_require_license_no        boolean    default true
warranty_require_license_expiry    boolean    default true
warranty_require_batch_number      boolean    default true
warranty_require_batch_expiry      boolean    default true
```

(`warranty_note_text` and `warranty_declaration_enabled` already exist — reuse `warranty_note_text` as the editable body; the rename column above is only added if missing. No backfill needed beyond seeding `warranty_note_text` with the MOUJ template for tenants where it is null.)

## 2. `src/lib/warranty-declaration.ts` — back to a default constant

- Keep `WARRANTY_NOTE_TEXT` exported as the **default seed** only.
- PDF renderer reads from `settings.warranty_note_text` and falls back to the constant if empty.
- No `{{...}}` token replacement. Plain text with paragraph + numbered-list rendering.

## 3. PDF engine — paginated A4, no screenshot cropping

Refactor `generateWarrantyNoteHtml` in `src/lib/pdf-generator.ts` to a **flow layout** that the existing `PdfPreviewDialog` iframe + `html2pdf.js` pipeline paginates automatically. Keep the iframe/decode/save pipeline (it already works for the Sales Invoice path).

Key changes to the warranty HTML builder only:

- `@page { size: A4 portrait; margin: 10mm; }` and the `@media print` block from the brief, dropped into the document head.
- Root wrapper `.warranty-document` with `width:190mm; margin:0 auto; box-sizing:border-box; overflow:visible;` — no fixed heights, no `transform: scale`, no absolute positioning for sections.
- Sections wrapped in `<section data-pdf-section="...">` divs (`header`, `title`, `details`, `products`, `totals`, `declaration`, `words`, `signatures`, `footer`).
- `.no-break` on declaration, totals card, signature block, words block.
- Product table:
    - `table-layout: fixed; width: 100%; border-collapse: collapse;`
    - `<thead>` with `display: table-header-group` so it repeats on every printed page.
    - Column widths exactly as specified: Sr 7 / Name 18 / Desc 22 / Qty 8 / Rate 8 / Batch 9 / Expiry 9 / Disc 7 / Amount 8 / MRP 8.
    - `<tr>` gets `page-break-inside: avoid`.
    - Numeric columns right-aligned, Qty/Batch/Expiry centered, name+desc `word-break: break-word; white-space: normal;`.
- Font sizes per spec (header 9.5–10.5pt, body 9–10pt, declaration 9.5–10.5pt, title 18–22pt, company 20–24pt). All in `pt` so they scale identically in print and html2canvas at scale 2.
- Footer: single `.warranty-footer` block at end of flow — no fixed positioning, so it never overlaps content; reads "This is a system generated document and does not require any signatures." plus tenant footer text.
- Page number rendered via `@page` CSS counter (Chrome/Edge honour this in iframe print path; html2pdf paginates the canvas — page number is omitted in canvas output and added by jsPDF `addPage` callback as `Page X of Y` in bottom-right margin).

### Sections rendered (matches Part 3 of brief)

1. **Header** — logo left, company name/address/mobile/NTN right.
2. **Title** — centered "WARRANTY NOTE", indigo accent rule under it.
3. **Details grid** — 2-column 50/50:
    - Left: Mobile, Warranty Address, Licence No, Licence Valid Up To, NTN, CNIC.
    - Right: Warranty Note No, Date, Due Date, Created By. (Sales Rep removed per prior decision.)
4. **Product table** — Sr / Name / Description / Qty / Rate / Batch / Expiry / Disc / Amount / MRP Inc Tax.
5. **Totals** — single "Total: Rs. X" line, right-aligned, no GST/discount KPIs.
6. **Declaration** — from `settings.warranty_note_text`, paragraph + numbered-list rendering, justified, 9.5pt, hanging indent.
7. **Total in Words** + **Invoice Balance in Words**.
8. **Signature area** — "Prepared By" + optional "Stamp" placeholders; no Sales Rep line.
9. **Footer** — system-generated note + page number.

## 4. `src/pages/WarrantyInvoices.tsx` — UI cleanup + validation

- **Remove** the KPI strip (Total Value, Issued Count) and any financial summary cards.
- **Rename** UI labels:
    - Page title → "Warranty Notes"
    - "Pharmacy" fields → "Warranty Address" / "Warranty Distributor"
    - Items section heading → "Warranty Products"
    - Notes panel → "Warranty Declaration (preview)"
- **List columns** (table on the index page): Warranty Note #, Date, Customer, Distributor, Products count, Status, actions (Download, Print, Edit, Delete). Drop the "Total" column from the listing — keep total only on the PDF if `total > 0`.
- **Edit dialog fields to show** (per brief Part 1): warranty note number, date, customer, customer mobile (read-only chip), warranty address (read-only chip from selected distributor), licence number, licence expiry, created by (current user, read-only), product count, total warranty amount.
- **Pre-download validation** — new `validateWarrantyForPdf(inv, settings)` helper. Reads the `warranty_require_*` flags; if any required field is missing, shows a `toast.error` with a bullet list and aborts the PDF open. Hard-blocks Download PDF + Print; soft-warns on Save (lets user save a draft but flags it).
- `buildWarrantyOpts` extended to pass `customerMobile`, `customerNtn`, `customerCnic`, `createdBy` (resolve from `profiles` by `created_by` user_id, fall back to "—").

## 5. `src/pages/Settings.tsx` — restore editable declaration + new toggles

In Settings → Documents:

- Replace the read-only preview card with a `<Textarea>` bound to `warranty_note_text` (8 rows, monospace not required). Helper text: "Plain text. Use blank lines to separate paragraphs. Numbered lines starting with `1.` `2.` render as a hanging-indent list on the PDF."
- New card **"Warranty Required Fields"** with 6 `<Switch>` rows mapped to the 6 `warranty_require_*` columns. Save via existing `company_settings` upsert.
- Remove the variable-token helper UI entirely.

## 6. QA checklist (run before marking complete)

Manual walkthrough on the preview against the 13 test cases in Part 8: 1-row, 5-row, 15-row, long address, long product description, missing licence, missing mobile, download PDF, print, preview-vs-download diff, declaration wrapping, multi-page. Expected results from Part 10 (no crop, no overlap, table fits, multi-page header repeats, footer doesn't overlap, logo undistorted).

## Files touched

- `supabase/migrations/<new>.sql` — add columns to `company_settings`.
- `src/hooks/useCompanySettings.tsx` — extend interface with the 6 toggles + `warranty_note_text` (already present).
- `src/lib/warranty-declaration.ts` — keep constant as fallback only.
- `src/lib/pdf-generator.ts` — rewrite `generateWarrantyNoteHtml` + `generateWarrantyNoteViews`; read declaration from settings; new paginated CSS; sections; fixed table layout.
- `src/pages/WarrantyInvoices.tsx` — strip KPIs, rename labels, add validation, extend buildWarrantyOpts.
- `src/pages/Settings.tsx` — editable declaration textarea + required-fields toggles card.
- `src/components/PdfPreviewDialog.tsx` — small tweak: pass `pagebreak: { mode: ['css','legacy','avoid-all'] }` and add a tiny jsPDF page-number callback for "Page X of Y" in the bottom margin. No structural change.

## Out of scope

- No changes to other PDF templates (Sales Invoice, PO, DN, GRN).
- No changes to the batch picker / `getActiveBatches` (already shipped).
- No changes to `warranty_invoices` schema (only `company_settings`).
- No new role/permission changes.

## Acceptance

- Warranty Notes page shows zero sales/financial KPIs.
- Settings → Documents has an editable declaration textarea + 6 required-field switches.
- Download PDF and Print produce identical, paginated A4 output with no right/bottom cropping, repeated table headers across pages, wrapping addresses/descriptions/declaration, and no overlapping footer/signature.
- File name is `Warranty-Note-{number}-{customer}.pdf`.
- All 13 QA cases pass.
