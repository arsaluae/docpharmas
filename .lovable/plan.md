## 1. Finish Print Job → Dispatch to Supplier dialog (carryover)

`src/pages/PrintJobs.tsx` — mount the actual dialog wired to the existing "Dispatch" button:
- Shows printer, product, **At Factory: <qty>** (from `quantity_at_factory`).
- Inputs: qty (max = at-factory), date, batch_number (optional), note.
- On save: insert `stock_movements` row (`purchase_in`, tagged supplier + batch) → increments `quantity_dispatched_to_supplier` on the job → `quantity_at_factory` auto-recalcs (generated column already in place).
- Block save if qty > at-factory, or if no `allotted_supplier_id` set.

## 2. Debit & Credit Notes auto-created from returns

Today `credit_notes` exists as a manual table. We'll auto-generate:
- **Sales Return saved** → auto-insert a **Credit Note** (`party_type='customer'`, amount = return total, reason = "Sales Return #<sr_number>", reference = sr_number). Existing `handle_credit_note_balance` trigger already deducts customer balance, so we'll skip the existing `handle_sales_return_balance` deduction to avoid double-counting → migration: drop the SR balance trigger (the credit note covers it).
- **Purchase Return saved** → auto-insert a **Debit Note** (new table `debit_notes`, mirrors credit_notes shape, `party_type='supplier'`). Same balance handling — debit note trigger reduces supplier balance, drop the PR balance trigger.

**New page** `src/pages/DebitNotes.tsx` (read-only list + manual create, same UX as CreditNotes). Add to **Settings → Operations** tab.

Both notes get their own PDF (reuse `PdfPreviewDialog` + a new template type in `document_templates`).

## 3. Scope products to party history (relevant-only)

New helper `src/lib/party-products.ts`:
- `getSupplierProducts(supplier_id)` → distinct `product_id` from `purchase_invoice_items` joined on PIs of that supplier (+ union with `customer_products` allocations isn't applicable here; suppliers don't have allocations table → use purchase history only).
- `getCustomerProducts(customer_id)` → union of `customer_products` (allocated) and distinct products from past `sales_invoice_items`.

Wire into:
- **Purchase Invoice / PO form** product picker → when supplier is selected, filter products to `getSupplierProducts()` with a "Show all" toggle (so first-time purchases still work).
- **Sales Invoice / Sales Order form** product picker → when customer is selected, filter to `getCustomerProducts()` with same "Show all" toggle.

No schema change — pure frontend filtering.

## 4. Pakistan cities — already comprehensive

`src/lib/pakistan-cities.ts` already has ~180 cities including tier-2/tier-3 and AJK/GB. Quick audit + add any missing notable towns user calls out. No-op unless gaps found.

## 5. Analytics & missing reports (business-manager audit)

Add to `src/pages/Reports.tsx` under new sections:

**Sales analytics** (new pages under `src/pages/reports/`):
- **Sales Trend** — monthly revenue, MoM growth %, top-grossing month (chart).
- **Product Performance** — units sold, revenue, gross margin, slow-movers (no sale >60d).
- **Customer 360** — top customers by revenue, by margin, by frequency; dormant customers (no order >90d); avg order value.
- **Agent Performance** — sales per agent, commission earned, conversion rate (PI→Invoice).

**Purchase analytics**:
- **Supplier Performance** — total purchases, on-time GRN %, variance % (ordered vs received), return rate.
- **Print Job Throughput** — jobs by printer, avg cost/unit, factory stock per printer.

**Inventory health**:
- **Slow & Dead Stock** — products with 0 sales in 60/90 days.
- **Stockout Risk** — uses existing reorder-alerts logic, surfaced as a report.
- **Stock Valuation by Batch** — extends existing batch report with cost × on-hand.

**Cash & ops**:
- **Daily Cash Position** — bank balances + cash drawer movement.
- **Expense Trend** — monthly expense by category, YoY.

All new reports = read-only pages using existing `fetchAllRows` + Recharts. Linked from the Reports landing page in new section groups.

## 6. Stock cross-check / audit page

New page `src/pages/StockAudit.tsx` (linked from Reports → Inventory):
- For every product, compute:
  - `derived_stock` = SUM(in movements) − SUM(out movements)
  - `live_stock` = `products.stock_quantity`
  - `variance` = live − derived
- Highlight any variance ≠ 0 (red row). Filters: only-variance, by category.
- Add a "Recalculate stock" button (admin-only): updates `products.stock_quantity = derived_stock` for selected rows via the migration tool. Logged to a new `stock_audit_log` table (date, user, product, old qty, new qty, reason).

Also cross-check:
- GRN-received vs PO-ordered variances → flagged in Supplier Performance report.
- Sales-dispatched vs Delivery Note dispatched → flagged in a small "Dispatch Gap" widget on the audit page.

## 7. Out of scope

- No rewrite of existing triggers beyond the SR/PR balance trigger swap.
- No multi-warehouse stock model (single-location still).
- No new auth/role changes; new audit page restricted by existing `useUserRole` admin check.

## Files

**Create**:
- `src/components/print-jobs/DispatchToSupplierDialog.tsx`
- `src/pages/DebitNotes.tsx`
- `src/lib/party-products.ts`
- `src/pages/StockAudit.tsx`
- `src/pages/reports/SalesTrend.tsx`
- `src/pages/reports/ProductPerformance.tsx`
- `src/pages/reports/Customer360.tsx`
- `src/pages/reports/AgentPerformance.tsx`
- `src/pages/reports/SupplierPerformance.tsx`
- `src/pages/reports/PrintJobThroughput.tsx`
- `src/pages/reports/SlowDeadStock.tsx`
- `src/pages/reports/StockoutRisk.tsx`
- `src/pages/reports/DailyCashPosition.tsx`
- `src/pages/reports/ExpenseTrend.tsx`

**Edit**:
- `src/pages/PrintJobs.tsx` (mount dispatch dialog)
- `src/pages/SalesReturns.tsx` + `src/components/sales/SalesReturnDialog.tsx` (auto credit-note)
- `src/pages/PurchaseReturns.tsx` (auto debit-note)
- `src/pages/ProformaInvoices.tsx` + sales-invoice form (product filter by customer)
- `src/pages/PurchaseProforma.tsx` + purchase-invoice form (product filter by supplier)
- `src/pages/Reports.tsx` (new sections)
- `src/pages/Settings.tsx` (link Debit Notes in Operations)
- `src/App.tsx` (routes for new pages)

**Migrations**:
1. Create `debit_notes` table + trigger `handle_debit_note_balance` (mirror credit_notes).
2. Drop `handle_sales_return_balance` and `handle_purchase_return_balance` triggers (auto-notes will own the balance impact).
3. Create `stock_audit_log` table with RLS.

## Question before I start

Triggers SR/PR currently update party balance. If I switch to auto-notes owning the balance, **any existing historical SR/PR will have already moved the balance once** — auto-creating notes for them retroactively would double-count. Plan: **apply auto-notes only to returns saved from now on** (existing returns untouched, no notes generated). Confirm OK or do you want me to also backfill credit/debit notes for past returns and skip the balance change?
