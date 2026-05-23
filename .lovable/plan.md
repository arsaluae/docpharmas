## Phase 1 Accounting Hardening

Implement the three must-have compliance fixes from the audit. Scope is limited to Phase 1; double-entry GL (Phase 2) and bank reconciliation (Phase 3) are out of scope.

### 1. Period Locking

**New table `accounting_periods`** (tenant-scoped, RLS via `get_user_tenant_id()`):
- `period_start date`, `period_end date`, `is_locked boolean`, `locked_at`, `locked_by`, `lock_reason text`

**DB trigger `enforce_period_lock()`** attached to: `sales_invoices`, `purchase_invoices`, `payments`, `expenses`, `sales_returns`, `purchase_returns`, `goods_received_notes`, `credit_notes`, `debit_notes`, `salary_payments`.
- On INSERT/UPDATE/DELETE: if row `date` falls inside a locked period → `RAISE EXCEPTION 'Period locked: ...'`.
- Admin role bypass via `get_user_tenant_role() = 'owner'` + explicit override flag (skipped for now — owners just unlock the period).

**UI:** New page `src/pages/AccountingPeriods.tsx` (under Accounting menu) — list periods, Lock/Unlock buttons, restricted to `owner`/`admin` roles. Add route in `App.tsx` and nav entry.

### 2. COGS Cost Snapshot

**Schema:** `ALTER TABLE sales_invoice_items ADD COLUMN unit_cost numeric DEFAULT 0;`

**Trigger `snapshot_sales_item_cost()`** BEFORE INSERT on `sales_invoice_items`:
- If `NEW.unit_cost = 0 or NULL`, copy from `products.cost_price` at insert time.

**Backfill:** one-time UPDATE for existing rows where `unit_cost = 0`, set to current `products.cost_price` (best-effort, documented as historical estimate).

**Reports updated:**
- `dashboard_kpis()` SQL function: replace `quantity * COALESCE(p.cost_price,0)` with `quantity * COALESCE(sii.unit_cost, p.cost_price, 0)`.
- `src/pages/ProfitLoss.tsx`: switch COGS aggregation to `sii.unit_cost`.
- `src/pages/BalanceSheet.tsx`: same.

### 3. P&L / Balance Sheet Consistency

**Fix:** subtract salaries from Net Profit on `ProfitLoss.tsx` (currently only BS subtracts them). Align both reports to the same Net Profit formula:

```
Net Profit = Revenue − Sales Returns − COGS − Operating Expenses − Salaries − Tax
```

**Fix hard-coded GST in `BalanceSheet.tsx` line ~70:** read per-line `tax_rate` / `tax_amount` from invoice items instead of multiplying by 0.17.

### Files

**New:** `src/pages/AccountingPeriods.tsx`, 1 SQL migration (`accounting_periods` table + RLS + `enforce_period_lock` trigger + `unit_cost` column + `snapshot_sales_item_cost` trigger + backfill + updated `dashboard_kpis`).

**Edited:** `src/App.tsx` (route), `src/components/AppSidebar.tsx` or equivalent nav (menu entry), `src/pages/ProfitLoss.tsx`, `src/pages/BalanceSheet.tsx`.

### Out of Scope
- Double-entry journal posting (Phase 2)
- Bank reconciliation (Phase 3)
- FIFO/weighted-average costing (still snapshot-of-current-cost-at-sale-time)
- Fixed-asset module / Capital & Drawings accounts
