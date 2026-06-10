# Full ERP Audit + Refresh — Single Sweep

You picked the most aggressive option. To keep it from breaking your live tenant, the sweep runs as **one continuous job** but in a fixed safe order: **data integrity first, logic second, validation third, RLS/security fourth, seed data fifth, UI refresh last**. UI work never blocks data correctness.

⚠️ **Risk acknowledgement.** A heavy refresh + full sweep on a live, multi-tenant ERP with 60+ tables and 11+ triggers will produce regressions. I will run targeted reads + the linter after every batch and roll forward with fixes, but you should expect 1–2 follow-up turns to settle.

---

## A. Technical audit (Phase 1) — output as a findings doc

Single read-only pass producing `.lovable/audit/findings.md` with severity + file:line refs. Covers: TS errors, broken imports/routes, missing loading/empty/error states, N+1 queries, missing indexes, missing tenant-scoped uniques, RLS gaps, exposed config, public edge functions, missing validation, slow queries (via `supabase--slow_queries`), bundle-size offenders.

## B. Data integrity & logic (Phases 3 + 4) — migrations

One migration bundle that:

1. **Batch + expiry hard-required on sales lines.** Add `batch_no NOT NULL`, `expiry_date NOT NULL` on `sales_invoice_items` (after backfill from `grn_items` FIFO). Trigger `validate_sales_line_batch` rejects inserts referencing a batch with `quantity_on_hand < line.qty` or `expiry_date < invoice.date` unless `company_settings.allow_expired_sale = true`.
2. **Proforma / SO / PO never touch ledger or stock.** Audit triggers on `proforma_invoices`, `sales_orders`, `purchase_orders`, `purchase_proformas` — strip any balance/stock side-effect (your schema looks clean here; confirm + lock with a comment + test rows).
3. **Negative-stock guard universal.** Re-attach `prevent_negative_stock` to every `stock_movements` out-path. Add `allow_negative_stock` to `company_settings` for explicit override.
4. **Duplicate invoice number guard.** Tenant-scoped unique index on `(tenant_id, invoice_number)` for `sales_invoices` and `purchase_invoices` (already partial — verify, add where missing).
5. **Closed-period guard.** Trigger blocks insert/update on `sales_invoices`, `purchase_invoices`, `payments`, `journal_entries`, `expenses`, `salary_payments` when `accounting_periods.status = 'closed'` for the doc date.
6. **Posted-document edit guard.** Once `status IN ('approved','dispatched','paid','partial')`, only `void_document` may change it; direct UPDATE on financial columns raises.
7. **Double-submit guard (DB).** Idempotency key column on `sales_invoices` / `payments` with unique index — client sends a UUID per save.
8. **Reconciliation sweep.** Run `run_reconciliation(tenant, auto_fix:=true)` for your current tenant after the bundle.

## C. Reporting correctness (Phase 6)

For each report (P&L, Balance Sheet, Cash Flow, Receivables/Payables Aging, Stock Movement, Batch-wise, Item-wise, Sales Trend, Product Performance, Tax, Daily Cash, Customer/Supplier Ledger):
- Cross-check the page's aggregation against a Postgres-side `SELECT` over the same range.
- Fix any drift (ignore voided rows, ignore proforma/SO/PO in financial reports, use posted `date` not `created_at`, include credit/debit note applications in aging).

## D. RBAC + RLS (Phase 7)

- Re-check `role_capabilities` matrix vs each table's policies. Fix every table where a `sales_agent` could read another agent's customer's data through a JOIN (suspected: `sales_invoices` via customer_id, `payments`, `delivery_notes`).
- Audit edge functions for missing `getClaims` validation.
- Run `supabase--linter` and fix every Error-level finding from this sweep.

## E. Seed demo data (Phase 2) — into your current tenant

Inserts under the current tenant with names prefixed `DEMO-` so you can `DELETE WHERE name LIKE 'DEMO-%'` later: 5 customers, 5 suppliers, 20 products, 3 GRNs with batches + expiries, opening stock, 2 sales invoices (one paid one partial), 1 sales return, 1 delivery note, 1 purchase invoice, 1 purchase return, 1 customer payment, 1 supplier payment, 1 expense, 1 bank transfer, 1 credit note, 1 debit note. Then walks every report page and screenshots to confirm visibility.

## F. UI heavy refresh (Phase 5)

Because this is a heavy refresh, I will run the **design-direction ritual** (palette → typography → layout → 3 rendered directions → you pick one) for the core shell only: **dashboard, sidebar grouping, list-table pattern, invoice form, invoice PDF**. The chosen direction's tokens replace `index.css` + `tailwind.config.ts`. Every other page inherits.

Out of scope for the refresh: changing your existing precision-industrial brand identity unless your chosen direction overrides it.

## G. SaaS readiness

- `.env.example`, production README, `TEST_CHECKLIST.md`, `SEED.md` documenting the demo-data cleanup query.
- Confirm no secrets in repo (`rg` sweep).
- Add `Export tenant data` action (CSV bundle) to Settings — augments your weekly backup.

---

## Execution order in the sweep

```text
1. Read-only audit          → .lovable/audit/findings.md
2. Migration bundle B + D   → linter pass → reconciliation
3. Reporting fixes C        → cross-checked vs SQL
4. Seed demo data E         → screenshot walk
5. Design ritual F          → you pick 1 of 3 directions
6. Refresh tokens + shell   → cascade to pages
7. Docs G + final summary
```

## Final deliverable (Phase 8)

One `.lovable/audit/SUMMARY.md` covering: bugs found, files changed, logic fixed, demo entries created (+ cleanup query), screens tested, remaining risks, launch checklist.

---

## Things explicitly NOT changed

- Hub-based sequential generation of Sales/Purchase Invoices (you confirmed keep).
- Existing `void_document` + grace-window workflow.
- Existing audit_log structure and `logAudit()` API.
- Existing tenant model (`get_user_tenant_id` + `set_tenant_id` triggers).
- Pakistani CoA / GST / WHT rules.

Approve and I'll start with the read-only audit, then immediately roll into the migration bundle.
