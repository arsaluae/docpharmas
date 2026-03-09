

# Comprehensive Accounting & Ledger Audit — Findings & Fix Plan

## Critical Issues Found

### 1. P&L Report: 1000-Row Limit Bug (DATA TRUNCATION)
**File:** `src/pages/reports/ProfitLoss.tsx` line 23
- `sales_invoice_items` is fetched with NO date filter and no `.limit()` override — Supabase returns max 1000 rows by default
- For any business with >1000 line items, COGS will be silently under-reported
- **Fix:** Fetch items only for invoices in the date range (use invoice IDs to filter)

### 2. Dashboard: Same 1000-Row Limit on Invoice Items
**File:** `src/pages/Index.tsx` line 48
- `sales_invoice_items` fetched with `.limit(5000)` — better, but still arbitrary. For growing businesses this will eventually truncate
- **Fix:** Filter items by invoice IDs from the period

### 3. Expense Insert Has No Error Check
**File:** `src/pages/Expenses.tsx` line 104
- New expense insert (`await supabase.from("expenses").insert(...)`) has no error handling — fails silently for new users
- **Fix:** Add `const { error } = ...` and `toast.error()`

### 4. Balance Sheet: Retained Earnings Ignores Returns
**File:** `src/pages/reports/BalanceSheet.tsx` line 47
- `retainedEarnings = totalRevenue - totalCOGS - totalBizExpenses`
- Missing: sales returns (reduce revenue) and purchase returns (reduce COGS)
- **Fix:** Fetch sales_returns and purchase_returns totals and incorporate

### 5. Balance Sheet: GST Payable Ignores Returns
- GST calculation uses only invoice GST but doesn't account for GST reversed on returns
- **Fix:** Subtract GST from sales returns, add back GST from purchase returns

### 6. Balance Sheet: COGS Uses Current cost_price (Not Historical)
- Inventory value uses `products.cost_price * stock_quantity` but cost_price may have changed
- This is an inherent limitation of not tracking weighted average cost — acceptable for now but worth noting

### 7. Journal Entries Are Disconnected
- The `chart_of_accounts`, `journal_entries`, and `journal_lines` tables exist but are NEVER populated by actual transactions (sales, purchases, payments, expenses)
- This means the general ledger is empty even when the business is active
- **Fix (Phase 1):** Auto-generate journal entries on key operations OR note this as a manual-only feature. For now, add a note in the UI.

### 8. Cash Payments Not Tracked in Any Account
- When `payment_method = "cash"`, `bank_account_id` is null, so the `handle_payment_balance` trigger skips bank updates
- There's no "Cash in Hand" account auto-created or auto-linked
- **Fix:** Auto-create a "Cash in Hand" bank account on tenant setup, and auto-assign it for cash payments

### 9. Online Payments Missing Bank Link
- When `payment_method = "online"`, the UI doesn't show bank account selector
- **File:** `src/pages/Payments.tsx` line 213 — condition only checks `bank_transfer` and `cheque`
- **Fix:** Add `"online"` to the bank account selector condition

### 10. Supplier Ledger Missing Additional Costs
- Supplier ledger correctly includes additional_costs entries — verified OK

### 11. Customer Ledger Doesn't Include Warranty Invoices
- If warranty invoices affect customer balance, they should appear in the ledger — needs verification

## Non-Critical but Important Missing Features

### A. No Discount Field
- Sales orders and invoices have no discount column — common pharma need for trade/cash discounts

### B. No Credit/Debit Notes
- Returns don't generate formal credit notes (for customers) or debit notes (for suppliers)

### C. Payment Allocation Visibility
- The `recalc_customer_invoice_status` function allocates payments FIFO to invoices, but there's no UI showing which invoices a payment was allocated to

### D. Aging Reports: No Payment Terms Consideration
- Receivables aging likely uses invoice date but doesn't factor in credit_days from customer settings

## Implementation Plan

### Phase 1: Fix Critical Bugs (This Implementation)

| File | Fix |
|------|-----|
| `src/pages/reports/ProfitLoss.tsx` | Filter invoice items by period invoice IDs; remove implicit 1000-row limit |
| `src/pages/reports/BalanceSheet.tsx` | Add returns to retained earnings and GST calculations |
| `src/pages/Expenses.tsx` | Add error handling on new expense insert |
| `src/pages/Payments.tsx` | Show bank account selector for "online" payments too |
| `src/pages/Index.tsx` | Filter dashboard items by period invoice IDs instead of fetching all |

### Phase 2: Enhancements (Future)
- Auto-create "Cash in Hand" account per tenant
- Auto-generate journal entries from transactions
- Add discount fields to sales workflow
- Credit/debit note generation on returns
- Payment allocation breakdown UI

