# Sales Order MRP + Polish Pass

UI/UX-only refinement. No accounting, RPC, or document-numbering changes. Scope: the Sales Order/Sales Invoice composer in `src/pages/ProformaInvoices.tsx`, the matching Purchase Order composer in `src/pages/PurchaseProforma.tsx`, and the shared print template in `src/lib/pdf-generator.ts`.

## What changes (user-visible)

1. **MRP visible & editable on Sales Order lines**
   - Each line shows the product's catalog MRP (from `products.mrp`, falling back to `selling_price`) as a small reference under the product name.
   - New **MRP** input on every line — pre-filled from catalog MRP, editable per line, stored on the line item so printed invoices show the actual MRP charged. Empty = use catalog MRP.
   - Mobile card view gets the same MRP field as a dedicated row.
   - Validation: `rate ≤ MRP` (warning chip, not block) so users see when they're selling above MRP.

2. **Customer phone on every printed document**
   - Sales Invoice, Sales Order/Proforma, Delivery Note, Sales Return, Credit Note, Purchase Order, Purchase Invoice, Purchase Return, Debit Note, Warranty Invoice — all add a **Phone** line under the party block in the printed PDF.
   - Phone pulled from existing `customers.phone` / `suppliers.phone` (already in queries).

3. **Polished composer chrome (Sales Order + Purchase Order)**
   - Reduce vertical noise: collapse the duplicated KPI summary chips at the top of the form into a single compact bar.
   - Tighter section spacing (24px → 20px between blocks), unify section header style (uppercase 12px label + 1px hairline divider).
   - Customer/Supplier panel: 3-col grid (Party · Date/Doc# · Terms) instead of 4-col so values don't truncate at 1061px viewport.
   - Item table: lock column widths (Product 28% · MRP 9% · Qty 8% · Rate 11% · Disc% 8% · GST% 8% · Line total 16% · Action 4%); remove inner borders, keep only row separators; right-align all numeric columns with `tabular-nums`.
   - Totals rail: remove the secondary card border, use a single hairline divider between rows; grand total stays 32px bold but with a thin top rule and tighter padding so the rail is shorter than the items list.
   - Sticky footer: lighten background, group destructive (Cancel) left and primaries right with consistent button heights.

4. **Polished invoice/PDF layout**
   - Header: company block left, document title + number right in a clean 2-col band with a single 1px rule beneath.
   - Party block: 2-col (Bill To · Doc meta) with **Phone** added; remove the boxed background.
   - Item table: alternating row tint removed in favor of hairline separators; right-align numeric columns; show **MRP** column on sales documents.
   - Totals: 2-col bottom band (Amount in words left · totals right); Grand Total in 22pt bold on a single accent rule.
   - Footer: terms + signature in a single 2-col strip, no boxed border.

## Files touched

- `src/pages/ProformaInvoices.tsx` — add `mrp` to line-item state and validators; add MRP input to desktop row and mobile card; tighten composer layout (sections, grid, totals rail, footer); show catalog MRP under product name (already partially present at lines 1627/1710, will be reworked into the new column).
- `src/pages/PurchaseProforma.tsx` — apply the same composer chrome polish (no MRP field — purchase side keeps cost/rate).
- `src/lib/pdf-generator.ts` — add `customerPhone` / `supplierPhone` to `PdfOptions` (or pull from existing party object), render Phone line in party block for all document themes; add MRP column to sales-side themes; rework header/totals/footer per above.
- No DB migration. MRP is stored inside the existing `proforma_invoices.items` jsonb (already a free-form object) and inside `sales_invoice_items` via the existing `rate` flow — we add `mrp` as an extra jsonb key on proforma items and pass it through to the PDF; persisted-per-line MRP on `sales_invoice_items` is **out of scope** (see below) so the printed SI uses the line's `rate` and the product's catalog MRP unless we add a column later.

## Out of scope (ask if you want these)

- Adding a real `mrp` column to `sales_invoice_items` / `purchase_order_items` (would need a migration). Right now MRP lives on the proforma jsonb only; the generated Sales Invoice will fall back to `products.mrp` for the MRP column unless we migrate.
- Rebuilding the Sales Order / Purchase Order list tables.
- Any change to totals math, tax, credit checks, or document numbering.
- New print themes — we polish the existing one.

## Acceptance

- MRP column shows on every Sales Order line, editable, defaulting to catalog MRP; mobile card has the same field.
- Selling below/above MRP is visible (warning chip when `rate > mrp`).
- Every printed sales and purchase document shows the party's phone number under the name.
- Composer at 1061px no longer feels cluttered: single KPI strip, tighter sections, no column truncation, sticky totals rail shorter than the item list.
- PDF preview on A4 reads as one clean page: header rule, party block with phone, items with MRP (sales side), totals band with amount-in-words, single footer strip.
