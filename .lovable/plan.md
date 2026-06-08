# Ledger redesign + Sales Agent scope lockdown

## Part A — Ledger redesign (Hero Outstanding direction)

Apply the picked direction to all three ledgers: **CustomerLedger**, **SupplierLedger**, **PrinterLedger** (same structure, party-appropriate copy).

### Structural moves (copy verbatim from selected prototype)
1. **Hero header band** — two-column row inside a single rounded container:
   - Left: small indigo-dot "Receivables Account" eyebrow + party name "/ Ledger" headline + meta line (city · phone · last activity).
   - Right: "Total Outstanding" eyebrow, then `PKR` in indigo + giant tabular-nums balance (text-5xl), followed by Export CSV + WhatsApp buttons.
2. **KPI + Aging band** (single bordered row, `grid-cols-3`):
   - cols 1-2: 4 KPI tiles (Total Sales, Received, Returns, Credit Notes) separated by hairline `border-r`, each with a 1px progress bar showing share of total.
   - col 3: rich Aging Distribution panel — segmented horizontal bar (0-30 / 31-60 / 61-90 / 90+) with widths proportional to bucket value, indigo for current, white/5 for empty buckets; numeric labels under each segment.
3. **Filter strip** — pill date range (All / 30d / 90d / Year) on the left, separator, type tabs as underlined indigo on active (All, Invoices, Payments, Returns, Credit Notes, Warranty); search input on the right with `⌘F` chip.
4. **Statement table** — sticky right "Running Balance" column with indigo tint and `border-l`; rows: date in mono, type as colored pill (indigo for invoices, emerald for payments, amber for returns, slate for opening), reference in mono. Whole row keyboard-focusable + click-to-open existing source entry (no behavior change, only styling).
5. **Footer**: "End of statement" lockup in uppercase widest tracking.

### Tokens
Use existing semantic tokens; no inline near-black or `bg-white/5` hexes — wrap with `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `bg-primary/10`, etc., so light + dark themes both render correctly. Geist Mono already loaded; just `font-mono tabular-nums` for numbers.

### Click-through (already wired, keep and verify)
- Sales Invoice → `/proforma?invoice=<id>` opening PDF preview directly (currently sends to `/?invoice=` — fix to land on the invoice's hub with preview auto-open).
- Payment Received/Made → `/payments?tab=<received|made>&highlight=<id>` (already correct; add subtle row highlight on landing).
- Sales/Purchase Return, Credit Note, Warranty Invoice → already routed; same query-param highlight pattern.

Update `Payments.tsx`, `ProformaInvoices.tsx`, `SalesReturns.tsx`, `PurchaseReturns.tsx`, `WarrantyInvoices.tsx`, `CreditNotes.tsx`, `DebitNotes.tsx` to read `?highlight=<id>` and auto-open the entry's preview/dialog (most already do; complete the missing ones).

## Part B — Sales Agent: pure sales-only access

User's intent: **only their assigned customers' sales activity. No cost, no financial reports, no inventory, no purchase, no finance, no admin.**

### RBAC matrix changes (`src/lib/rbac.ts`)
```
sales_agent: {
  sales:  { read: true, write: true },     // own customers only (RLS already enforces)
  master: { read: true },                  // for customer pages (filtered to assigned)
  // REMOVED: inventory, reports, purchase, finance, accounting, settings
}
```
Mirror the same trim into `staff` (the legacy alias).

### Sidebar (`AppSidebar.tsx`)
For `sales_agent` role, render only:
- **Dashboard** → swap to a sales-agent-specific view: their today/week/month sales, top customers, outstanding (no P&L, no purchases, no costs).
- **Customers** (auto-filtered by `agent_customers` mapping)
- **Sales Orders** (already filtered server-side via `is_agent_customer`)
- **Warranty Invoices**, **Sales Returns**, **Credit Notes** (for their customers only)
- **My Sales** report — single read-only page: invoices issued, payments received, outstanding by customer. NO costing, NO margin, NO purchase, NO P&L.

Hide entirely: Purchase, Inventory, Finance, Reports menu, Settings, Bank, Expenses, Salaries, Printers, Print Jobs, Landed Costs, AI Insights, Audit Log, Accounting Periods, Stock Movements.

### Page-level guards
Add `RequireCap` (or a new `RequireRole` excluding `sales_agent`) to:
- `/products` — block sales_agent
- `/stock`, `/landed-costs`, `/printers`, `/print-jobs`
- All `/reports/*` except a new `/reports/my-sales`
- `/payments`, `/bank`, `/expenses`, `/salaries`, `/credit-notes` (read only OK; write blocked)
- `/purchase-*`, `/suppliers`, `/purchase-returns`
- `/ai-insights`, `/audit-log`, `/accounting-periods`, `/system-health`

### Routes already protected
`Sales Orders`, `Warranty`, `Sales Returns`, `Customers`, `Customer Ledger` — keep, but ensure they continue to use the existing `is_agent_customer` RLS filter so agents only ever see their assigned customers.

### Dashboard fork
`Index.tsx` already exists for owners. Add a thin branch: if `tenantRole === 'sales_agent'`, render `<SalesAgentDashboard />` instead — KPIs: My Sales (today/week/month), My Customers count, My Outstanding receivables, recent invoices list. **Zero** purchase, cost, margin, expense, or company-wide data.

### My Sales report
New page `src/pages/reports/MySales.tsx`:
- Filter: month picker
- Table: invoice #, customer, date, total, paid, outstanding, status
- Totals row: total sales, total received, total outstanding
- That's it. No COGS column, no margin, no profitability.

## Deliverables
1. Rewrite `CustomerLedger.tsx`, `SupplierLedger.tsx`, `PrinterLedger.tsx` to the picked prototype layout using semantic tokens.
2. `rbac.ts` — trim `sales_agent` + `staff` matrices.
3. `AppSidebar.tsx` — role-aware section list for sales_agent.
4. `App.tsx` — route guards on every restricted page.
5. New `src/components/dashboard/SalesAgentDashboard.tsx` + branch in `Index.tsx`.
6. New `src/pages/reports/MySales.tsx` + route.
7. Highlight handler: ensure all linked hubs auto-open the right entry when `?highlight=<id>` is present.

## Out of scope
- Changing RLS policies (existing `is_agent_customer` already correctly scopes).
- New permissions UI in Settings → Team Members.
- Mobile-specific ledger restyling (desktop-first; existing responsive stack still applies).
