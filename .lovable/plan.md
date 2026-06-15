# Plan: Integrate Opening Stock into Product Edit + Remove Number Spinners

## 1. Move "Add Opening Stock" into the Product editor

- Remove the standalone toolbar button `Add Opening Stock` on the Products page.
- Inside the Product dialog (both create and edit), add an **"Opening Stock / Batches"** section directly under the basic fields.
  - **Create mode**: replace the single `Opening Stock` number field with an inline multi-row batch grid (same columns as the current `OpeningStockDialog`: Batch No*, Mfg, Expiry*, Qty*, Cost, MRP, Sale, Location, Supplier, + Add another batch).
  - **Edit mode**: render the same grid showing **all existing opening-stock batches** for the product (fetched from `stock_movements` where `movement_type in ('opening','opening_stock')` joined with `grn_items` for expiry where available), allowing:
    - inline edit of batch_number, mfg/expiry, qty, cost, mrp, sale, location, supplier, notes
    - delete a row (delete the underlying `stock_movements` row, guarded against negative stock)
    - add new rows (append more opening batches)
- Save action persists all changes in one transaction-like sequence: inserts new rows, updates changed rows, deletes removed rows; writes audit entries; refreshes batches.
- Keep `OpeningStockDialog.tsx` only as a thin wrapper that mounts the same inline panel, or delete it entirely once the Products page no longer references it.

## 2. Redesign Product dialog layout

- Two-column layout on desktop, stacked on mobile:
  - Left column: identity (name, SKU, code, category, pack, MRP/TP, GST, status)
  - Right column: Opening Stock / Batches panel (scrollable, sticky table header, total qty footer)
- Hairline borders, generous spacing, consistent with precision-industrial tokens (per design memory).
- Footer: Cancel / Save Product (single primary action saves both product fields and batch changes).

## 3. Remove number-input spinner arrows globally

- Update `src/components/ui/input.tsx` to add Tailwind utility classes that strip native spinners for `type="number"`:
  - `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0`
- This affects every invoice / order / form input project-wide, so the user only types — no up/down counter.

## 4. Verification

- Open Products → New: enter product + 2 opening batches → save → confirm both batches show on Stock Movements and in product profile.
- Edit the same product → modify one batch qty, delete one, add a third → save → confirm changes reflected.
- Open any invoice/order form (Sales Invoice, Purchase Invoice, GRN) and confirm quantity / rate inputs no longer show up/down arrows in Chromium and Firefox.

## Technical notes

- Existing batch fetch logic already exists in `src/lib/batches.ts` (`getActiveBatches`) — reuse it for the edit-mode list, but extend to also return the underlying `stock_movements.id` so rows can be updated/deleted.
- Use a small helper (in `Products.tsx` or extracted to `src/lib/opening-stock.ts`) that diffs the in-memory batch rows vs. the DB rows and emits the matching insert/update/delete calls.
- Audit logging stays the same (`logAudit({ action: "stock_adjusted", ... })`).
- No schema changes required.

## Files

- Edit: `src/pages/Products.tsx` (remove toolbar button, embed batch panel in dialog, wire save)
- Edit: `src/components/OpeningStockDialog.tsx` → either refactored into a reusable `<OpeningStockPanel />` component or deleted
- New (optional): `src/components/products/OpeningStockPanel.tsx`
- Edit: `src/components/ui/input.tsx` (remove number spinners)
- Edit: `src/lib/batches.ts` (include movement id for edit/delete)
