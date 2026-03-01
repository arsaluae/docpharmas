

# System Audit: Bugs, Errors & Improvement Opportunities

---

## CRITICAL BUGS (Data Integrity Issues)

### 1. Invoice/Expense numbering has race conditions
**Every page** (Sales Invoices, Purchase Bills, Expenses, Payments, Delivery Notes) generates document numbers by counting existing records and adding 1. Two users creating simultaneously will get the same number. This also breaks if records are ever deleted -- the count drops and you get duplicate numbers.

**Fix**: Use a database sequence or a `serial` counter table with `UPDATE ... RETURNING` to guarantee uniqueness.

### 2. Payments don't update customer/supplier balances
When a payment is recorded in `Payments.tsx`, only a row is inserted into the `payments` table. The `customers.balance` and `suppliers.balance` fields are **never updated**. This means:
- Dashboard "Total Receivables" and "Total Payables" are always wrong after payments
- Customer/Supplier ledger running balance doesn't match actual balance on the record
- Balance Sheet receivables/payables are inaccurate

**Fix**: After inserting a payment, update the party's balance: `balance = balance - amount` (for received) or `balance = balance + amount` (for made). Same for sales invoices (increase customer balance) and purchase bills (increase supplier balance).

### 3. Sales invoices don't update customer balance
Creating a sales invoice doesn't increase `customers.balance`. The ledger page calculates it on-the-fly from raw transactions, but the stored `balance` column stays at `opening_balance` forever.

### 4. Purchase bills don't update supplier balance
Same issue -- `suppliers.balance` is never touched when a bill is created.

### 5. Bank account balances never update
`BankAccounts.tsx` -- when payments are made via bank transfer or cheque, the `bank_accounts.balance` is never adjusted. The balance stays at `opening_balance` forever.

### 6. Stock movements don't update product stock
`Products.tsx` records stock movements but never updates `products.stock_quantity`. The movement is logged, but actual stock stays the same.

### 7. Sales invoice creation doesn't deduct stock
Creating a sales invoice doesn't reduce `products.stock_quantity` for the sold items.

---

## FUNCTIONAL ISSUES

### 8. Expenses can't be edited or deleted
The Expenses page has no edit or delete functionality. Once recorded, an expense is permanent.

### 9. Payments can't be edited or deleted
Same issue -- no way to correct a wrong payment.

### 10. Purchase bills have no line items
`PurchaseInvoicesPage.tsx` only captures a single subtotal. There are no line items, so you can't see what was purchased or link to products. This is inconsistent with sales invoices which have full line items.

### 11. P&L uses `sales_invoices.total` for revenue (includes GST)
`ProfitLoss.tsx` line 33 uses `total` (which includes GST) as revenue. Revenue should be `subtotal` (net of GST), otherwise your profit is overstated by the GST amount.

### 12. P&L doesn't filter by expense type
All expenses (including personal ones) are included in operating expenses. Business expenses should be separated from personal ones for accurate P&L.

### 13. Balance Sheet doesn't include expenses in equity calculation
The Balance Sheet doesn't subtract expenses or add revenue to equity. Equity = Assets - Liabilities, but retained earnings (cumulative P&L) aren't factored in.

### 14. Cash Flow report has no date filter
Unlike P&L which has from/to date pickers, the Cash Flow report loads ALL data with no date range filter.

### 15. `calcTotals` in SalesInvoices has missing dependency
Line 117: `useCallback` depends on `[items]` but also uses `settings` -- missing from deps array. Could show stale GST calculations.

---

## UX / USABILITY IMPROVEMENTS

### 16. No pagination anywhere
All pages load all records. With 1000+ records, pages will be slow and may hit the Supabase 1000-row default limit silently (truncating results without warning).

### 17. No loading states
Most pages show nothing while data loads. Adding skeleton loaders or spinners would improve perceived performance.

### 18. No "area" field on customers
The sidebar says "Pharma business" and you have `show_party_area` in document templates, but the `customers` table has no `area` column. The template option "Party Area" will always be empty.

### 19. Customer edit overwrites balance with opening_balance
`Customers.tsx` line 70: when saving, it sets `balance: Number(form.opening_balance)`. Editing any customer field resets their balance to the opening balance, wiping out all transaction effects.

### 20. Supplier edit same issue
`Suppliers.tsx` line 56: same bug, `balance: Number(form.opening_balance)`.

### 21. No confirmation/undo for single deletes
Products and customers have AlertDialogs for delete, but purchase bills use `window.confirm()` (inconsistent). Expenses and payments have no delete at all.

### 22. Dashboard doesn't show today's sales or monthly trends
The dashboard is static KPI cards with no time context. Adding today's sales, this month vs last month comparison, or a mini revenue chart would make it much more useful.

### 23. Settings page "Save" button doesn't save tax changes to existing records
When you change the default GST rate from 17% to 18%, existing products still have `gst_rate: 17`. There's no option to bulk-update existing products with the new rate.

---

## RECOMMENDED IMPLEMENTATION PLAN

**Phase 1 -- Fix data integrity (highest priority)**
1. Add database triggers to auto-update balances when payments, invoices, bills, and returns are created/deleted
2. Add a stock trigger to adjust `products.stock_quantity` on invoice creation and stock movements
3. Replace count-based numbering with database sequences

**Phase 2 -- Fix functional gaps**
4. Add edit/delete for expenses and payments
5. Fix P&L to use subtotal for revenue and filter out personal expenses
6. Fix customer/supplier edit to not overwrite balance
7. Add line items to purchase bills
8. Add `settings?.gst_enabled` dependency to `calcTotals` useCallback

**Phase 3 -- UX improvements**
9. Add pagination (or at minimum, a "load more" pattern)
10. Add loading skeletons
11. Enhance dashboard with time-based metrics
12. Add date filters to Cash Flow and Balance Sheet reports
13. Add `area` column to customers table

---

This is a comprehensive list. I'd recommend tackling Phase 1 first since balance/stock accuracy is the foundation of an accounting system. Want me to start with the balance update triggers?

