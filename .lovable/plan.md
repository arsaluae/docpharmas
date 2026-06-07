## Scope locked

- **Target**: 10–50 Pakistani pharma tenants. Not 10k. So: shared Postgres, RLS isolation, no sharding.
- **Accounting**: keep subledger model (customers/suppliers/printers/banks + CoA + manual journals). No auto-journal posting on every txn. Fix bugs and tighten reports only.
- **Breaking changes**: allowed, including data reset. Migrations don't need to preserve prod rows.
- **Out of scope** (explicitly): generic ERP de-pharma-fication, IFRS engine, multi-currency, branches/warehouses, sharding, ERPNext/Odoo parity.

## Phase 1 — Audit & critical-fix sprint (Week 1)

Deliverable: written findings doc + immediate fixes for anything Critical/High.

Areas I'll audit with file:line citations:

1. **RLS correctness** — every public table has tenant policy + GRANTs; no policy uses `auth.uid()` directly; `set_tenant_id` trigger on every insert path. Confirm no table is missing RLS.
2. **Accounting integrity bugs** — 3 known smells to verify:
   - Subledger balance triggers double-count when an invoice is voided then re-confirmed
   - `recalc_customer_invoice_status` allocates direct + general payments but doesn't cap at outstanding when both exist on same invoice
   - `void_document` hard-deletes payments — loses audit trail
   - Period-lock trigger not attached to every txn table
3. **Stock integrity** — `prevent_negative_stock` only fires on stock_movements insert; manual UPDATEs to `products.stock_quantity` bypass it. Lock direct updates.
4. **Performance hot paths** — reports doing N+1 (SupplierWise/ItemWise pull 4 full tables), `fetchAllRows` with no tenant filter relies on RLS only (correct but slow at 100k rows), `dashboard_kpis` not indexed on `(tenant_id, date)`.
5. **Security** — public storage buckets (`shared-documents`, `company-assets`) — confirm intentional; `payment_submissions` admin policy uses `has_role` (good); audit-log immutability triggers present.
6. **Bundle/perf** — measure current LCP, identify unlazy-loaded heavy deps.

## Phase 2 — Database & accounting hardening (Week 2)

Migration set (single reset, no backfill):

- Add **indexes**: `(tenant_id, date)` on sales_invoices, purchase_invoices, payments, expenses, stock_movements, journal_entries; `(tenant_id, customer_id)`, `(tenant_id, supplier_id)`; partial indexes for `status != 'voided'`.
- **FK constraints** — every `tenant_id`, `customer_id`, `supplier_id`, `product_id`, `invoice_id` gets a real FK with appropriate ON DELETE behavior. Currently zero FKs in DB.
- **Period-lock trigger** attached to: sales_invoices, purchase_invoices, payments, expenses, journal_entries, stock_movements, credit_notes, debit_notes, salary_payments.
- **Void hardening**: `void_document` switches payments to soft-void (status='voided' + reversal stock_movement) instead of hard delete. Adds journal-reversal entry when source had one.
- **Balance recompute RPC**: `recompute_party_balance(party_type, party_id)` that nukes and rebuilds from txns — admin-only, for fixing drift.
- **Trial balance view**: materialized view `mv_trial_balance` refreshed nightly.
- **Concurrency**: `document_counters.UPDATE … RETURNING` is already atomic; add advisory lock on tenant + doc_type to prevent gap-skip under burst.

## Phase 3 — RBAC expansion (Week 3)

Current: `owner` / `staff` only. Expand to:

```text
super_admin  → cross-tenant, your account only
owner        → full tenant access
accountant   → finance hubs + reports, no master data delete
sales_mgr    → sales hub + customers + reports
sales_agent  → own customers only (filtered by agent_customers)
inventory    → products, stock, GRN, expiry
purchase_mgr → purchase hub + suppliers + printers
viewer       → read-only everything
```

