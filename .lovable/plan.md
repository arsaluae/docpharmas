# Plan — Courier Expense Accounts + Net Price / MRP Split

Two independent changes. Both are additive — no existing records or ledger postings are touched.

---

## Part A — Courier / Freight Expense Accounts

### Goal
Track transport expenses against specific couriers (NCCS, ADDA, and any future ones the user adds), with a per-courier ledger and a monthly payment report.

### Data model
The `freight_providers` table already exists (currently only used for dispatch labels on delivery notes). I will reuse it as the master "Courier" list — no new table needed.

Migration:
- Add `expenses.freight_provider_id uuid` (nullable, FK → `freight_providers.id`, ON DELETE SET NULL, index on `(tenant_id, freight_provider_id, date)`).
- Seed `NCCS` and `ADDA` rows into `freight_providers` for the current tenant (idempotent — skipped if already present).

No change to `category` enum — couriers stay under the existing `transport` category, but the new FK pins the expense to a specific courier so the ledger and report can group on it.

### UI changes
1. **Expenses page (`src/pages/Expenses.tsx`)**
   - When `category = 'transport'`, show a **Courier** dropdown (lists active `freight_providers` + inline "Add new courier" that writes to the same table). Saved into the new `freight_provider_id` column.
   - Add a "Courier" filter chip beside the existing category filter.
   - Show the courier name in the expense list/table when present.

2. **Settings → Couriers card (`FreightProvidersCard.tsx`)**
   - Already supports add/disable/delete. Add a short helper line: "Used for both dispatch labels and courier expense tracking." No structural change.

3. **New report — `src/pages/reports/CourierExpenses.tsx`**
   - Route: `/reports/courier-expenses`, added under Reports hub.
   - Filters: date range (defaults to current FY), courier multi-select.
   - Table: month × courier matrix of paid amounts + grand totals row/column.
   - Drill-down: click a cell → opens dialog with the underlying expenses (date, expense #, description, amount, payment method).
   - Uses `ReportToolbar` for Excel/CSV/Print/Copy (per project rule). Excludes voided rows per the posted-only rule.

4. **Courier ledger (per-courier statement)**
   - Add a "View Ledger" action on each row in `FreightProvidersCard`.
   - Opens a dialog (or `/reports/courier-expenses?provider=<id>`) showing a chronological list of all expenses tagged to that courier with running total.

### RLS / RBAC
- `freight_providers` already has master read/write policies — no change.
- New `expenses.freight_provider_id` is just a column on `expenses`; existing expense RLS (accounting role, sa_deny) already covers it.

---

## Part B — Net Price (ledger) + MRP (display-only) on Products

### Current state
- `products.selling_price` (numeric, NOT NULL) — currently labelled "MRP" in the UI, used everywhere as the sales rate (hits all ledgers, taxes, COGS, GP).
- `products.mrp` (numeric, NOT NULL, default 0) — column already exists, partly read in `ProformaInvoices.tsx` as a "catalog MRP" hint but mostly unused. Never the basis for any calculation.

### Decision (matches the user's spec)
- Rename UI label `selling_price` → **"Net Price"**. This stays the source of truth for every calculation, invoice total, tax, COGS, payment, ledger posting, and report. No DB column rename (would break too much code); rename is **label-only**.
- Treat `products.mrp` as the true **Market Retail Price** — informational, printed on invoices, never used in math. Backfill: for tenants where `mrp = 0`, leave it at 0 and let the user fill it in (no automatic copy from `selling_price`, because the user said current values are net prices, not MRPs).

### UI changes
1. **Products page (`src/pages/Products.tsx`)**
   - Form: change "MRP (PKR) *" label → **"Net Price (PKR) *"** (still writes to `selling_price`). Add a second field **"MRP (PKR)"** that writes to `products.mrp` (optional, defaults 0, helper text: "Market retail price — printed on invoices only, not used in any calculation").
   - Table headers: `Cost | Net Price | MRP` (three columns; MRP shows "—" when 0).
   - Import templates: add `mrp` as an optional column.

2. **Quick-create dialog (`QuickCreateProductDialog.tsx`)**
   - Same relabel + add optional MRP field.

3. **Proforma / Sales Invoice / Delivery Note line editors**
   - Rate input keeps writing to `selling_price`-derived `rate`. Relabel header "Rate" tooltip → "Net Price". The "Above MRP" warning continues to compare `rate` against `products.mrp` (or against `selling_price` when MRP is 0, as a safe fallback).
   - In editor rows the existing "Catalog MRP" hint becomes authoritative — reads `products.mrp` only (no fallback to `selling_price` when MRP is set).

4. **Printed documents (PDFs)**
   - Proforma / Sales Invoice / Warranty Invoice / Delivery Note PDFs already have an "MRP" column — switch its source to `products.mrp` only. When `mrp = 0` it prints "—" (so legacy products without an MRP entered don't show a misleading net price as MRP).
   - Add a small footer note on the invoice template: "MRP shown for reference only. All amounts billed at Net Price."

### Calculations / ledger — explicitly UNCHANGED
- Sales invoice line `rate`, `amount`, GST, WHT, customer balance, COGS, GP, P&L, receivables, stock value — all continue to use `selling_price` (now relabelled Net Price). No trigger, RPC, or report SQL is modified.
- `products.mrp` does not appear in any aggregate, ledger, or report query.

### Migration
- No schema change required for Part B (`products.mrp` already exists). Single tiny migration ensures the column default stays `0` and adds a comment: `COMMENT ON COLUMN products.mrp IS 'Market retail price — display only, never used in calculations'`.

---

## Files touched

**Migration (single approval)**
- Add `expenses.freight_provider_id` + index, seed NCCS/ADDA, add MRP column comment.

**Code**
- `src/pages/Expenses.tsx` — courier dropdown, filter, list column.
- `src/components/settings/FreightProvidersCard.tsx` — helper line + "View Ledger" button.
- `src/pages/reports/CourierExpenses.tsx` *(new)* — monthly matrix + drill-down + export toolbar.
- `src/pages/Reports.tsx` — link the new report under "Operations / Expenses".
- `src/App.tsx` — route `/reports/courier-expenses` (gated by `reports:read`).
- `src/pages/Products.tsx` + `src/components/QuickCreateProductDialog.tsx` — relabel + add MRP input + table column.
- `src/pages/ProformaInvoices.tsx` (and the equivalent sales-invoice / delivery-note line editors) — MRP source = `products.mrp` only; footer note.
- `src/lib/pdf-generator.ts` (or template files under `useDocumentTemplates`) — print MRP from `products.mrp`, footer note.

**Out of scope** (will not change unless you ask)
- Renaming the `selling_price` DB column.
- Posting MRP to any ledger or report.
- Auto-populating `mrp` from `selling_price`.
- Per-courier accounts in `chart_of_accounts` (we use `freight_providers` + `expenses.freight_provider_id` for grouping — simpler and matches how the rest of the app does master-data grouping).

---

## Acceptance checklist
1. Settings → Couriers shows NCCS + ADDA; new couriers can be added.
2. Recording a transport expense lets you pick a courier; the expense saves with `freight_provider_id`.
3. `/reports/courier-expenses` shows month-wise totals per courier, exports to Excel/CSV, drills down to source expenses.
4. "View Ledger" on a courier opens its chronological statement.
5. Product form has separate **Net Price** and **MRP** fields; product list shows three columns (Cost / Net Price / MRP).
6. Sales invoice, proforma, delivery note PDFs print MRP from `products.mrp` only (blank when not set); all totals/taxes/ledger postings remain identical to today.
7. Voided expenses are excluded from the courier report (posted-only rule).