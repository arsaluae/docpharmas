## Goal
Make every page, panel, table, dialog, and chrome element feel like the same MOUJ editorial-precision system already shipped on the Dashboard — navy ink on warm off-white, single light-blue accent, hairline borders, no gradients, no glass, no neon, no rounded-2xl pillows, no decorative colored cards.

## Scope (every screen in /pages and every shared component in /components)
- Sales: Customers, ProformaInvoices, DeliveryNotes, WarrantyInvoices, SalesReturns, SalesAgents, CustomerLedger
- Purchase: Suppliers, PurchaseProforma, PurchaseReturns, SupplierLedger, LandedCosts
- Inventory: Products, StockMovements, StockAudit
- Printing: Printers, PrintJobs, PrinterLedger
- Finance: Payments, CreditNotes, DebitNotes, Expenses, Salaries, BankAccounts
- Reports hub + every `/reports/*` (CashFlow, ProfitLoss, TaxCompliance, ProductCosting, ReceivablesAging, PayablesAging, SupplierWise, SupplierPerformance, ItemWise, SlowDeadStock, DailyCashPosition, etc.)
- System: Reports index, AIInsights, Settings, DataImport, Couriers, Auth, ResetPassword, NotFound
- Shared: AppLayout header, AppSidebar, CustomerProfileDialog, SupplierProfileDialog, ProductBatchProfileDialog, PdfPreviewDialog, WhatsAppButton, VoidDocumentButton, PaginationControls, SearchableSelect, AreaSelect, AllocatedProducts, dashboard/* widgets, sales/*, settings/*

## Design rules (locked, from Dashboard)
- Surfaces: `bg-background` page, `bg-card` panels, `surface-2` wells. Never raw hex, never `bg-white`, never tailwind colored backgrounds.
- Border: every container = 1px `border-border` (hairline at navy/10). Radius = 4–6px max. No `rounded-2xl`, no `rounded-3xl`, no `rounded-full` on cards.
- Shadow: none. Remove `shadow-*` from cards, dialogs, buttons.
- Accent: only `--primary` (MOUJ light blue) and only on: active state rails, primary CTA, focused inputs, current data point in charts, "Live" pill. Never as a background wash on a whole card.
- Status: use `--success / --warning / --danger / --muted-foreground` tokens (already muted). Strip `text-emerald-600`, `text-amber-600`, `bg-rose-500/10` etc. and remap to semantic tokens.
- Typography: H1 32px Sora light, eyebrow uppercase 11px tracking 0.12em, body Manrope 13/14, all numbers `.data` (JetBrains Mono tabular-nums). Standardize page eyebrow + H1 pattern via AppLayout (already in place).
- Motion: 120–150ms ease-out only. No scale-on-hover, no translate-y, no blurs.

## Execution

### 1. Token-level cleanup (`src/index.css`)
- Delete legacy pastel chip + wash utilities (`.chip-peach…blush`, `.wash-*`) and the dashboard illustration leftovers.
- Tighten `.glass-card`, `.glass-kpi`, `.summary-card`, `.mesh-hero`, `.card-vibrant`, `.gradient-border`, `.premium-table-card`, `.ai-cta-card`, `.quick-action-card` shims so they render identical to `.panel` (bg-card + hairline + radius 6 + no shadow + no ::after gradient). Currently `.mesh-hero::after` still paints a primary radial — remove it.
- Add `.page-eyebrow`, `.page-h1`, `.section-title`, `.metric-num` utilities so every page uses the exact same type scale instead of one-off inline classes.
- Add `.kpi-rail` (the 2px left accent), `.divider-hairline`, `.table-precision` (hairline rows, 11px uppercase header, 13px tabular-num body) so tables across reports/ledgers look identical.

### 2. Sidebar (`src/components/AppSidebar.tsx`)
- Re-skin from current near-black to MOUJ navy (`--brand-navy`) with warm off-white text (`#F0EEE8`), hairline divider, light-blue active rail. This makes the chrome read as MOUJ instead of generic dark.
- Section labels = same eyebrow style as pages. Active item = 2px left rail in `--primary`, background `primary/10`, text in `--primary-foreground` reading.

### 3. Top header (`src/components/AppLayout.tsx`)
- Already on-system; only tweak: hairline-b under header, drop `backdrop-blur`, match eyebrow tracking to new `.page-eyebrow` token.

### 4. Per-page pass
For every page in Scope, apply the same checklist:
1. Replace `<Card className="glass-card …">` → `<Card className="panel">` and drop any `border-2 border-primary/30`, `bg-gradient-to-br`, `from-…`, `to-…`, `shadow-…`, `rounded-2xl/3xl`, `hover:scale-…`, `backdrop-blur-…`.
2. Replace tailwind color literals (`text-emerald-600`, `bg-amber-500/10`, `from-blue-500 to-indigo-600`, `bg-[#…]`) with semantic tokens (`text-success`, `bg-success/10`, `bg-primary`, `text-primary`). WhatsApp button stays brand green — only that one exception.
3. Numeric cells → `className="data"`. KPI numbers → 22–28px Sora, label → `.label-micro`.
4. Tables → `.table-precision` (already used on dashboard reorder/expiry).
5. Page header → `.page-eyebrow` + 32px H1 via AppLayout `title` prop (most pages already pass it; fix the few that render their own H1).
6. Empty states → single icon at 32px in `text-muted-foreground/60`, one line of 13px copy, no illustration, no pastel wash.
7. Status pills → existing `.status-pill` / `.status-active|quarantine|critical|completed` classes only.

### 5. Dialogs & overlays
- `CustomerProfileDialog`, `SupplierProfileDialog`, `ProductBatchProfileDialog`, `PdfPreviewDialog`, every `Dialog` in /components/sales and /components/settings: bg-card, hairline border, no gradient header strip, accent line via existing `.dialog-accent` only when needed. Replace `from-emerald-500/10 to-emerald-600/5` inner blocks with `.well` + token text colors.
- Toast/Sonner: confirm semantic tokens; no colored shadows.

### 6. Auth pages (`Auth.tsx`, `ResetPassword.tsx`)
- Same MOUJ canvas, centered card with hairline border, 32px Sora heading, single primary CTA, no gradient hero, no mesh background.

### 7. Charts
- Recharts across reports: navy axis `#0C2B5C @ 60%`, hairline grid `--border`, single primary `--brand-blue` series, comparison series in `foreground/40`. No multicolor palettes.

### 8. Verification
- After edits, `rg "gradient-|glass-|glow-|rounded-2xl|rounded-3xl|shadow-xl|shadow-2xl|from-(emerald|amber|rose|blue|indigo|violet|purple|pink|fuchsia|orange|sky|teal|cyan|green|red)-|text-(emerald|amber|…)-[0-9]"` should return 0 hits (except WhatsAppButton brand green).
- Visual sweep: capture Dashboard, Customers, ProformaInvoices, Reports/ProfitLoss, Settings, Auth, one dialog. All should share the same canvas, hairline, type, accent.

### Out of scope
- Backend, RLS, schema, data fetching, routes, business logic. Pure presentation.
- Dark mode tuning beyond what already exists.
- Mobile layout changes beyond what current responsive classes already cover.

### Files
Edited: `src/index.css`, `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`, every file in `src/pages/**`, every shared component listed above, `src/components/dashboard/**`, `src/components/sales/**`, `src/components/settings/**`.
