# Plan — Print Jobs Multi-Dispatch, GRN Overage, PI Items & Supplier City

## 1. Purchase Invoice — show full item detail
**File:** `src/pages/PurchaseProforma.tsx` (PI detail view) and the GRN items list.

Currently the PI list shows compressed columns. Render each line as a full row:
**Item • Batch # • Expiry • Qty Ordered • Qty Received • Rate • Total**
Pulled from `grn_items` joined to `purchase_invoices`. Same format used in PDF print template (`src/lib/pdf-generator.ts`) — extend the existing PI PDF section to include batch/expiry columns.

## 2. Supplier form — free-text city
**File:** `src/pages/Suppliers.tsx` (and the same form in `Customers.tsx` if it shares the pattern).

Replace the constrained `CityInput`/Select with a combobox: shows the existing Pakistan cities list as suggestions but accepts any typed value and saves it directly into `suppliers.city`. No migration needed (column already free text).

## 3. Print Jobs — simplified lifecycle: **draft → dispatched** only
**File:** `src/pages/PrintJobs.tsx`, status badges, and the existing `handle_print_job_balance` trigger (no settled accounting change needed if we never call settled).

- Remove the "settled" status from the create/edit UI. Status values exposed: `draft`, `dispatched`. (Keep `settled` in DB enum/string for backward compatibility but hide it.)
- Trigger logic stays — it only fires on transition to settled, which no longer happens via UI.

## 4. Print Jobs — multi-supplier dispatch (split a single job across suppliers)
**New table:** `print_dispatches`
```
id, tenant_id, print_job_id, supplier_id, qty_dispatched, date, notes, created_at
```
- GRANTs + RLS by `current_user_can('purchase','write/read')`.
- Trigger `aggregate_print_dispatches`: recomputes `print_jobs.quantity_dispatched_to_supplier = SUM(qty)` on insert/update/delete.
- `print_jobs.allotted_supplier_id` becomes optional/legacy (kept for back-compat; new records use dispatches table).

**UI:** On a `draft`/`dispatched` job, a "Dispatch" dialog lets user add multiple rows: supplier + qty. Validates `SUM(dispatches) ≤ quantity_delivered`. Remaining stays "at factory" automatically because `quantity_at_factory` is generated from `delivered − dispatched_total`.

Example: ordered 5000, delivered 5000, dispatch 2000→Supplier A, 2000→Supplier B → 1000 stays at factory/printer.

## 5. Print Jobs — over-delivery (received > ordered)
**File:** existing `print_deliveries` already has no upper bound — confirm by removing any UI guard in `PrintJobs.tsx` that blocks `qty_delivered > quantity_ordered`. Show a yellow "Over-delivery" pill when totals exceed ordered. `quantity_at_factory` recomputes correctly.

## 6. Print Jobs — rejections allowed AFTER dispatch (post-settled too)
**File:** `src/pages/PrintJobs.tsx` + `print_rejections` table (no schema change).

Today the rejection UI is gated by status. Allow recording rejections in any status (`draft`, `dispatched`, `settled`). Rejection still flows through `recalc_print_rejections` trigger. Add "Rejections" tab to job detail showing all rows with date / qty / reason / cost split.

## 7. Print Jobs list — group/filter by Supplier, Product, Printer
**File:** `src/pages/PrintJobs.tsx`.

Add three filter dropdowns at the top (Supplier, Product, Printer) and a "Group by" toggle (None / Supplier / Product / Printer). Server-side `.eq()` filters; grouping is client-side aggregation showing subtotals (ordered, delivered, dispatched, at-factory, rejected) per group.

## 8. Purchase Invoice — "Printing already available" hint per line
**File:** `src/components/PrintAvailabilityPanel.tsx` (already exists, partially built).

Re-enable this panel on the **Purchase Invoice line editor** (not on the PO). For each product row it queries `print_jobs` + new `print_dispatches`:
- "At Supplier X: 2,500 pcs" (sum of dispatches to that supplier, minus consumed)
- "At Our Factory: N pcs"
- "In Progress: N pcs"
- Shortfall warning + "Create Print Job" shortcut.

Wired into the PI item row so when a user enters Mikson Supplier + Product, they immediately see "2,500 already printed and at Mikson — use these first".

---

## Technical summary
**DB migrations**
1. `CREATE TABLE public.print_dispatches` + GRANTs + RLS + trigger to roll up `quantity_dispatched_to_supplier`.
2. Trigger to **release** a dispatch row when the linked GRN consumes it (extends `consume_print_allocations_on_grn` to also match dispatched rows by supplier).

**Frontend**
- `PrintJobs.tsx`: lifecycle simplification, multi-dispatch dialog, over-delivery handling, rejection-anytime, filters & grouping.
- `PurchaseProforma.tsx` (PI section): expanded item columns, embed `PrintAvailabilityPanel` on item rows.
- `Suppliers.tsx`: free-text city combobox.
- `pdf-generator.ts`: PI template columns (batch/expiry).

**No business-logic regression**: existing triggers (`aggregate_print_deliveries`, `recalc_print_rejections`, `consume_print_allocations_on_grn`, `handle_print_job_balance`) all continue to work; new `print_dispatches` is additive.

## Out of scope (not touching this round)
- Auto-creating debit notes for rejections (stays manual via existing flow).
- Changing PO/PI numbering or RBAC rules.
- Reworking landed-cost allocation.
