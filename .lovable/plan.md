## Goal

Redesign every transactional document (Sales Order/Proforma, Sales Invoice, Delivery Note, Sales Return, Purchase Order, Purchase Invoice, GRN, Warranty) so it looks like a premium pharma distributor invoice (Unilever/Nestlé distributor style) — fully readable on A4 print, PDF download, mobile, and WhatsApp screenshot.

All work is centralized in `src/lib/pdf-generator.ts` + callers. No DB changes.

---

## 1. Extend `PdfOptions` (backward compatible — all new fields optional)

New party fields:
- `partyCode` (Customer/Supplier code e.g. `CUS-0042`)
- `partyMobile` (separate from phone, shown prominently)
- `partyCity`
- `partyAccountCode` (chart-of-accounts code)

New document fields (rendered in meta strip):
- `salesAgentName`, `salesAgentMobile`
- `validity` (e.g. "Valid for 7 days")
- `paymentTerms` (e.g. "Net 30", "Cash on Delivery")
- `deliveryStatus` (e.g. "Pending", "Dispatched")

New table column key support: `product_code`, `tax`, `line_total` (aliases added to `KEY_ALIASES`).

`totals` extended to recognize a `previous_balance` row label and a `grand_total` flag for hero styling.

## 2. New A4 layout (premium pharma)

Replace `buildPdfHtml` with three composable sections:

**Header band** — full-width dark gradient strip:
- Logo: `max-height:200px; max-width:340px` (≈250% bigger).
- Company name 26px bold, tagline 12px italic muted, then a compact 2-column block: address/city · phone/mobile · email/website · NTN/STRN.
- White-on-dark for instant premium feel; reverses cleanly on print.

**Document title bar** — solid accent band with title left, document # right (mono), date below — no more centered "framed" box.

**Two-card party block** (side-by-side):
- Left "BILL TO" card with thick accent left border, displays ALL of: name (16px bold), code chip, mobile (📱 large), phone, city · area, full address, account code (mono, small).
- Right "DOCUMENT INFO" card: Doc#, Date, Sales Agent (+ mobile), Validity, Payment Terms, Delivery Status — label/value rows with subtle dividers.

**Items table** — taller rows, larger fonts:
- Header 14px, body 14px, line-height 1.5, row padding 12px.
- Columns sized so Product Name flexes (`width:auto`) and never truncates (`white-space:normal; word-break:break-word`).
- Numeric cells right-aligned, tabular-nums, mono for codes/batches.
- Zebra rows + bold subtotal row.

**Totals summary card** — premium right-aligned panel (max-width 360px):
- Subtotal, Discount, Tax, Previous Balance: 14px rows.
- **GRAND TOTAL**: separate dark hero block, label 12px uppercase, amount **32px** bold tabular-nums, accent underline.
- Amount-in-words directly under the card, italic, full width.

**Footer**: sales agent strip (name + mobile, left) | signatures (right) | bank details + certification text below.

## 3. New WhatsApp/mobile portrait layout

Add a second template selectable via `PdfPreviewDialog` views (it already supports a `views` array). Key: `whatsapp`, label "WhatsApp", color accent green.

- Fixed 720×1280 portrait canvas, 28px padding, single column.
- Logo 180px tall, centered.
- Company name 24px, doc title 20px badge.
- "BILL TO" hero block: customer name 28px, mobile 22px, city 16px, address 14px.
- Items as compact stacked cards (not a table): product name 16px bold + qty × rate on row 2, line total right-aligned — no horizontal scroll on phones.
- **Grand total hero**: full-width dark card, amount **40px** bold, label above, amount-in-words below in 12px.
- Sales agent + WhatsApp/phone CTA at bottom.
- Minimal whitespace, dense and screenshot-friendly.

Implementation: extract `renderA4(opts)` and `renderWhatsApp(opts)` as separate functions inside `pdf-generator.ts`. Export both:

```ts
generatePdfHtml(opts)              // unchanged — returns A4 (default)
generateWhatsAppHtml(opts)         // new — returns portrait
generateDocumentViews(opts)        // new — returns PdfView[] for PdfPreviewDialog
```

## 4. Wire callers to show both views

Update every page that opens `PdfPreviewDialog` for a document to pass `views={generateDocumentViews(opts)}`:

- `ProformaInvoices.tsx` (Sales Order/Proforma + Sales Invoice + Sales Return preview)
- `DeliveryNotes.tsx`
- `PurchaseProforma.tsx` (Purchase Order + Purchase Invoice + GRN)
- `WarrantyInvoices.tsx`
- `PrintJobs.tsx`

Each caller also passes the new `partyCode`, `partyMobile`, `partyCity`, `salesAgentName`, `salesAgentMobile`, `paymentTerms`, `validity`, `deliveryStatus` it already has in scope (selected from customers/suppliers/sales_agents joins that already exist on these pages).

## 5. Print CSS

- `@page { size:A4; margin:12mm 10mm }`
- `thead { display:table-header-group }` so headers repeat on every printed page.
- Avoid `tr` page breaks (`page-break-inside:avoid`).
- WhatsApp template hidden in print media query (`@media print { .wa-frame { display:none } }`) and vice-versa.

## Out of scope

- Database schema changes.
- Renaming any existing column keys (kept via aliases).
- Editing `PdfPreviewDialog.tsx` (already supports multi-view).
- Touching report PDFs (only transactional documents).

## Acceptance

- Logo ~2.5× larger on A4 header.
- Customer name, code, mobile, phone, city, area, address, account code all visible on every doc.
- Product names wrap, never truncate; rows ≥ 14px font.
- Grand total ≥ 32px on A4, ≥ 40px on WhatsApp.
- Amount-in-words present on every financial doc.
- Sales agent name + mobile visible.
- `PdfPreviewDialog` shows two pills: **A4 Print** / **WhatsApp** for all six target documents.
- Prints cleanly on a single A4 page for typical 10-line invoices, with header repeating on overflow.
