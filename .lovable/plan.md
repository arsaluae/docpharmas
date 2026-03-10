

# System Audit: Bugs & Missing Pieces Found

After a thorough scan of all pages, ledgers, reports, and accounting logic, here are the issues discovered:

---

## Critical Bugs

### 1. Receivables Aging Report — Missing Most Unpaid Invoices
**File:** `src/pages/reports/ReceivablesAging.tsx` line 20

The query filters `.in("status", ["unpaid", "partial"])` but the `recalc_customer_invoice_status` function sets unpaid invoices to `"dispatched"` (not `"unpaid"`). This means **most outstanding invoices are invisible** in the aging report.

**Fix:** Change filter to `["dispatched", "unpaid", "partial"]`.

### 2. Payables Aging Report — Shows Full Invoice Total Instead of Outstanding
**File:** `src/pages/reports/PayablesAging.tsx` line 33 and 61

The report uses `r.total` as the outstanding amount, ignoring any payments made. Unlike receivables (which has `amount_paid`), purchase invoices don't track `amount_paid`, so the aging shows the full bill amount even if partially paid.

**Fix:** Join with payments table to calculate actual outstanding per bill, or display `total - paid` like the receivables report does.

### 3. CashFlow Report — Includes Personal Expenses in Outflows
**File:** `src/pages/reports/CashFlow.tsx` line 19

The expenses query has no filter on `expense_type`, so **personal expenses inflate business outflows**. The P&L report correctly filters `expense_type === 'business'`, but CashFlow doesn't.

**Fix:** Add `.eq("expense_type", "business")` to the expenses query.

---

## Accounting Logic Gaps

### 4. Customer Ledger — Missing Warranty Invoices
**File:** `src/pages/CustomerLedger.tsx`

Warranty invoices issued to a customer are not included in their ledger, so the ledger total won't match the customer's actual position if warranty invoices exist.

**Fix:** Query `warranty_invoices` by `customer_id` and include them as ledger entries.

### 5. Balance Sheet — Date Filter is Misleading
**File:** `src/pages/reports/BalanceSheet.tsx`

The "As of" date filter only applies to invoices/expenses for retained earnings calculation. Bank balances, receivables, payables, and inventory use **current live balances** regardless of the date selected. A historical date will show wrong data.

**Fix:** Add a note that bank/receivables/payables show current balances, or calculate historical balances from transactions.

---

## Data Integrity Concerns

### 6. Reports Missing Pagination — 1000-Row Limit Risk
**Files:** `CustomerWiseReport.tsx`, `SupplierWiseReport.tsx`, `ItemWiseReport.tsx`, `BatchWiseReport.tsx`

These reports fetch all rows without pagination. For tenants with 1000+ customers/suppliers/products, data will silently be truncated.

**Fix:** Add batch-fetching or note the limitation.

### 7. Warranty Invoices — Tenant RLS May Be Weak
The original warranty_invoices RLS was `USING (true)` (open to all authenticated users). The tenant migration should have replaced these, but if it failed for any reason, warranty data could leak between tenants.

---

## Implementation Plan

| # | Fix | File(s) |
|---|-----|---------|
| 1 | Add `"dispatched"` to receivables aging status filter | `ReceivablesAging.tsx` |
| 2 | Calculate actual outstanding in payables aging (total - payments) | `PayablesAging.tsx` |
| 3 | Filter personal expenses from cash flow | `CashFlow.tsx` |
| 4 | Add warranty invoices to customer ledger | `CustomerLedger.tsx` |
| 5 | Add disclaimer or fix balance sheet date logic | `BalanceSheet.tsx` |
| 6 | Add batch-fetching to reports hitting 1000-row limit | Multiple report files |

All fixes are frontend-only (no DB migration needed).

