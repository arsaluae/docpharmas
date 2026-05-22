# Redesign — Phase 1 (foundation) ✅ shipped

**Locked decisions**
- Accent: electric indigo `#6366F1` / `#4F46E5` (user overrode brief's "no purple" with vibrant purple/blue)
- Type: Geist + Geist Mono (Google Fonts)
- Themes: both dark + light, redesigned
- Sequence: foundation → dashboard → page-by-page

**Shipped in Phase 1**
- `src/index.css` — full token rewrite (dark + light), Geist import, legacy class shims (`glass-card`, `glass-kpi`, `mesh-hero`, `summary-card`, `gradient-border` etc all → flat bg-card + hairline). Sora/Manrope removed.
- `tailwind.config.ts` — `font-sans/heading=Geist`, `font-mono=Geist Mono`, status color tokens, new motion timings.
- `src/components/AppLayout.tsx` — 48px borderless top bar (breadcrumb + CMD+K + date). Page header band with 32px light-weight h1 + right-aligned actions. 32px side padding.
- `src/components/AppSidebar.tsx` — kept `mouj-dark-sidebar` chrome, re-tinted via index.css to new indigo + warm off-white palette.
- Primitives rebuilt: `button.tsx`, `input.tsx`, `table.tsx`, `badge.tsx`, `card.tsx`, `PaginationControls.tsx`.
- New primitives: `status-pill.tsx`, `empty-state.tsx`, `skeleton-row.tsx`, `metric-card.tsx`.
- `src/lib/utils.ts` — `formatDateDDMMMYYYY`, `formatDateDDMMM`, `formatAmount`, `formatCompact`.
- Memory: `style/theme`, `style/typography`, `style/ui-patterns` rewritten.

# Phase 2 — Dashboard (next)

Rebuild the Dashboard as a Bloomberg-style terminal.
- Top row: 4 `MetricCard`s — Today's Sales, Open POs, Low Stock Alerts, Outstanding Receivables. Each with mono number, trend pill, sparkline.
- Middle row (60/40): Recent transactions table (10 latest sales orders, no decoration) | Inventory alerts (expiring within 60 days + below reorder level).
- Bottom: dense activity feed (last 20 system actions, git-commit-log density).
- Remove: greeting hero, "Good Afternoon" card, colorful quick-action grid, illustration heroes, pie/donut charts on primary content.

# Phase 3 — Per-page sweep (after Phase 2)
- Products, Sales hub (Customers/Proforma/Delivery/Warranty/Returns), Purchase hub, Finance (Payments/CreditNotes/Expenses/Salaries/Bank), Reports, Settings, Auth, PDF templates.
- Purge legacy class names (`glass-card`, `mesh-hero`, etc.) and replace with the new primitives directly.
- Replace bespoke empty states with `<EmptyState/>`. Replace ad-hoc status pills with `<StatusPill/>`. Replace table skeletons with `<SkeletonRow/>`.
- Wire `formatDateDDMMMYYYY` into every expiry/batch column.
- PDF: invoice template rebuild per brief (large light-weight invoice number, hairline rules, mono totals, 40px margins).
