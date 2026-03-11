

# Full ERP Audit — Findings & Recommendations

---

## CRITICAL: Database Triggers Are Missing

**This is the most severe issue in the entire system.** All trigger functions exist in the database (`handle_sales_invoice_balance`, `handle_payment_balance`, `handle_stock_movement`, `handle_expense_bank_balance`, `handle_credit_note_balance`, `handle_salary_bank_balance`, `handle_print_job_balance`, `handle_payment_invoice_status`) but **zero triggers are actually attached to any tables**.

This means:
- Customer balances are NOT auto-updated when invoices/payments are created/deleted
- Supplier balances are NOT auto-updated
- Bank account balances are NOT auto-updated when expenses/salary payments are recorded
- Invoice paid/partial/unpaid statuses are NOT auto-recalculated when payments are made
- Stock quantities on the products table are NOT auto-updated from stock movements

**The code comments even say "trigger reverses customer balance" and "trigger restores inventory" (line 682-686 of ProformaInvoices.tsx) — but those triggers don't exist.** The void operation deletes stock_movements and invoices expecting triggers to reverse balances, but nothing happens.

**Impact**: All running balance data (customer balance, supplier balance, bank balance, product stock_quantity) will drift from reality over time. The Balance Sheet, Receivables, Payables reports will all show wrong numbers.

**Fix**: Create all 8 missing triggers via a database migration.

---

## HIGH: Sales Returns & Purchase Returns — No Pagination

Both `SalesReturns.tsx` and `PurchaseReturns.tsx` load **all records** without pagination (`select("*")` with no `.range()`). For a multi-tenant system designed for 100+ tenants with years of data, this will break once volume grows. Every other list page uses `usePagination` — these two don't.

**Fix**: Add `usePagination` hook + `PaginationControls` + `.range()` query, matching the pattern used in Payments, Expenses, CreditNotes, etc.

---

## HIGH: Warranty Invoices — No Pagination

`WarrantyInvoices.tsx` loads all records without pagination (line 77: `select("*, customers(name)")` with no count/range).

---

## HIGH: Balance Sheet — Uses Live Balances, Not Point-in-Time

The Balance Sheet report accepts an "As of" date filter, but it queries **live balance columns** from `bank_accounts`, `customers`, `suppliers`, and `printers` tables (lines 23-27). These balances represent current state, not the state at the selected date. The `asOfDate` filter only affects sales_invoices, purchase_invoices, expenses, payments, and returns — creating an inconsistent report.

**Fix**: Calculate receivables/payables/bank from transaction-level data filtered by date, not from live balance fields.

---

## MEDIUM: Cash Flow Missing Salary Outflows

`CashFlow.tsx` only counts payments and business expenses as cash flows. It completely misses **salary payments** (`salary_payments` table), which are real cash outflows that deduct from bank accounts. This understates total outflows.

**Fix**: Include salary_payments in the outflows calculation.

---

## MEDIUM: Duplicate "Loader2" Import Missing in PurchaseReturns

`PurchaseReturns.tsx` uses `<Loader2>` in the save button JSX (line 150) but doesn't import it. The import on line 10 does include `Loader2` — actually this is fine. Disregard.

---

## MEDIUM: ProformaInvoices (1386 lines) and PurchaseProforma (1361 lines) — God Components

Both files are massive single-file components handling creation, editing, submission/conversion, voiding, PDF generation, WhatsApp sharing, delivery notes, payment collection, and batch allocation. This makes them fragile and hard to maintain.

**Recommendation**: No immediate code change needed, but flagging for future refactoring into smaller sub-components.

---

## MEDIUM: Void Operation Doesn't Delete Linked Payments

In `ProformaInvoices.tsx` line 678-694, the void operation deletes stock_movements, invoice_items, invoices, and delivery_notes — but does **not** delete any payments that were linked to that invoice (`invoice_id` field on payments). This leaves orphaned payment records pointing to non-existent invoices.

**Fix**: Add `await supabase.from("payments").delete().eq("invoice_id", invoiceId);` before deleting the invoice.

---

## MEDIUM: P&L COGS Uses Current Cost Price, Not Historical

`ProfitLoss.tsx` calculates COGS by multiplying sold quantity × **current** `cost_price` from the products table. If cost prices change over time (which they will), historical P&L reports become inaccurate.

**Note**: This is an accepted trade-off in many simple ERPs, but worth noting. True fix would require storing cost at time of sale in `sales_invoice_items`.

---

## LOW: Dashboard Makes 12+ Parallel Queries Without Error Handling

`Index.tsx` fires 12 queries in a single `Promise.all` (line 109). If any single query fails, the entire dashboard load fails silently (no error toast). Individual query errors should be caught.

---

## LOW: Delivery Notes Tab Loads All Records Without Pagination

`loadDeliveryNotes()` in ProformaInvoices.tsx (line 722) fetches all delivery notes without `.range()`.

---

## LOW: `useCompanySettings` Not Tenant-Filtered

`useCompanySettings.tsx` queries `company_settings` with `.limit(1).single()` — this works because RLS filters by tenant. But if RLS were ever misconfigured, it could leak data. This is acceptable given the current RLS setup.

---

## Summary — Priority Fix List

| Priority | Issue | Action |
|----------|-------|--------|
| CRITICAL | 8 trigger functions exist but 0 triggers attached | Create migration with all 8 triggers |
| HIGH | Sales/Purchase Returns + Warranty Invoices no pagination | Add usePagination |
| HIGH | Balance Sheet uses live balances, not point-in-time | Calculate from transactions |
| MEDIUM | Cash Flow missing salary outflows | Add salary_payments query |
| MEDIUM | Void doesn't delete linked payments | Add payment cleanup |
| LOW | Dashboard no error handling | Add try/catch per query |
| LOW | Delivery Notes tab no pagination | Add range query |

---

## Recommended Implementation Order

1. **Create all 8 database triggers** (single migration — this alone fixes the biggest data integrity issue)
2. Add pagination to Sales Returns, Purchase Returns, Warranty Invoices
3. Fix void operation to clean up payments
4. Add salary outflows to Cash Flow report
5. Fix Balance Sheet point-in-time calculation

