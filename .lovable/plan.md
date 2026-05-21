## Goals

Six focused enhancements:

1. Strip remaining glass/blur/glow from Sidebar + Auth → truly flat.
2. Sidebar brand: replace logo image with "MOUJ PHARMA" wordmark.
3. Add "Legacy ERP Import" flow (import historical data from old ERP).
4. Dashboard: clickable KPIs with detail popups (This Week, This Month, Gross Margin).
5. Replace "Overdue Invoices" KPI with "Upcoming Orders" (Purchase Orders), clickable.
6. Light polish pass on dashboard UI/UX.

---

## 1. Strip remaining glass/blur/glow (Sidebar + Auth)

Audit `src/components/AppSidebar.tsx`, `src/pages/Auth.tsx`, and the `.mouj-dark-sidebar` / `.mouj-dark-auth` blocks in `src/index.css`. Remove any residual:
- `backdrop-blur-*`, `bg-*/40`, `bg-*/60` translucent fills
- `shadow-*`, `glow-*`, `mesh-*`, `glass-*` utilities
- gradient utilities on rows, buttons, avatar
- soft 3px focus halos on inputs

Replace with solid `#0A0A1A` / `#141432` fills, 1px `#1F1F3D` borders, 1px focus ring `#4F46E5`.

## 2. Sidebar wordmark

In `AppSidebar.tsx`, replace the `<img src={moujLogo}>` in `.mouj-brand` with:
```
<span className="mouj-wordmark">MOUJ PHARMA</span>
```
Style in `index.css` scoped block — Sora 600, 14px, letter-spacing 0.14em, color `#EDEDF5`. Collapsed state shows just "M".

Auth page keeps the wordmark too (drop the image entirely, keep visual hierarchy with a larger 22px wordmark above "Welcome back").

## 3. Legacy ERP Import

Extend the existing `src/pages/DataImport.tsx` (already handles customers / suppliers / products / inventory via XLSX with alias mapping) with a new top-level mode **"Legacy ERP"** alongside the current entity tabs.

New tabs inside Legacy ERP mode:
- **Sales Invoices** — headers + items in two sheets (or single sheet with invoice_number grouping)
- **Purchase Bills** — same shape
- **Payments Received / Made**
- **Opening Balances** (customer/supplier outstanding ledger)

Implementation:
- Reuse the existing alias-mapping engine and preview/validation table.
- Add per-tab column maps + INSERT logic into `sales_invoices` + `sales_invoice_items`, `purchase_*`, `payments`, with `is_imported = true` flag and `imported_from` text column.
- Skip stock movements + GL postings for imported rows (treat as historical balances only) to avoid double-counting.
- Provide a downloadable XLSX template per tab (matches what most PK pharma ERPs export).

DB change: one migration adding `is_imported boolean default false` + `imported_from text` to `sales_invoices`, `purchase_invoices`, `payments`. No RLS changes needed (inherits tenant policies).

Add a banner in Dashboard / Settings: "Migrating from another ERP? → Import legacy data" linking to `/import?mode=legacy`.

## 4. Dashboard KPI popups

Make each of the four KPI cards a button that opens a `Dialog`.

**This Week → `WeekSalesDialog`**
- Lists this week's `sales_invoices`: columns Invoice #, Date, Customer, Amount.
- Row click → `navigate('/proforma?open=<invoice_id>')` (ProformaInvoices already supports opening a specific invoice; if not, add a `useEffect` watching `?open=` to auto-open the detail dialog).
- Footer: total + count.

**This Month → `MonthSalesDialog`**
- Same shape, scoped to current month, with a small day-by-day sparkline at top.

**Gross Margin → `GrossMarginDialog`**
- Per-product breakdown for the month: Product, Qty Sold, Revenue, COGS, GP, GP %.
- Sorted by GP desc; footer totals; small donut (Revenue vs COGS vs GP).
- Reuses data already fetched in `loadDashboard` (`monthItemsData` + `prodMap`) — lift into state so dialog can consume.

**Upcoming Orders → `UpcomingOrdersDialog`** (replaces Overdue)
- Lists open `purchase_invoices` where `status IN ('draft','ordered','confirmed')` and `expected_date >= today` (or just status-based if no expected_date), ordered by date asc.
- Columns: PO #, Supplier, Expected Date, Items (truncated), Amount, Status badge.
- Row click → `/purchase-proforma?open=<id>`.
- KPI card front shows: count + total value of upcoming POs.

All four dialogs styled as flat cards (match new design language): solid `bg-card`, 1px border, no glass.

## 5. Replace Overdue KPI

In `Index.tsx`:
- Remove `overdueCount` / `overdueAmount` state + the overdue query.
- Add `upcomingOrdersCount` / `upcomingOrdersValue` + matching query.
- Replace the 4th `kpiCards` entry: label "Upcoming Orders", icon `Truck`, value = total PKR value, extra line = "N orders pending".

## 6. UI/UX polish pass (dashboard only)

Tasteful, conservative — no theme rewrite:
- Tighten KPI card padding (p-5 → p-4), unify icon-bg to solid tint (drop gradient + glow shadows), add hover-lift `translate-y-[-1px]` + 1px border color shift to signal clickability.
- Mesh-hero: keep gradient but reduce intensity (lower opacity layer), tighten to p-5.
- Stagger-fade-up entrance already exists — keep.
- Quick action grid: collapse the 8 rainbow gradients into a single subdued palette (slate / primary with a single accent icon color per tile) for a calmer, more professional look.
- Section headers: consistent 13px uppercase tracked label + 1px hairline underline.
- Tables inside dialogs: zebra rows off, 1px hairline rows, right-aligned numerics, mono font for amounts.

---

## Technical notes

**Files to edit**
- `src/components/AppSidebar.tsx` — wordmark, strip residuals
- `src/pages/Auth.tsx` — wordmark, strip residuals
- `src/index.css` — `.mouj-wordmark`, scrub remaining glass utilities in scoped blocks
- `src/pages/Index.tsx` — KPI refactor, dialog wiring, upcoming orders query
- `src/components/dashboard/WeekSalesDialog.tsx` *(new)*
- `src/components/dashboard/MonthSalesDialog.tsx` *(new)*
- `src/components/dashboard/GrossMarginDialog.tsx` *(new)*
- `src/components/dashboard/UpcomingOrdersDialog.tsx` *(new)*
- `src/pages/DataImport.tsx` — Legacy ERP mode + new tabs + insert logic
- `src/pages/ProformaInvoices.tsx` + `src/pages/PurchaseProforma.tsx` — honor `?open=<id>` query param to auto-open detail
- `src/assets/mouj-logo.png` — no longer referenced (leave on disk)

**Database**
- One migration: add `is_imported boolean default false` and `imported_from text` to `sales_invoices`, `purchase_invoices`, `payments`. No data backfill needed.

**Out of scope**
- No changes to root `:root` tokens or `tailwind.config.ts`
- No changes to PDF templates, reports, or other pages
- No theme overhaul beyond the dashboard polish bullets above

After implementation I'll screenshot Sidebar + Auth + Dashboard to confirm the flat look and that KPI dialogs open and route correctly.