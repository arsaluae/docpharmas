# Warranty Invoice — Declaration, Clean PDF, Batch Picker

Three precise fixes scoped to warranty invoices. No other modules touched.

## 1. Declaration not showing on the printed note

Root cause: the declaration renders, but every variable (`{{sales_rep_name}}`, `{{father_name}}`, `{{sales_rep_cnic}}`, `{{agent_license_number}}`, `{{agent_license_expiry}}`, `{{relation}}`) resolves to `__________` whenever the saved invoice has no `sales_agent_id`, or when the linked agent is missing CNIC / license / father name. So the user sees a paragraph of blanks instead of the certified-agent text.

Fixes in `src/lib/pdf-generator.ts` + `src/pages/WarrantyInvoices.tsx`:

- **Make Sales Representative required** in the create form. The Save button is disabled with a tooltip until a rep is picked, so every new warranty note carries an agent.
- **Hard-validate agent profile completeness** before save: name, father name, CNIC, license #, license expiry. Block save with a toast pointing the user to "Sales Agents → edit profile" when anything is missing. The existing amber hint is upgraded to a blocking error pill.
- **Backfill UI for existing invoices without a rep**: when opening the PDF for a legacy warranty note that has `sales_agent_id = null`, prompt the user to assign one before printing (small inline picker on the PDF preview header). The patch updates the saved invoice + reopens the PDF with resolved variables.
- **Stronger fallback in the renderer**: if any variable is still empty after resolving, fall back to a thin underline of fixed width (`____________`) instead of a long string, and keep the bold/inline style so the sentence still reads naturally.
- **Bold the resolved values inline** (name, NIC, license #, expiry, company) so the certificate reads exactly like the sample: "It is certified that I, **UFAQ ISHIAQ** D/O **Ishtiaq Ahmed** having NIC # **3520-28328903-4** being an authorized agent No. **09-341-0157-041722D** valid up to **12-04-2028** on behalf of M/s **MOUJ PHARMACEUTICALS** …".

## 2. Save-as-PDF produces a blank/B&W page

Root cause: `PdfPreviewDialog.handleDownloadPdf` builds a detached, off-screen container at `left: -10000px` and feeds it to `html2pdf`. Two failure modes hit warranty notes:

1. The warranty HTML uses `<div class="page">` (not `.page-frame`), so the regex that strips the toolbar never matches — the toolbar HTML stays in the body and the first page renders as a small grey bar (looks like a blank/B&W sheet).
2. Logo, signature, and stamp images are loaded from Supabase Storage. `html2canvas` snapshots before the images decode → empty boxes / white page. Setting `useCORS: true` alone doesn't await decode.

Rewrite the download path in `src/components/PdfPreviewDialog.tsx`:

- Render the active HTML into a hidden **same-origin iframe** (`<iframe srcdoc>`), wait for `iframe.onload`, then `await Promise.all(images.map(img => img.decode().catch(()=>{})))` so every `<img>` is fully painted before snapshot.
- Run `html2pdf` against `iframe.contentDocument.body` (not a parsed clone) so the browser's layout engine — fonts, flex, grid — is what gets rasterised.
- Drop the toolbar with a CSS rule injected into the iframe (`.toolbar { display:none !important }`) instead of regex-stripping the HTML string. Works for warranty (`.page`) and the older A4 templates (`.page-frame`) without conditional regex.
- Force background colour on `html2canvas` (`backgroundColor: "#ffffff"`) and set `windowWidth: 794` (A4 @ 96dpi) so the snapshot width matches the jsPDF page, eliminating the "tiny content top-left, rest of page blank" symptom.
- Keep `jsPDF` at `unit: "mm", format: "a4", orientation: "portrait"`, `margin: 0`. Use `pagebreak: { mode: ["css", "legacy"] }` so multi-page warranties paginate cleanly.

This same patch fixes Save-as-PDF for sales invoices, proformas, etc. — no per-document work needed.

## 3. Batch picker with auto-expiry on the warranty form

Currently the create form has two free-text inputs (`Batch` and `Expiry`) per line — users have to type the batch and the expiry by hand, and nothing validates that the batch exists for that product.

Replace with a real picker, reusing the existing `getActiveBatches(productId)` helper in `src/lib/batches.ts` (already FEFO-sorted, already merges `grn_items.expiry_date`):

- When a product row is added (or when the dialog opens for editing), call `getActiveBatches(item.product_id)` and cache the result keyed by product id (`Record<string, ActiveBatch[]>`).
- Render the Batch cell as a `SearchableSelect` whose options are `{ value: batch.batch_number, label: "BATCH-123 · on-hand 240 · exp 11-26" }`. Auto-set `item.expiry_date` to the picked batch's `expiry_date` and recompute amount.
- Show an inline warning when the picked batch is `expiring` (≤90 days) or `expired`, so the user knows before printing.
- Keep manual entry as a fallback: if no active batches exist for the product (legacy data), fall back to the current free-text inputs and surface a small hint "No tracked batches — typing manually".
- The expiry input stays read-only when a tracked batch was picked; users hit a "Clear" mini-button to override.

No DB changes — all data comes from `stock_movements` + `grn_items` which the helper already reads.

## Files touched

- `src/lib/pdf-generator.ts` — bold inline resolved values, fixed-width blanks fallback
- `src/components/PdfPreviewDialog.tsx` — iframe-based clean Save-as-PDF, image-decode await, css toolbar hide
- `src/pages/WarrantyInvoices.tsx` — required rep + blocking validation, per-product batch cache, Batch picker via `SearchableSelect`, auto-expiry, "assign rep" prompt on legacy PDFs

## Out of scope

- No schema changes.
- No changes to other PDF templates' content.
- Sandbox/UAT, sales agent role, and the warranty settings UI stay as-is.

## Acceptance

- Creating a new warranty note with a fully-filled sales rep prints the certified-agent paragraph with bold values exactly matching the user's sample.
- Saving with a rep missing CNIC / license / father name is blocked with a clear toast.
- "Save as PDF" downloads a clean coloured A4 PDF with logo, signature, stamp visible — no blank page, no browser URL/timestamp.
- Adding a product in the warranty form shows a Batch dropdown with on-hand quantities; selecting a batch fills expiry automatically.
