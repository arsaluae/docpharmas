

# Scalability Audit & Weekly Backup — 100 Users, 2 Years of Data

## The Problem

With 100 tenants generating 2 years of transactional data, the current architecture has several critical bottlenecks that will cause failures or extreme slowness.

## Audit Findings

### Critical Issue 1: No Pagination — Every Page Loads ALL Records

Almost every page does `select("*")` with no `.limit()` or pagination. The default Supabase limit is 1000 rows. With 2 years of data per tenant:

| Table | Est. rows/tenant (2yr) | Current behavior |
|-------|----------------------|------------------|
| stock_movements | 10,000-50,000 | Loads ALL at once |
| sales_invoices | 2,000-10,000 | Loads ALL at once |
| purchase_invoices | 1,000-5,000 | Loads ALL at once |
| payments | 2,000-8,000 | Loads ALL at once |
| expenses | 500-2,000 | Loads ALL at once |
| proforma_invoices | 2,000-10,000 | Loads ALL at once |

**Impact**: Pages will silently truncate at 1,000 rows (data loss in UI), browser will freeze on large datasets, and reports will be wrong.

### Critical Issue 2: Reports Fetch Entire History Client-Side

`BalanceSheet.tsx`, `ProfitLoss.tsx`, `CashFlow.tsx` etc. pull ALL invoices, ALL payments, ALL expenses to the browser and sum them in JavaScript. With 2 years of data this means transferring megabytes of JSON and doing heavy computation client-side.

### Critical Issue 3: Dashboard Fires 12 Parallel Unbounded Queries

`Index.tsx` fires 12 parallel queries on every load, several without date bounds (customers, products, suppliers select ALL).

### Critical Issue 4: Ledger Pages Load Full Transaction History

Customer/Supplier/Printer ledgers do `select("*")` on all invoices, payments, and returns for a party — no date filtering.

### Critical Issue 5: No Data Backup System

No automated backup exists. The existing "Data Backup" feature is a manual Excel export that will timeout with large datasets.

---

## Plan

### Phase 1: Server-Side Pagination for All List Pages

Add cursor-based pagination (page number + page size) to these pages:

| Page | Changes |
|------|---------|
| `StockMovements.tsx` | Add `.range(from, to)` with page controls |
| `ProformaInvoices.tsx` | Add `.range()` pagination |
| `PurchaseProforma.tsx` | Add `.range()` pagination |
| `Payments.tsx` | Add `.range()` pagination |
| `Expenses.tsx` | Add `.range()` pagination |
| `PrintJobs.tsx` | Add `.range()` pagination |
| `Customers.tsx` | Add `.range()` pagination |
| `Suppliers.tsx` | Add `.range()` pagination |
| `Products.tsx` | Add `.range()` pagination |
| `DeliveryNotes.tsx` | Add `.range()` pagination |

Each page will:
- Default to 50 rows per page
- Show prev/next controls with total count
- Use `.range(start, end)` on the Supabase query
- Add a `{ count: 'exact', head: false }` to get total count

### Phase 2: Move Report Aggregations to Database Functions

Create database functions that do SUM/GROUP BY server-side instead of pulling all rows:

- `get_balance_sheet(as_of_date)` — returns aggregated totals
- `get_profit_loss(from_date, to_date)` — returns revenue, COGS, expenses
- `get_cash_flow(from_date, to_date)` — returns grouped flows
- `get_dashboard_stats(tenant_id)` — returns KPIs in one call

### Phase 3: Optimize Dashboard

- Combine the 12 dashboard queries into 1-2 database functions
- Add date bounds to all queries
- Cache results with React Query (staleTime: 5 minutes)

### Phase 4: Paginate Ledger Pages

- Add date range filter (default: last 3 months) to Customer/Supplier/Printer ledgers
- Add pagination within the filtered range

### Phase 5: Automated Weekly Backup (Edge Function + Cron)

Create a `weekly-backup` edge function that:
1. Runs every Sunday at 2 AM via `pg_cron`
2. For each active tenant, exports all tables to JSON
3. Stores compressed backup in a `tenant-backups` storage bucket
4. Keeps last 8 backups (2 months rolling)
5. Logs backup status to a `backup_logs` table

Database changes needed:
- Create `backup_logs` table (tenant_id, status, file_url, size_bytes, created_at)
- Create `tenant-backups` private storage bucket
- Enable `pg_cron` and `pg_net` extensions
- Schedule the cron job

### Phase 6: Add React Query Caching

Wrap all data fetching with `@tanstack/react-query` (already installed) to:
- Prevent duplicate requests
- Cache data with appropriate staleTime
- Show stale data while revalidating

---

## Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/functions/weekly-backup/index.ts` | Create — backup edge function |
| DB migration | Create aggregation functions + backup_logs table |
| DB migration | pg_cron schedule |
| `src/pages/StockMovements.tsx` | Add pagination |
| `src/pages/ProformaInvoices.tsx` | Add pagination |
| `src/pages/PurchaseProforma.tsx` | Add pagination |
| `src/pages/Payments.tsx` | Add pagination |
| `src/pages/Expenses.tsx` | Add pagination |
| `src/pages/PrintJobs.tsx` | Add pagination |
| `src/pages/Customers.tsx` | Add pagination |
| `src/pages/Suppliers.tsx` | Add pagination |
| `src/pages/Products.tsx` | Add pagination |
| `src/pages/DeliveryNotes.tsx` | Add pagination |
| `src/pages/reports/BalanceSheet.tsx` | Use DB function |
| `src/pages/reports/ProfitLoss.tsx` | Use DB function |
| `src/pages/reports/CashFlow.tsx` | Use DB function |
| `src/pages/Index.tsx` | Optimize dashboard queries |
| `src/pages/CustomerLedger.tsx` | Add date filter + pagination |
| `src/pages/SupplierLedger.tsx` | Add date filter + pagination |
| `src/pages/PrinterLedger.tsx` | Add date filter + pagination |
| `src/pages/Settings.tsx` | Add backup status section |

This is a large change set. I recommend implementing in phases — Phases 1-2 first (pagination + report functions), then 3-4 (dashboard + ledgers), then 5-6 (backup + caching).

