# Speed & Performance Optimization Plan

Goal: make the app feel instant — faster dashboards, faster reports, faster navigation between pages — without changing any business logic, UI, or workflows.

I found three real bottlenecks: missing database indexes, no client-side caching (every page re-queries on each visit), and reports/dashboard pulling thousands of rows to compute totals in the browser.

## 1. Database — add missing indexes (biggest win)

Right now `sales_invoices`, `payments`, `purchase_invoices`, `expenses`, `sales_invoice_items` only have primary-key indexes. Every dashboard / report query does a full table scan.

Add indexes via migration:
- `sales_invoices(date)`, `sales_invoices(customer_id)`, `sales_invoices(tenant_id, date)`, `sales_invoices(status)`
- `sales_invoice_items(invoice_id)`, `sales_invoice_items(product_id)`
- `purchase_invoices(date)`, `purchase_invoices(supplier_id)`, `purchase_invoices(status)`
- `purchase_invoice_items(invoice_id)`, `grn_items(product_id)`, `grn_items(expiry_date)`
- `payments(party_id, party_type, type)`, `payments(invoice_id)`, `payments(date)`
- `expenses(date)`, `expenses(category)`, `expenses(bank_account_id)`
- `purchase_proformas(status)`, `proforma_invoices(status)`
- `stock_movements(date)`, `stock_movements(movement_type)`
- `customers(tenant_id)`, `suppliers(tenant_id)`, `products(tenant_id)`

Expected impact: 5–50× faster queries on tables with >1k rows. No behavior change.

## 2. Dashboard — server-side aggregation RPCs

`Index.tsx` currently runs 12 queries in parallel, then a second wave that pulls every `sales_invoice_items` row of the month in 50-id batches just to compute totals. For a busy month this can be 500+ rows transferred to compute one Gross Margin number.

Create two Postgres RPCs (security definer, tenant-scoped via `get_user_tenant_id()`):
- `dashboard_kpis(p_from date, p_to date)` → returns week/month/year subtotals, gross profit, COGS, receivables, payables, upcoming PO count/value, last-month subtotal — all in one round trip.
- `dashboard_charts(p_from date, p_to date)` → daily sales series, top products, top customers, expenses by category.

Frontend change: replace 12+N queries with 2 RPC calls. No UI change, no KPI calculation change (same formulas, just executed in SQL).

Same approach for the heavy reports:
- `report_customer_wise()`, `report_supplier_wise()`, `report_item_wise()`, `report_batch_wise()`, `report_receivables_aging()`, `report_payables_aging()` — each returns the already-grouped result instead of dumping raw rows.

The `fetchAllRows` helper stays for cases that genuinely need raw data (exports).

## 3. Client-side caching with React Query

QueryClient is configured (60s staleTime) but **no page uses it** — every navigation triggers fresh `supabase.from(...)` calls inside `useEffect`. Switching between Customers ↔ Invoices ↔ Dashboard re-downloads the same data each time.

Convert the read paths of frequently-visited pages to `useQuery` with stable keys:
- Dashboard (`['dashboard-kpis']`, `['dashboard-charts']`, `['reorder-alerts']`, `['expiry-alerts']`)
- Customers, Suppliers, Products list pages
- ProformaInvoices, PurchaseProforma list pages
- Sidebar/Tenant/CompanySettings hooks
- Reports

Mutations (create/update/delete) call `queryClient.invalidateQueries` so data stays correct. No business logic changes, no UI changes — only the data-fetching wrapper changes.

Expected impact: instant back-navigation, no flash of loading state on revisit.

## 4. Code-splitting & lazy heavy modules

`App.tsx` already lazy-loads routes. Remaining wins:
- Lazy-import `pdf-generator.ts`, `PdfPreviewDialog`, `jspdf`, `html2canvas` only when the user clicks Print/Share (these are large and currently pulled into common chunks).
- Lazy-import `recharts` chart wrappers inside dashboard sections via `React.lazy`.
- Add `vite.config.ts` `build.rollupOptions.output.manualChunks` to split `recharts`, `framer-motion`, `xlsx`, `jspdf` into their own chunks so the main bundle shrinks.
- Lazy `CommandPalette` (only mounts on Ctrl+K).

## 5. Parallelize the remaining N+1 patterns

A few places still loop `await` over batches (`KpiDialogs.tsx`, `Customers.tsx`, `Suppliers.tsx`, `Index.tsx`). Change `for (let i…) { await … }` to `Promise.all(chunks.map(c => supabase…))`. Once the RPCs in §2 land, most of these disappear entirely.

## 6. Memoization & render hygiene

- Wrap heavy chart-data transforms in `useMemo` (dashboard daily sales, expense categories, top customers).
- Memoize Sidebar nav and KPI cards with `React.memo` so dashboard re-renders during data load don't re-render the shell.
- Debounce the search inputs (Customers, Suppliers, Products) — currently each keystroke fires a query.

## 7. Prefetch on hover

In `AppSidebar` and main nav links, prefetch the route's chunk on `mouseenter` (`import()` the lazy module). Makes navigation feel instant on desktop.

## Out of scope (not touched)

- No UI/visual changes
- No new features
- No changes to triggers, RLS, or business rules
- No edge-function changes
- No auth/signup flow changes

## Technical summary

```text
DB:           ~25 indexes via migration
RPCs:         dashboard_kpis, dashboard_charts, report_* (~7 functions)
Frontend:     useQuery on ~12 pages, lazy pdf/recharts, manualChunks,
              memo on dashboard, debounce search inputs, prefetch on hover
Files:        src/pages/Index.tsx, src/pages/Customers.tsx,
              src/pages/Suppliers.tsx, src/pages/Products.tsx,
              src/pages/Proforma*.tsx, src/pages/Purchase*.tsx,
              src/pages/reports/*.tsx, src/hooks/useTenant.tsx,
              src/hooks/useCompanySettings.tsx, src/components/AppSidebar.tsx,
              src/components/AppLayout.tsx, src/components/PdfPreviewDialog.tsx,
              src/lib/pdf-generator.ts, vite.config.ts
```

Rollout order: indexes → dashboard RPC + useQuery (biggest perceived win) → report RPCs → lazy chunks → memoization/prefetch.
