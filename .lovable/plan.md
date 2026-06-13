# Fix Edit Order dialog + MRP column placement

## What's actually wrong

Audited the proforma module (`src/pages/ProformaInvoices.tsx`) and the PDF templates (`src/lib/pdf-generator.ts`).

**1. The "wrong calculation" is actually a cramped UI, not a math bug.**
`calcTotals()` (line 407) computes:
- `gross = qty × rate`
- `lineAfterDisc = gross − (gross × disc%)`
- `line total = lineAfterDisc + (lineAfterDisc × gst%)` when GST is on
- MRP is **not used anywhere** in any total. Correct.

The Edit Order dialog (lines 1670–1730) uses a 12‑col grid where Qty and Disc% are each `col-span-1` (≈40 px). On a 672 px dialog they collapse to *just the spinner arrows* — the value is invisible. So the screenshot showing `190 · ▲▼ · 45 · ▲▼ · 2,250` is really `MRP 190 · Qty 50 · Rate 45 · Disc 0 · Amount 2,250` (50 × 45 = 2,250 — correct). The Edit dialog also has **no GST% column** even when GST is enabled, so the row total looks "off" vs. the printed PDF.

**2. MRP column is in the middle on every invoice template**, not at the end. User wants Qty → Rate → … → MRP last, and MRP labelled as a reference figure, never in calculations.

**3. Edit Order dialog is `max-w-2xl` with a small title** — should match the Create Order dialog (`max-w-[1400px] h-[92vh]`, big "SALES ORDER" heading).

## Changes

### A. `src/pages/ProformaInvoices.tsx` — Edit Order dialog (lines 1670–1730)
- Switch `DialogContent` to `className="w-[95vw] max-w-[1400px] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg"`.
- Add the same sectioned header used by Create ("Edit Sales Order · SO‑####" + customer/date summary chip), with a scrollable body and a sticky footer holding Cancel / Save.
- Replace the cramped 12‑col row with the same desktop table grid as Create: `grid-cols-[32px_minmax(260px,1fr)_80px_100px_80px_80px_100px_140px_40px]` with header row.
- **Column order (new, both Create + Edit):** `# · Product · Qty · Rate · Disc % · GST % (if enabled) · MRP · Line Total · ✕`. MRP moves to just before Line Total. Add a tiny helper caption under the table: *"MRP is a reference figure (printed on pack). It is not used in line totals."*
- Add the missing **GST %** input in Edit when `settings.gst_enabled`, so the calc shown in the dialog matches the PDF.
- Show the same Subtotal / GST / Total summary block Create uses (currently Edit only shows Subtotal + Total).

### B. `src/pages/ProformaInvoices.tsx` — Create Order desktop table (lines 1266–1319)
- Reorder header cells and row cells so MRP appears between Disc%/GST% and Line Total (matches Edit and PDF).
- Update mobile card (lines 1326+) to render MRP after Rate/Disc.

### C. `src/pages/ProformaInvoices.tsx` — PDF column order (3 builders)
For `buildSalesOrderHtml` (≈638), `buildSalesInvoiceHtml` (≈738), `buildDeliveryNoteHtml` (≈810), move the `{ header: "MRP", key: "mrp" }` column so the order becomes:
- Sales Order: `# · Product · Qty · Rate · Disc% · GST% · MRP · Amount`
- Sales Invoice: `# · Product · Batch # · Expiry · Qty · Rate · MRP · Amount`
- Delivery Note: `# · Product · Batch # · Expiry · Qty · MRP`

### D. `src/lib/pdf-generator.ts` — Warranty Note table (lines 518–528)
Already has MRP last — keep as is. No change.

### E. Calculation audit (no code change, just confirmation)
Verified `calcTotals` is correct and MRP is excluded. The only math touch‑up: in **Edit**, after a product is picked, also call `updateEditItem(idx, "quantity", ...)` recompute path so changing GST% recalculates `item.amount` (the GST input is being added in step A, so this just means routing it through the existing `updateEditItem` switch — which already handles `gst_rate`).

## Out of scope
- Sales Invoice list, Warranty Invoices, Purchase forms — not mentioned by the user. (MRP is already last in Warranty PDF.)
- Backend schema, RLS, triggers — none affected.
