# Purchase Flow Overhaul

## 1. Supplier — License Expiry
**File:** `src/pages/Suppliers.tsx`, `SupplierProfileDialog.tsx`, migration.

- Add column `suppliers.license_expiry_date date` (nullable).
- Form: new date field next to "License Number".
- List badge: red "EXPIRED" if `license_expiry_date < today`, amber "Expires in Nd" if within 30 days.
- Add to CSV import map.

## 2. Purchase Order — Remove "Additional Cost" column
**File:** `src/pages/PurchaseProforma.tsx` (PO create/edit grid) + PDF template in `src/lib/pdf-generator.ts`.

- Remove the additional-cost input column from the PO line grid and totals section entirely.
- Landed-cost allocation (LandedCosts page) is unaffected — costs still get attached after GRN.

## 3. New 3-Step Lifecycle: **PO Draft → Approve → Receive**

```
[ Purchase Order (draft) ]
        |  click "Approve"
        v
[ Batch & Expiry dialog per line ]  --> creates Purchase Invoice (PI)
        |                                - hits supplier ledger (balance + total)
        |                                - status = 'unpaid'
        v
[ Purchase Invoice screen ]
        |  click "Receive"
        v
[ Receive dialog: Received By, Notes, Qty per line ]
        |  on save:
        |    - create GRN + grn_items (with batch/expiry from PI)
        |    - stock_movements (purchase_in) → hits inventory
        |    - if qty_received < invoiced → auto Debit Note (shortage)
        |    - if qty_received > invoiced → auto Debit Note line (overage, NEGATIVE = adds to payable)
        |        (we use debit_notes with negative amount OR a supplementary PI line — see Technical)
        v
[ Done — PI shows "Received" badge ]
```

### Step A: Approve PO
- New "Approve" button visible only when `status = 'draft'`.
- Opens **Batch & Expiry dialog**: one row per PO line showing `Item • Qty • Batch # (input) • Expiry (date)`.
- On confirm:
  - Create `purchase_invoices` row + `purchase_invoice_items` snapshot copying PO lines incl. batch & expiry.
  - Mark PO `status = 'approved'` and link `po.purchase_invoice_id`.
  - Existing `handle_purchase_invoice_balance` trigger fires → supplier balance updated automatically.

### Step B: Receive
- "Receive" button on the PI (visible when no GRN yet OR partial).
- Dialog fields: **Received By** (text), **Notes** (textarea), **per-line Qty Received** (default = invoiced qty, freely editable up or down).
- On save:
  - Insert `goods_received_notes` + `grn_items` (batch/expiry inherited from PI, receiver name stored in `received_by` + notes).
  - `handle_stock_movement` trigger does inventory.
  - Variance handling (per line):
    - shortage `Δ < 0`: create `debit_notes` row, party=supplier, `amount = |Δ| × rate`, reference = PI #, reason "Short receipt against PI ###" → existing `handle_debit_note_balance` reduces supplier payable.
    - overage `Δ > 0`: create a second PI **adjustment line** on the same PI (`quantity = Δ, rate = original`) so supplier ledger increases correctly, OR a "supplementary bill" PI (decision in Technical section). Stock for the full received qty is recorded.
- PI status badge becomes "Received" (or "Received w/ Variance").

### Removed concepts
- The current standalone GRN-from-PO flow without an approved PI is removed; GRN can only be created from an approved PI.
- "Convert to PI" buttons that bypass the Approve step are removed.

## 4. PDF Templates
**File:** `src/lib/pdf-generator.ts`.

- Purchase Order template: drop additional-cost column.
- Purchase Invoice template: add **Batch #** and **Expiry** columns next to Item/Qty/Rate/Total. (User clarified this is what they meant by "sales invoice template" — same row-detail look as the sales invoice.)
- GRN template: show Receiver, Notes, Qty Invoiced vs Qty Received with variance pill.

## 5. Payments — Remove "$" Symbol
**Files:** `src/pages/Payments.tsx`, dashboard cards if any, `pdf-generator.ts` payment receipt.

- Replace every `$` prefix with `PKR ` (project standard) or nothing where a currency label already appears. Search for `\\$\\{` in formatting and `>\\$<` in JSX.

## 6. Purchase Returns — Full Audit & Fixes
**File:** `src/pages/PurchaseReturns.tsx`, trigger `handle_purchase_return_balance`.

Verify and fix:
- Return must reference a real PI/GRN; cannot exceed received qty per batch.
- On save: supplier balance reduces, stock movement `return_out` decrements inventory, GRN remaining-qty updates, status pill works.
- Void / delete reverses both ledger and stock cleanly via `void_document` RPC path.
- PDF template renders Batch/Expiry/Qty/Rate/Total.
- Link from PI screen "Create Return" pre-fills lines from GRN.

---

## Technical details (for the engineer)

### DB migration
```sql
ALTER TABLE public.suppliers ADD COLUMN license_expiry_date date;

-- purchase_invoice_items already has batch_number / expiry_date? verify; if not:
ALTER TABLE public.purchase_invoice_items
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- goods_received_notes: ensure received_by + notes exist
ALTER TABLE public.goods_received_notes
  ADD COLUMN IF NOT EXISTS received_by text,
  ADD COLUMN IF NOT EXISTS notes text;

-- purchase_proformas: status enum already supports draft/approved; just use existing values.
```

### Overage decision
Implement as **adjustment line on the same PI** (simpler ledger, no negative debit-note hack):
- `INSERT INTO purchase_invoice_items (... quantity = Δ, rate = original_rate, batch_number, expiry_date, notes='Auto: overage on GRN')`
- Recompute PI `total` via existing trigger / recompute helper, then `handle_purchase_invoice_balance` UPDATE fires and supplier balance adjusts by `+Δ × rate`.

Shortage stays as auto debit-note (already correctly reduces supplier balance).

### Files touched
- `supabase/migrations/<new>.sql`
- `src/pages/Suppliers.tsx`, `src/components/SupplierProfileDialog.tsx`
- `src/pages/PurchaseProforma.tsx` (PO grid, Approve button + Batch/Expiry dialog, Receive dialog)
- `src/pages/PurchaseReturns.tsx` (audit pass)
- `src/pages/Payments.tsx` and any `$` usages
- `src/lib/pdf-generator.ts` (PO / PI / GRN / Return templates)
- `src/lib/auto-print-allocator.ts` — verify still works against new approve flow

### Out of scope
- Changing Sales Invoice flow.
- Landed-cost UI rework (only the additional-cost column on PO grid is removed).
- Multi-supplier print-dispatch (already done in Phase 5).
