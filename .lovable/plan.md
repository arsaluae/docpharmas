# Performance & Reliability Fixes

Implement the 4 recommendations from the test report.

## 1. TenantContext — cache tenant lookup (kills 1–1.5s per navigation)

Currently every page that needs `tenant_id` or role re-queries `tenant_users`. We'll add a single provider that fetches once per session.

- New file: `src/contexts/TenantContext.tsx`
  - Fetches `tenant_users` once on auth state change
  - Exposes `{ tenantId, role, companyName, loading }` via `useTenant()`
  - Caches result in `sessionStorage` keyed by user id for instant warm reloads
- Mount `<TenantProvider>` inside `App.tsx` above the router (under existing auth provider)
- Update the 4–5 highest-traffic call sites that currently do their own `tenant_users` fetch (AppLayout, Index/dashboard, ProtectedRoute) to consume `useTenant()` instead. Leave other pages on their existing pattern for now — they'll naturally hit the cached `sessionStorage` value when they re-fetch since RLS is unchanged.

## 2. Lazy-load Recharts on the dashboard

Recharts is ~220 KB and currently blocks initial paint of `/dashboard`. Split the trend bar chart into its own module and load it lazily.

- New file: `src/components/dashboard/PerformanceTrendChart.tsx` — move the existing Recharts `<BarChart>` JSX out of `src/pages/Index.tsx`
- In `Index.tsx`, replace the inline chart with `const PerformanceTrendChart = lazy(() => import("@/components/dashboard/PerformanceTrendChart"))` wrapped in `<Suspense fallback={<div className="h-[180px]" />}>`
- Visual output unchanged

## 3. Realtime on stock_movements + sales_invoices + payments

So two-tab edits (the test case) reflect immediately without refresh.

- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements, public.sales_invoices, public.payments;`
- Also set `REPLICA IDENTITY FULL` on those three tables
- No client code changes required for this step — existing subscriptions will start receiving events. (Pages that want live updates can opt in later.)

## 4. Invoice draft autosave (Sales Invoice form)

Prevents the "refresh mid-form = data lost" failure mode for the most painful form.

- Locate the Sales Invoice creation form (under `src/pages/` or `src/components/sales/`)
- Add a `useEffect` that debounces (1s) and writes the current form state to `localStorage` under `draft:sales-invoice:<tenantId>`
- On mount, if a draft exists and the form is empty, show a small inline banner: "Restore unsaved draft from {time}?" with Restore / Discard buttons
- Clear the draft key on successful submit or on explicit Discard

## Out of scope

- Changing RLS, schema beyond the publication change
- Touching other forms (PO, GRN) — same pattern can be applied later if useful
- Production bundling/CDN changes (those happen automatically on publish)

## Files touched (estimate)

- New: `src/contexts/TenantContext.tsx`, `src/components/dashboard/PerformanceTrendChart.tsx`
- Edited: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/Index.tsx`, the Sales Invoice form file, possibly `ProtectedRoute`
- Migration: 1 SQL file (publication + replica identity)

## Verification

- Reload `/dashboard` cold → confirm `tenant_users` fetch fires once, not on every nav
- Network panel: Recharts chunk loaded as separate async chunk
- Open two tabs, change stock in one → second tab updates without refresh (if subscribed) or at minimum on next refresh continues working
- Fill 3 sales-invoice lines, refresh → restore banner appears
