

# Accounting ERP & Data Management Expert Audit

## CRITICAL: Accounting Integrity Flaws

### 1. DUPLICATE PURCHASE INVOICES (DOUBLE-COUNTED PAYABLES)
**Severity: CRITICAL** -- This is actively corrupting financial data.

`PurchaseProforma.tsx` creates a purchase invoice (bill) at TWO stages:
- **Line 330-344**: `handleConfirmOrder` creates a bill when confirming the order
- **Line 467-481**: `handleReceive` creates ANOTHER bill when receiving goods

The `handle_purchase_invoice_balance` trigger fires on BOTH inserts, increasing `suppliers.balance` TWICE. Every purchase order that goes through confirm → receive has **double the payable amount** recorded against the supplier. Your Balance Sheet, Supplier Ledger, and Profit & Loss are all wrong.

**Fix**: Skip bill creation in `handleReceive` if one was already created during confirm. Or better: only create the bill on receive (when you know exact quantities received).

### 2. PURCHASE VOID DELETES WRONG INVOICES (DATA CORRUPTION)
**Severity: CRITICAL**

`PurchaseProforma.tsx` line 580:
```typescript
await supabase.from("purchase_invoices").delete()
  .eq("supplier_id", voidOrder.supplier_id || "")
  .is("grn_id", null);
```
This deletes **ALL** purchase invoices for the supplier that have no GRN link -- not just the one from this order. If Supplier X has 5 confirmed orders, voiding 1 deletes the bills for all 5. The `handle_purchase_invoice_balance` trigger then reverses ALL those amounts from the supplier balance.

**Fix**: Track the specific bill ID created during confirm and delete only that one.

### 3. PAYMENT EDIT "DELETE-THEN-INSERT" IS NOT ATOMIC
**Severity: HIGH**

`Payments.tsx` line 84-94 and `Expenses.tsx` line 75-85 use a delete-then-insert pattern for edits. If the insert fails after the delete succeeds:
- The original payment is permanently lost
- Customer/supplier balances are wrong (trigger reversed the delete but no insert trigger fired)
- Bank account balances are wrong
- The payment number is orphaned

This is a data loss risk on every edit. There's no transaction wrapping these two operations.

### 4. SALES RETURN DOESN'T LINK `reference_id` ON STOCK MOVEMENTS
**Severity: HIGH**

`SalesReturns.tsx` line 77-81: Stock movements for returns are inserted WITHOUT `reference_id`. This means:
- Void operations can't find and reverse these movements
- Audit trail is broken -- you can't trace which return caused which stock change
- Same issue in `PurchaseReturns.tsx` line 77-80

### 5. PROFIT & LOSS USES PURCHASE INVOICES AS COGS (WRONG)
**Severity: HIGH**

`ProfitLoss.tsx` line 29: COGS = sum of `purchase_invoices.subtotal`. This is **purchases**, not cost of goods SOLD. If you buy PKR 1M of stock but only sell PKR 200K worth, your P&L shows PKR 1M COGS. The correct COGS should be calculated from `sales_invoice_items` quantity × product cost_price, or from stock movements linked to sales.

Additionally, with the duplicate bill bug above, COGS is double-counted.

### 6. BALANCE SHEET IS FUNDAMENTALLY WRONG
**Severity: HIGH**

`BalanceSheet.tsx` has multiple accounting errors:
- **Assets = Liabilities + Equity** must always hold. Currently `equity = assets - liabilities` which is tautologically correct but meaningless -- it doesn't track retained earnings or owner's capital
- No opening balances are tracked
- Inventory uses `cost_price × stock_quantity` but `cost_price` is a static field, not the actual weighted average cost
- GST Payable only looks at unpaid invoices, not all invoices in the tax period
- No date filter -- shows all-time data mixed together

### 7. CASH FLOW REPORT LOADS ALL DATA WITHOUT LIMITS
**Severity: MEDIUM**

`CashFlow.tsx` fetches ALL payments and ALL expenses with no date filter and no pagination. With 100+ tenants each having years of data, this will timeout or hit the 1000-row default limit, silently truncating results.

### 8. NO AUDIT TRAIL / EDIT HISTORY
**Severity: MEDIUM**

Every edit (customer, product, payment, expense) overwrites data in place. There's no `updated_by`, no `previous_values` log. For an accounting system, this means:
- No way to detect unauthorized changes
- No compliance with basic accounting standards (edits should be traceable)
- The delete-then-insert pattern for payments makes this worse -- the original record is destroyed

### 9. STOCK VARIANCE DOUBLE-COUNTS IN GRN
**Severity: MEDIUM**

`PurchaseProforma.tsx` line 430-462: When receiving goods, it creates a `purchase_in` movement for `quantity_received`, then ALSO creates an `adjustment_in` or `adjustment_out` for the variance. But the `purchase_in` already added the full `quantity_received` to stock. The adjustment is adding/subtracting the variance ON TOP of the already-correct quantity. 

Example: Ordered 100, received 110. Current code: +110 (purchase_in) + +10 (adjustment_in) = +120 added to stock. Should be +110.

### 10. NO CONCURRENCY PROTECTION ON DOCUMENT NUMBERS
**Severity: MEDIUM**

`generate_document_number` uses `UPDATE ... RETURNING` which is safe for a single call, but if two users create invoices simultaneously, there's a race condition window. The function should use `SELECT FOR UPDATE` or advisory locks.

---

## DATA MANAGEMENT ISSUES

### 11. NO FOREIGN KEY CONSTRAINTS
Every table references other tables by UUID but there are NO foreign key constraints in the schema. Deleting a customer doesn't cascade or block -- their invoices, payments, and returns become orphaned with dangling `customer_id` references. Same for products, suppliers, etc.

### 12. STOCK MOVEMENTS TABLE HAS NO INDEX ON reference_id
Stock movement lookups by `reference_id` (used in void operations, batch calculations) do full table scans. With thousands of movements per tenant, these queries will slow down significantly.

### 13. NO PAGINATION ON ANY LIST PAGE
Every page (Customers, Products, Payments, Expenses, Stock Movements) fetches ALL records with `select("*")`. At 1000+ records per table, these will silently truncate at the default limit or become slow.

---

## IMPLEMENTATION PLAN

| # | Priority | Fix | Files |
|---|----------|-----|-------|
| 1 | CRITICAL | Remove duplicate bill creation in handleReceive (only create if none exists) | `PurchaseProforma.tsx` |
| 2 | CRITICAL | Fix void to delete specific bill by tracking bill_id | `PurchaseProforma.tsx` |
| 3 | HIGH | Fix stock variance double-counting in GRN receive | `PurchaseProforma.tsx` |
| 4 | HIGH | Add `reference_id` to sales/purchase return stock movements | `SalesReturns.tsx`, `PurchaseReturns.tsx` |
| 5 | HIGH | Fix P&L to calculate COGS from actual sales cost, not purchases | `ProfitLoss.tsx` |
| 6 | HIGH | Make payment/expense edits use UPDATE instead of delete+insert | `Payments.tsx`, `Expenses.tsx` |
| 7 | MEDIUM | Fix Balance Sheet accounting (date filter, retained earnings) | `BalanceSheet.tsx` |
| 8 | MEDIUM | Add date filters and pagination to CashFlow | `CashFlow.tsx` |

