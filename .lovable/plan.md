# Full-System Audit & Optimization Plan

The request is broad, so this plan scopes work into measurable, code-level changes — not a vague "review everything" pass. Each item below corresponds to a concrete edit or verification.

## Scope summary

Top hotspots identified up front:
- `PurchaseProforma.tsx` (1,369 lines, 63 hooks), `ProformaInvoices.tsx` (1,285 / 57), `DataImport.tsx` (1,046), `Index.tsx` (766, dashboard with charts) — these are the main render-cost offenders.
- Only ~8 files in the project use `useMemo`/`useCallback`/`React.memo`. Most tables and forms re-render on every keystroke.
- No list virtualization anywhere; tables render every row.
- Multiple `useEffect` data-fetch chains without abort/cleanup.

---

## 1. Performance & Core Speed

**A. Memoize the heavy pages** (Index, PurchaseProforma, ProformaInvoices, DataImport, Customers, Suppliers, Products, Payments, Expenses, PrintJobs):
- Wrap derived arrays (filtered/sorted/searched rows, totals, chart series) in `useMemo`.
- Wrap row-level handlers (`onEdit`, `onDelete`, `onRowClick`) in `useCallback`.
- Extract row components and wrap in `React.memo` so typing in a search input does not re-render 500 rows.

**B. Hoist static data out of components**:
- Column definitions, status maps, enum arrays, chart configs currently re-created every render — move to module scope (`const COLUMNS = [...]`).

**C. List virtualization**:
- Add `@tanstack/react-virtual` to the 4 densest tables: Products, StockMovements, Payments, ProformaInvoices.
- Keep existing pagination as the default; virtualize only the "View all / large page-size" path.

**D. Dashboard (`Index.tsx`)**:
- Parallelize the sequential Supabase calls with `Promise.all` and batch via existing `src/lib/batch-fetch.ts`.
- Memoize Recharts data; charts re-render on every parent state change today.
- Add `React.lazy` for the AI Insights panel and Reports sub-pages.

**E. Effect hygiene**:
- Audit `useEffect` fetches across pages; add an `ignore` flag or `AbortController` so route changes don't `setState` on unmounted components.

**F. Bundle**:
- Code-split route-level pages in `App.tsx` via `React.lazy` + `<Suspense>`. Currently every page is eagerly imported.

## 2. RBAC Guardrails

The project has a two-tier role system (Owner/Admin vs Staff "Sales-only") per the memory note.

- Verify `useUserRole` is consulted in `AppSidebar` (currently it renders all sections to all users — confirm by reading).
- Add a server-side check (RLS already enforces this, but a client-side `<RoleGate role="admin">` wrapper prevents flashing restricted UI).
- On role change/logout, clear React Query / local caches so a Staff login does not see Admin data flashed from memory. Add `queryClient.clear()` (or equivalent) inside `useAuth` sign-out.
- Add a redirect guard in `ProtectedRoute` for routes Staff cannot access (Settings, BankAccounts, Salaries, Expenses, Reports).

## 3. Workflow & Modal Validation

- Audit "Convert proforma → invoice" and "Convert PO → Purchase Invoice" flows for synchronous state transition; wrap the multi-step DB writes in a single Supabase RPC or sequential awaits with rollback on failure.
- Replace ad-hoc `<Dialog>` confirmation patterns with the existing `AlertDialog` primitive so focus trap + ESC + backdrop-click behave consistently.
- Verify form reset: switch the largest forms (PurchaseProforma item rows, Settings) to `react-hook-form`'s `reset()` instead of manual `setState({...initial})` which currently leaves stale field refs.
- Toast timeouts: confirm `useToast` defaults are reasonable (currently 1,000,000 ms in shadcn default — lower to 5s).

## 4. Interface Mechanics

- Spacing/tokens: scan components for hard-coded hex / `text-white` / `bg-black` and replace with semantic tokens from `index.css`.
- Tabular numerals: add `font-variant-numeric: tabular-nums` utility for all numeric columns (currency, qty, balance).
- Sidebar responsive: verify `AppSidebar` collapses correctly at the user's 1061px viewport (just above the `md` breakpoint — likely fine, will confirm).
- Sonner toast auto-dismiss timing.

## Technical execution order

1. Add `@tanstack/react-virtual`, `react-window` types (or use existing primitives).
2. Route-level `React.lazy` in `App.tsx` (biggest single perf win, ~10 min).
3. Memoization pass on the 10 hottest pages.
4. Hoist static data out of components.
5. RBAC sidebar/route gating + cache clear on logout.
6. Form reset + modal focus-trap audit.
7. Token/tabular-nums sweep.
8. Verify: run `bun run build` for bundle size diff, smoke-test the dashboard and Proforma flows in the preview, and check `code--read_console_logs` for warnings.

## Out of scope

- No DB schema changes, no RLS edits (already audited and correct per security memory).
- No new features, no visual redesign (last turn's dark-mode uplift stands).
- No edge-function changes.

Estimated diff: ~15–20 files edited, 1 dependency added, no deletions.
