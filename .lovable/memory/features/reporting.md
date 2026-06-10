---
name: Reports — posted-only rule and export toolbar
description: Every report excludes draft/voided/cancelled rows; uses shared Excel/CSV exporter with company+user header block
type: feature
---
Hard rule (locked 2026-06-10 by user): every report query against `sales_invoices`, `purchase_invoices`, `sales_returns`, `purchase_returns`, `payments`, `expenses`, `credit_notes`, `debit_notes` MUST chain `.not("status","in","(draft,voided,cancelled)")`. `salary_payments` has NO status column — do not add the filter there.

Sales/purchase orders and proformas live in separate tables and are excluded by construction. Stock from drafts/voids never moves because triggers respect status.

Source-of-truth RPCs (security-definer, tenant-scoped, granted only to `authenticated`):
- `report_profit_loss(p_from date, p_to date) returns jsonb` — same COGS formula as `dashboard_kpis` so totals agree.
- `report_sales_summary(p_from, p_to, p_customer uuid, p_product uuid, p_city text) returns jsonb`.
- `report_receivables_aging(p_as_of date) returns table(...)`.
- `report_payables_aging(p_as_of date) returns table(...)`.

Export pattern: use `<ReportToolbar/>` (`src/components/reports/ReportToolbar.tsx`) wired into `headerActions`. It emits Excel, CSV, Copy, Print using `src/lib/reports/{excel,csv,meta}.ts`. The exporter writes company name, report title, date range, filters, generated-by/at, frozen header row, and a bold totals row. Tests assert totals row matches on-screen totals.

When adding a new report, always pass `dateRange` and `filters` to `ReportToolbar` so the export header reflects what's on screen. For tables, also render an on-screen totals footer row that matches `totalsRow` so the exports stay in sync.
