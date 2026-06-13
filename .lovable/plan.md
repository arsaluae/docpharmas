
# Fix margin calculation + manage opening stock

## 1. Margin formula → markup on cost

Replace the current "margin on sale" formula everywhere it's shown in the Products module with **markup on cost**:

```
landed  = product.cost_price > 0 ? product.cost_price : product.purchase_cost
markup  = landed > 0 ? ((sale - landed) / landed) * 100 : null
```

Header label changes from `MARGIN` → `MARKUP %`. Tooltip on the column header explains "(Sale − Landed) ÷ Landed × 100".

Expected values after change:
- ivymik (38/50/65) → **30.00%**
- Heamo (49/49/65) → **32.65%**
- Coliza (115.5/115.5/140) → **21.21%**
- Movial (83/83/110) → **32.53%**

Updated in: `src/pages/Products.tsx`, plus the same column in `ProductBatchProfileDialog.tsx` (landed-cost drawer live preview). "No Landed" chip logic stays as-is.

Reports (`ItemWiseReport`, `ProductPerformance`, `ProductCosting`, `ProfitLoss`) keep their existing **profit on sale** calculation — those are accounting P&L numbers and shouldn't change. Only the product-catalog screen flips to markup.

## 2. Edit / delete opening stock — batch drawer

`ProductBatchProfileDialog` → Active Batches panel: each batch row gets two new icon buttons (admin only, hidden for sales agents):

- **Edit Qty** — small inline input + Save. Computes delta vs current on-hand and inserts a single `stock_movements` row with `movement_type='adjustment_in'` or `'adjustment_out'`, `batch_number=<row>`, `notes='Manual batch adjustment — was X, now Y'`. Never edits existing rows.
- **Delete batch** — confirm dialog ("Remove all 35,620 of batch X? This writes a reversing adjustment."). Inserts one `adjustment_out` for the full on-hand, same batch number. After save, batch falls out of the list (on-hand = 0).

Both actions write an `audit_log` entry (`logAudit({ action: 'stock_adjusted', ... })`) and refresh `getActiveBatches()`.

## 3. Delete opening stock rows on Movements tab

`StockMovements.tsx` (the Movements tab inside Products page): for rows where `movement_type IN ('opening','opening_stock')` AND user is admin, show a trash icon in a new Actions column.

Click → confirm → `DELETE FROM stock_movements WHERE id = ?`. This is safe for opening rows because they have no ledger / invoice / GRN dependency. Refresh + audit log.

Non-opening movement types stay read-only (deleting a sale/purchase movement would desync invoices).

## 4. Cross-checks

- Stock total on the Products table = sum of active batch on-hands (already true via `stock_movements` trigger). Verify after delete by reading `products.stock_quantity` and refetching the row.
- Sales agent RLS already blocks the new delete/edit paths — UI also hides the buttons via `useIsSalesAgent()`.
- `cost_price` (landed cache) is untouched by quantity edits — only `product_landed_costs` mutates it.

## Files touched

- `src/pages/Products.tsx` — markup formula + column header.
- `src/components/ProductBatchProfileDialog.tsx` — per-batch Edit/Delete + markup display.
- `src/pages/StockMovements.tsx` — delete action on opening rows (admin-only).
- Memory: update `mem://features/product-pricing-mrp-vs-net` note about markup-on-cost on the catalog screen.

## Out of scope

PDFs, PO, reports (profit math stays sale-based for accounting integrity).
