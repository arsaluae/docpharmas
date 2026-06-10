# Sales Invoice — MRP, Batch Expiry & UI Polish

## 1. Show MRP and Batch/Expiry on the Sales Invoice (PDF + UI)

**File:** `src/pages/ProformaInvoices.tsx` → `buildSalesInvoiceHtml` (lines 605–639)

Currently the PDF has columns: `# | Product | Batch # | Expiry | Qty | Rate | Amount`. The "Rate" is the actual selling rate; MRP (product master price) is missing, and on older invoices `expiry_date` prints as `—` because it was never saved on the row.

Changes:
- Add an **MRP** column between `Product` and `Batch #`, pulled from `products.selling_price` (already joined as `products(name)` — extend the select to `products(name, selling_price)`).
- For rows where `expiry_date` is null, do a fallback lookup against `grn_items` by `(product_id, batch_number)` so historical invoices still print the expiry. Batch-fetch all expiries in one query before assembling rows (no N+1).
- Apply the same MRP + expiry-fallback to `buildDeliveryNoteHtml` (lines 643–673) so delivery notes match.
- Format expiry as `MMM YYYY` (Manrope tabular-nums) for readability.

Also surface MRP in the on-screen line item rows of the **Edit Order dialog** and the **Dispatch dialog** — a small muted `MRP PKR x,xxx` under the product name so the operator sees the official price next to the rate they're charging. No business-logic change to rates.

## 2. MRP field on product creation

**Files:** `src/pages/Products.tsx` (Add/Edit Product dialog, line 250) and `src/components/QuickCreateProductDialog.tsx`

- Rename the field label `Selling Price (PKR)` → `MRP (PKR)` everywhere in the Products dialog. (The DB column stays `selling_price` — purely a label change.)
- Update the Products table header `Price` → `MRP` (line 287) for consistency.
- `QuickCreateProductDialog` already exposes MRP — no schema change. Confirm the same `MRP (PKR)` wording and bump it from a 3-column row into its own full-width row with a short helper "Printed on every sales invoice." so it isn't lost between Unit and Cost.

No database migration required.

## 3. UI/UX polish — sales invoice flow

Scoped to the Dispatch dialog and line-item rows in `ProformaInvoices.tsx` (lines 1359–1448) and the printed sales invoice template:

- **Dispatch dialog header**: replace plain title with a two-line header — title + customer name + order number in mono — and a hairline indigo accent bar on the left edge of each item card (matches the precision-industrial system already in `mem://style/theme`).
- **Item cards**: restructure each card into 3 zones — product meta (name, pack size, MRP), batch picker with inline expiry chip (amber when <60d to expiry, emerald otherwise), and dispatch qty with `/ ordered` suffix. Replace the current `text-[10px]` expiry hint with a proper pill using `status-pill` tokens.
- **Batch select option label**: render `BATCH-NO · 240 avail · exp Mar 2027` with tabular-nums and muted secondary text instead of a single grey line.
- **Courier picker**: keep the existing grid but tighten spacing, add a subtle ring on the selected courier, and a "Required" micro-label when empty.
- **PDF template**: tighten column widths so MRP and Rate sit side-by-side right-aligned with tabular-nums; bold the Total row; add a subtle "FEFO dispatched" footnote when any item is within 90 days of expiry.

All visual changes use existing tokens (`--primary`, `--success`, `--warning`, `--border`, `--surface-2`) — no new colors, no new fonts, 150ms ease-out only.

## Out of scope
- No DB schema changes, no new tables/columns.
- No change to rate calculation, totals, GST/WHT logic, stock movements, or void/grace logic.
- Other invoice types (warranty, purchase, proforma PDF) are not touched in this pass.

## Verification
- Open `/proforma`, edit an order → MRP visible per line. Dispatch dialog → each card shows MRP + expiry chip; batch dropdown renders the 3-part label.
- Print a sales invoice from a fresh order and from an older one (no `expiry_date` on row) → both show Batch and Expiry; new MRP column populated.
- Print the linked delivery note → same Batch/Expiry behaviour.
- `/products` Add Product dialog → field reads "MRP (PKR)"; table header reads "MRP".
- No console errors, no regression in totals.
