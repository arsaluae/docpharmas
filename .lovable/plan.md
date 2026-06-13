# Document Polish + Clean Print Preview + Draft Autosave

Targets all 11 transactional documents through the single pipeline (`pdf-generator.ts` + `PdfPreviewDialog.tsx`) plus a new standalone route. Logo is currently sized at `max-height:210px` (per code) but renders small because the layout cell is narrow — that's a CSS issue, fixed below.

## Part 1 — Template polish (`src/lib/pdf-generator.ts`)

**Header**
- Widen logo cell to `min-width:280px` and bump logo to `max-height:120px; max-width:300px` (~220% of the visually-rendered size). Half-A4 override stays at `max-height:64px`.
- Keep flex layout: logo left, company block right; both `vertical-align:top`.

**Customer / Supplier block**
- Always render Code, Phone, Mobile, City, Address (currently mobile/phone hidden when `show_customer_phone_on_docs=false`). Override that flag for invoice family — phone/mobile required by spec.
- Order: **Name** (16px bold) → **Code · City** (13px muted) → **Phone / Mobile** (13px) → **Address** (13px, wraps).

**Typography (full-A4 mode)**
- Title 22px, party name 16px, party details 13.5px, table head 12.5px, table row 12.5px, grand total 26px.
- Global `line-height:1.3`, `word-break:break-word`, remove every `overflow:hidden`/fixed-height on text cells.

**Items table (all documents)**
- Fixed `table-layout:fixed` with explicit `<colgroup>`:
  - Sales/Purchase Invoice: SR 4% · Product 34% · Batch 10% · Expiry 9% · Qty 7% · Rate 10% · Amount 12% · MRP 14%
  - Delivery Note: SR 5% · Product 55% · Batch 15% · Expiry 12% · Qty 13% (fixes the giant gap in screenshot #2)
- `text-align`: SR/Qty/Rate/Amount/MRP right, Batch/Expiry center, Product left with `white-space:normal`.

## Part 2 — Half-A4 / page-break hardening

Existing `pageMode` setting stays. Tighten:
- Add `.page-frame { page-break-after: avoid; }` and `.half-doc { page-break-after: avoid; }` so a trailing empty page never spawns.
- Remove the bottom 36px margin on `.page-frame` (currently `margin:64px auto 36px`) — that's the most common cause of the spurious 2nd PDF page. Use `margin:0 auto`.
- `box-sizing:border-box` on `html, body, .page-frame, .warranty-document, table, td, th`.
- Auto threshold unchanged (≤5 rows → half).

## Part 3 — Clean print route

New file **`src/pages/PrintPreview.tsx`** at route `/print-preview/:docType/:docId` (registered in `App.tsx` outside `AppLayout` — no sidebar/topbar).

Layout:
```
┌─ minimal toolbar (no-print): [← Back] [Print] [Download PDF]  ┐
│ banner (no-print): "For clean print, disable browser          │
│ Headers/Footers in print settings (Chrome → More settings)."  │
├───────────────────────────────────────────────────────────────┤
│ <iframe srcDoc={html}> rendered via same `generatePdfHtml`    │
└───────────────────────────────────────────────────────────────┘
```

- `docType` ∈ `sales-order | sales-invoice | delivery-note | warranty-note | sales-return | purchase-order | purchase-invoice | purchase-return | payment-receipt | customer-ledger | supplier-ledger`.
- Fetches the document + items + party using the same queries the list pages use (extracted into `src/lib/print-fetchers.ts`).
- Sets `document.title = "<DOC_NO> — <PARTY>"` so browser print filename is clean.
- `@media print` hides toolbar + banner, leaves only the document.

## Part 4 — Save as PDF flow

**`PdfPreviewDialog`** "Save as PDF" button changes from in-place html2pdf snapshot → `window.open('/print-preview/<type>/<id>?action=download', '_blank')`. The new route, on `?action=download`, runs the existing html2pdf path on its own clean iframe and triggers download. Print button same pattern with `?action=print`.

In-modal preview keeps current behaviour (so users still get instant preview), but the heavy capture moves to the clean route → preview = print = PDF (same HTML generator, same iframe sandbox).

## Part 5 — PDF engine

Keep `html2pdf.js` (already wired). Improvements:
- Capture target = `.page-frame` (or `.warranty-document`), not `body`, so no surrounding chrome contributes height.
- `html2canvas.scale: 2`, `windowWidth: 794` for full-A4, `794×1123` fixed for half.
- `pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '[data-pdf-section]', '.no-break', '.totals-card', '.signatures'] }`.
- `jsPDF.margin: [8,8,8,8]` full / `0` half.

## Part 6 — Form autosave

Reuse existing `useDraftAutosave` hook (already present, localStorage-backed, 1s debounce).

Wire into the five create/edit dialogs:
- `ProformaInvoices.tsx` (Sales Order + Sales Invoice tabs use same dialog state)
- `DeliveryNotes.tsx`
- `WarrantyInvoices.tsx`
- `PurchaseProforma.tsx` (Purchase Order + Purchase Invoice)

For each:
1. `useDraftAutosave({ key: 'sales-order:new' | 'sales-invoice:<id>' | ..., enabled: dialogOpen && !submitting })`.
2. On every form-state change → `save(formState)` (debounced).
3. On dialog open + new doc, if `existingDraft` → show `Alert` banner: *"Unsaved draft from {relative time} restored."* with **Discard** button → `clear()`.
4. On successful submit → `clear()`.
5. Add `window.beforeunload` listener while dialog has dirty state → native confirm.

**Database draft table** (cross-browser restore):

```sql
CREATE TABLE public.document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,         -- 'sales_order' | 'sales_invoice' | ...
  document_id uuid,                    -- null for new docs
  draft_data jsonb NOT NULL,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, document_type, document_id)
);
-- GRANT + RLS scoped to auth.uid() + get_user_tenant_id()
```

Autosave writes to both localStorage (instant) and `document_drafts` (every 5s via debounced upsert). Restore prefers DB draft when newer than local.

## Part 7 — Document numbering

No change needed — current `generate_document_number` RPC is only called inside `submit` paths, drafts never consume numbers. Draft UI shows `DRAFT-####` placeholder until submitted.

## Part 8 — QA

After implementation, render the iframe HTML into a 794×1123 canvas (existing path) for: Sales Order (1, 5, 6 items), Sales Invoice with long product name + long address, Delivery Note (5 items), Warranty Note (declaration). Assert:
- Half mode: bottom half pixel-blank below y=560
- Full mode: no orphan page (last page height > 80px content)
- Phone number rendered in party block
- Logo natural height ≥ 96px in canvas

## Files

**New**
- `src/pages/PrintPreview.tsx`
- `src/lib/print-fetchers.ts`
- Migration: `document_drafts` table + RLS + GRANT

**Edited**
- `src/lib/pdf-generator.ts` — header, party block, table colgroups, margin fix, page-break guards
- `src/components/PdfPreviewDialog.tsx` — Save as PDF / Print buttons open `/print-preview/...` in new tab
- `src/App.tsx` — register `/print-preview/:docType/:docId` outside `AppLayout`
- `src/pages/ProformaInvoices.tsx`, `DeliveryNotes.tsx`, `WarrantyInvoices.tsx`, `PurchaseProforma.tsx` — wire `useDraftAutosave` + beforeunload + restore banner

No business logic changes (stock posting, ledger, totals untouched).
