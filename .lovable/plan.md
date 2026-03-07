

# Plan: Printer Module with Print Job Tracking & Rejection/Cost-Splitting

## The Business Flow

1. You have **Printers** — separate entities from Suppliers (factories). Printers supply printed packaging materials.
2. You send a **Print Job** to a Printer (e.g., 5000 packs for Product X).
3. Printer delivers packs to the Factory (Supplier).
4. Factory rejects some units (e.g., 1000 misprints).
5. After negotiation, the rejection cost is **split** between Printer and you (e.g., 60% printer, 40% you).
6. Printers have their own **ledger**, balances, payments — completely independent from Suppliers.

## Database Changes (3 new tables + 1 counter)

### `printers` table
Same structure as suppliers: `id, name, company, phone, email, address, city, ntn, opening_balance, balance, payment_terms_days, created_at`

### `print_jobs` table
Tracks each print order sent to a printer:
- `id, job_number, printer_id, product_id, date, quantity_ordered, quantity_delivered, quantity_rejected, rejection_reason, status (draft|delivered|settled), cost_per_unit, total_cost, printer_share_percent, printer_share_amount, our_share_amount, notes, created_at`

### `printer_ledger_view` (computed from print_jobs + payments)
No separate table needed — ledger will be computed client-side from print_jobs and payments (like supplier/customer ledger).

### Update `payments` table
Add `printer` as a valid `party_type` so existing payment system works for printers too.

### Update `document_counters`
Insert a new row for `print_job` document type with prefix `PJ-`.

### Balance triggers
Create `handle_print_job_balance` trigger to update `printers.balance` when print jobs are settled.

## New Pages

### `src/pages/Printers.tsx`
CRUD for printers — same pattern as Suppliers page. Fields: name, company, phone, email, address, city, NTN, opening balance. Table with search, bulk delete, ledger link.

### `src/pages/PrinterLedger.tsx`
Ledger view for a printer — shows print jobs (credits) and payments made (debits) with running balance. Same pattern as SupplierLedger.

### `src/pages/PrintJobs.tsx`
Main print job management page:
- **Create Job**: Select printer, product, quantity, cost per unit
- **Record Delivery**: Enter quantity delivered + quantity rejected + rejection reason
- **Settle Rejection**: Enter printer share % → auto-calculates printer's cost vs your cost
- **Status flow**: Draft → Delivered → Settled
- Premium UI with summary stats strip (total jobs, pending settlement, total rejection cost)

## Modified Files

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Add "Printing" section with Printers + Print Jobs links |
| `src/App.tsx` | Add routes for `/printers`, `/printers/:id/ledger`, `/print-jobs` |
| `src/pages/Payments.tsx` | Support `printer` as party_type in payment creation |
| New: `src/pages/Printers.tsx` | Printer CRUD page |
| New: `src/pages/PrinterLedger.tsx` | Printer ledger page |
| New: `src/pages/PrintJobs.tsx` | Print job tracking with rejection & cost-splitting |

## Migration SQL Summary

1. Create `printers` table with RLS policies
2. Create `print_jobs` table with RLS policies
3. Insert `print_job` into `document_counters`
4. Create balance trigger for printers (on payments where party_type = 'printer')
5. Update `handle_payment_balance` trigger to handle `party_type = 'printer'`

## Print Job Settlement Flow (UI)

1. **Create**: Pick printer + product + qty + cost/unit → status = `draft`
2. **Mark Delivered**: Enter qty_delivered, qty_rejected, rejection_reason → status = `delivered`
3. **Settle**: Enter printer_share_percent (e.g., 60%) → system calculates:
   - Rejection cost = qty_rejected × cost_per_unit
   - Printer share = rejection_cost × 60% → deducted from printer balance
   - Our share = rejection_cost × 40% → logged as expense
   - Status = `settled`

