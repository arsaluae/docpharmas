

# Complete Audit: Issues, Pain Points, and Fixes

## Issues Found

### 1. CRITICAL: Warranty Invoice uses client-side numbering (race condition)
`WarrantyInvoices.tsx` line 74-78 generates numbers client-side (`getNextNumber()`) instead of using the atomic `generate_document_number` RPC. Two users creating simultaneously will get duplicate numbers.

**Fix**: Use `supabase.rpc("generate_document_number", { p_document_type: "warranty_invoice" })` like every other document type.

### 2. CRITICAL: Sales Returns uses client-side numbering (race condition)
`SalesReturns.tsx` line 54-55 does the same anti-pattern — queries last number and increments client-side.

**Fix**: Use `generate_document_number("sales_return")`.

### 3. CRITICAL: Purchase Returns likely has same issue
Needs audit and fix to use `generate_document_number`.

### 4. Sales Convert dialog is confusing — batch selection is a pain
The convert dialog (line 724-761 in ProformaInvoices.tsx) forces manual batch selection for every item, even when there are no batches. Users must fill in batch numbers one by one before confirming. This is the biggest UX pain point.

**Fix**: Make batch selection optional. If no batches exist for a product, auto-leave it blank. Add a "Skip batches" option. Auto-confirm with single click when batches aren't relevant.

### 5. Sales page loads TWO tables (proforma + invoices) and merges client-side
The `load()` function (line 90-150) queries both `proforma_invoices` and `sales_invoices`, then does complex client-side merging with status mapping. This is fragile, slow, and produces confusing data (same document can appear twice if linking fails).

**Fix**: Simplify — use proforma_invoices as single source of truth. Only query sales_invoices when needed for detail view. The status on the proforma record already tracks the lifecycle.

### 6. Purchase page loads FOUR tables and merges client-side
`PurchaseProforma.tsx` load() (line 94-167) queries proformas, POs, GRNs, and bills, then does complex client-side merging. Same fragility issue.

**Fix**: Same approach — use proformas as single source of truth with status field.

### 7. No summary/stats bar on Sales or Purchases pages
Users can't see at a glance: how many drafts, how many invoiced, total value of drafts, total receivables from this page's documents.

**Fix**: Add a summary strip showing count + value per status.

### 8. Delete only works on proforma drafts, not on invoiced items
Once a proforma is invoiced, there's no way to void/cancel it from the UI. No void/cancel workflow exists.

**Fix**: Add a "Void" action for invoiced items that reverses the balance changes.

### 9. SalesReturns and PurchaseReturns use old `<Select>` not `SearchableSelect`
Inconsistent with rest of app. Hard to use with many customers/products.

**Fix**: Replace with SearchableSelect.

### 10. No date range filter on any listing page
Users can't filter by "this week" or "this month" — they can only search by text and filter by status/customer.

**Fix**: Add date range filter (Today / This Week / This Month / Custom) to Sales, Purchases, Payments, Expenses.

### 11. Dashboard monthly chart fires 12 sequential queries (N+1)
`loadMonthlyChart()` (line 165-184) loops 6 months and fires 2 queries per month sequentially. Very slow.

**Fix**: Fetch all invoices/expenses for 6 months in one query, then group client-side.

### 12. Warranty Invoice delete has no confirmation dialog
Line 142-146: Deletes immediately on click without confirmation. Every other module has a confirmation.

**Fix**: Add AlertDialog confirmation before delete.

### 13. No loading states shown while data loads
Pages show empty tables briefly before data loads. No skeleton/spinner.

**Fix**: Add loading state indicator.

---

## Implementation Plan

### Files Changed

| File | Changes |
|------|---------|
| `src/pages/ProformaInvoices.tsx` | Simplify load() to use proformas only, make batch selection optional in convert dialog, add summary stats strip, add date range filter, add loading state |
| `src/pages/PurchaseProforma.tsx` | Simplify load() to use proformas only, add summary stats strip, add date range filter, add loading state |
| `src/pages/WarrantyInvoices.tsx` | Fix numbering to use RPC, add delete confirmation dialog, add SearchableSelect consistency |
| `src/pages/SalesReturns.tsx` | Fix numbering to use RPC, replace Select with SearchableSelect, add loading state |
| `src/pages/PurchaseReturns.tsx` | Fix numbering to use RPC, replace Select with SearchableSelect |
| `src/pages/Index.tsx` | Optimize monthly chart to single query per table instead of N+1 |
| `src/pages/Payments.tsx` | Add date range filter |
| `src/pages/Expenses.tsx` | Add date range filter |

### Key Changes in Detail

**1. Simplified Sales load() — no more dual-table merge**
Query only `proforma_invoices` with status tracking. For invoiced proformas, join to `sales_invoices` via `converted_invoice_id` to show invoice number. No more duplicate detection or complex merging.

**2. One-click confirm (batch optional)**
Replace the batch selection dialog with a streamlined confirm: if products have batches in stock, show them pre-filled. If no batches, skip entirely. Add "Confirm without batches" button for speed.

**3. Summary stats strip**
Above the table, show: `Drafts: 5 (PKR 125,000) | Invoiced: 12 (PKR 450,000) | Paid: 8 (PKR 320,000)` — clickable to filter.

**4. Date range filter**
Add pill buttons: Today | This Week | This Month | All — filters the listing by date range.

**5. Dashboard chart optimization**
Single query: `select subtotal, date from sales_invoices where date >= 6_months_ago` then group by month in JS. Same for expenses. 2 queries instead of 12.

**6. Fix all document numbering**
Warranty Invoices and Sales/Purchase Returns will use `generate_document_number` RPC for atomic numbering.

No database migrations needed. All fixes are code-level.