- New `app_role` enum values + `permissions` table (`role`, `resource`, `action`) seeded with matrix.
- `has_permission(uid, resource, action)` SECURITY DEFINER fn.
- Route-level + button-level guards via `usePermission()` hook.
- Sales-agent data filter: `customers` policy adds `OR EXISTS (agent_customers WHERE agent_id = current_agent())`.
- Settings → Team Members UI to assign roles.

## Phase 4 — UI/UX rebuild (Weeks 4–5)

Keep precision-industrial design system. Rework:

- **Global shell**: collapsible sidebar with role-filtered nav, breadcrumbs, global search (Ctrl+K already exists — extend to invoices/payments/products), tenant switcher placeholder for future.
- **Dashboard**: role-aware widgets. Replace single dashboard with templates per role.
- **Data tables**: replace ad-hoc tables with one `<DataTable>` primitive — server pagination, column visibility, saved views, CSV export, row-virtualization (>200 rows), sticky header, bulk actions.
- **Forms**: shared `<DocumentForm>` for the 6 invoice/PO/GRN/payment patterns — keyboard nav (Tab/Enter advance, Esc cancel, Ctrl+S save), inline party-create, auto-calc with debounce.
- **Mobile**: stacked-card views already exist for <640px — extend to remaining 8 list pages.
- **Empty states + skeletons** standardized.
- **A11y pass**: aria-labels on icon buttons, focus rings, `h-dvh` over `h-screen`.

## Phase 5 — Performance pass (Week 6)

- Convert all reports to SQL RPCs returning pre-aggregated JSONB (kill client-side `fetchAllRows` → `reduce`).
- Add `react-window` to tables >100 rows (Customers, Products, Stock).
- Code-split heavy deps (xlsx, recharts already chunked; add pdf-generator dynamic import).
- Tanstack Query: tune `staleTime` per resource class (master data 5min, txns 30s).
- Targets: dashboard <1s, list pages <2s, reports <3s on Pakistan mobile 4G.

## Phase 6 — SaaS billing & ops (Weeks 7–8)

- **Subscription plans**: Starter (1 user, 1k invoices/mo), Growth (5 users, 10k/mo), Pro (15 users, unlimited). PKR pricing.
- Keep current bank-transfer payment_submissions flow — add admin review UI improvements + auto-email on approval.
- **Usage metering**: monthly txn count via cron, soft-block at 110%.
- **Trial**: 14-day full-access, then read-only until plan picked.
- **Tenant lifecycle**: suspend, reactivate, hard-delete with backup export.
- **Email**: setup email infra (transactional + auth) with custom domain.
- **Backups**: weekly pg_cron already exists — add per-tenant manual export to CSV/zip.
- **Onboarding wizard**: 4 steps (company info, CoA template, opening balances, first user) — gates dashboard until done.

## Technical details

- All migrations idempotent + reversible where possible.
- Each phase ends with: linter clean, security scan clean, manual smoke test of 10 core flows.
- Memory files updated per phase so the rules persist.
- No new third-party services; stay on Lovable Cloud + Gemini.

## How we execute

Each phase = one approval gate. After you approve a phase, I implement, deploy, you test on real data, then we move on. If a phase finds something that changes a later phase's assumptions, we re-plan that phase only — not the whole roadmap.

## Estimated effort

| Phase | Days | Risk |
|---|---|---|
| 1 Audit + critical fixes | 3–4 | Low |
| 2 DB + accounting | 4–5 | **High** — triggers touch every flow |
| 3 RBAC | 3 | Medium |
| 4 UI rebuild | 8–10 | Medium |
| 5 Perf | 3 | Low |
| 6 SaaS billing | 5–6 | Medium |

Total: ~6–8 weeks of focused work.

## What I need from you before Phase 1 starts

1. Confirm: when you say "full reset", you mean I can wipe your current data when running Phase 2 migrations? Or just that schema can change but I should write a backfill script?
2. The 9 roles above — keep all or drop any?
3. Pricing tiers — your numbers or my placeholders?
