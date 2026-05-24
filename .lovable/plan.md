## Goal

Today the Print Availability Panel is informational — user reads numbers, clicks "Create Print Job". Make the whole flow automatic: when a purchase invoice/PO is confirmed and received, the system itself decides which printed packaging to use, deducts it from print-job balances, and attaches the printing cost per unit to the stock so reports show material + printing cost separately.

## How the automation works

```text
Purchase Invoice (Coliza 10,000 pcs @ 50)
        │
        ▼
On CONFIRM  → auto-RESERVE packaging from print jobs
   priority order, per supplier on the PO:
     1. At supplier (allotted_supplier_id = this supplier) — use first
     2. At our factory (undispatched) — auto-dispatch on GRN
     3. In-progress print jobs — reserve future delivery
     4. Shortfall → flag, optional auto-create draft print job
        │
        ▼
On GRN RECEIVE → auto-CONSUME reserved packaging
   • Deduct from print_jobs (dispatched/at-factory balances)
   • Insert purchase_print_allocations rows (audit trail)
   • Attach printing_cost_per_unit to received stock layer
        │
        ▼
Reports & Ledgers
   • Supplier ledger: material only (10,000 × 50 = 500,000)
   • Printer/vendor ledger: untouched (already booked at print-job creation)
   • Stock cost layer: 50 (material) + 5 (printing) = 55 landed
   • Item-wise / P&L: shows split → Material 50, Printing 5, GP per unit
```

## Database changes

New table `purchase_print_allocations` (tenant-scoped, RLS like siblings):

- `purchase_invoice_id` (PO/proforma id), `grn_id`, `product_id`, `supplier_id`
- `print_job_id`, `source` enum: `at_supplier` | `at_factory` | `in_progress`
- `quantity_reserved`, `quantity_consumed`
- `printing_cost_per_unit` (snapshot from print job at allocation time)
- `status`: `reserved` | `consumed` | `released`

Trigger `trg_consume_print_allocations_on_grn`:
- On `grn_items` insert with `product_id` having reserved allocations, for each matching allocation FIFO:
  - decrement `print_jobs.quantity_dispatched_to_supplier` (at_supplier) or auto-bump `quantity_dispatched_to_supplier` then decrement (at_factory)
  - mark allocation `consumed`, set `grn_id`
- Insert a `stock_movements` adjustment row tagged `printing_cost` so cost layer reflects landed cost.

Trigger `trg_release_print_allocations_on_void`:
- When PO/GRN voided, set allocations back to `released` and restore print-job balances.

## Code changes

1. **`src/lib/auto-print-allocator.ts`** (new) — pure function `allocatePrinting(productId, supplierId, qty)` returning the FIFO plan (at_supplier → at_factory → in_progress → shortfall). Writes `purchase_print_allocations` rows in `reserved` state.

2. **`src/pages/PurchaseProforma.tsx`**
   - On **Confirm PO**: for each line with `product_id`, call `allocatePrinting`. Show a compact summary toast ("Auto-reserved 8,000 pcs printed packaging from 2 jobs; 2,000 pcs shortfall — print job draft created").
   - Replace `PrintAvailabilityPanel`'s "Create Print Job" with a read-only summary that shows what was auto-reserved (live from `purchase_print_allocations`), plus an "Adjust" link for power users.
   - On **Receive GRN** (`handleReceive`): no new code needed beyond firing the existing insert — trigger handles consumption.
   - On **Void**: rely on `void_document` cascade + new release trigger.

3. **`src/components/PrintAvailabilityPanel.tsx`** — switch to "Allocation Summary" mode when a confirmed PO exists: lists reserved jobs, source, qty, cost/unit; falls back to current advisory view for drafts.

4. **`src/pages/PrintJobs.tsx`** — show "Reserved for PO #" badge on jobs whose at-factory/at-supplier balance has open allocations; block deletion if reserved.

5. **Reports** (`ItemWiseReport.tsx`, product costing, P&L) — read `purchase_print_allocations` joined with GRN to split Material vs Printing cost columns. Sales-side already shows revenue; gross profit becomes `sale - (material + printing)`.

## Ledger correctness (unchanged, re-verified)

- Purchase Invoice posts **material only** to supplier ledger.
- Print Job posts **printing cost** to printer/vendor ledger at job creation/settlement (existing behaviour).
- Auto-allocation is a stock + costing event, **no new journal entries** — prevents double-booking.

## Out of scope for this step

- City-product smart suggestions on Sales Orders (separate task).
- UI for manually overriding an auto-allocation (will add only if requested after this lands).

## Files touched

- new: `supabase/migrations/<timestamp>_purchase_print_allocations.sql`
- new: `src/lib/auto-print-allocator.ts`
- edit: `src/pages/PurchaseProforma.tsx`, `src/components/PrintAvailabilityPanel.tsx`, `src/pages/PrintJobs.tsx`
- edit: `src/pages/reports/ItemWiseReport.tsx` and product-costing/P&L report files for the split column
