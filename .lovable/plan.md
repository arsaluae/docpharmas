# Phase 2 — DB & Accounting Hardening

Goal: pristine schema baseline, immutable financial history (soft-void only), fast trial balance, deterministic balance recomputation, and automated reconciliation against drift.

## 1. Wipe-All Reset (one migration, gated)

A single migration `phase2_wipe_and_harden.sql` runs in this order:

1. **Truncate transactional + master tables** (CASCADE) in dependency order:
   - txn: payments, credit_note_applications, debit_note_applications, credit_notes, debit_notes, journal_lines, journal_entries, stock_movements, grn_items, goods_received_notes, delivery_notes, sales_invoice_items, sales_invoices, purchase_invoice_items, purchase_invoices, purchase_orders, sales_orders, proformas, quotations, expenses, agent_commissions, print_jobs, print_deliveries, print_rejections, additional_costs, audit_log, payment_submissions, accounting_periods
   - master: customers, suppliers, products, customer_distributors, customer_licenses, customer_products, city_products, agent_customers, drap_registrations, areas, freight_providers, bank_accounts, chart_of_accounts, expense_ledgers, document_templates, document_counters, company_settings
   - Preserve: tenants, profiles, user_roles, subscription/plan tables
2. Reset document_counters to 0 implicit via truncate.
3. Re-seed default chart_of_accounts + document_templates per tenant via existing seed functions.

Safety: migration begins with `DO $$ BEGIN IF (SELECT count(*) FROM sales_invoices) > 0 AND current_setting('app.allow_wipe', true) <> 'yes' THEN RAISE EXCEPTION 'wipe blocked'; END IF; END $$;` — user must set `app.allow_wipe='yes'` when running. (We confirmed full reset is acceptable.)

## 2. Soft-Void Everywhere

Phase 1 added soft-void for payments. Phase 2 extends:

- Add `status text NOT NULL DEFAULT 'active'`, `voided_at timestamptz`, `void_reason text`, `voided_by uuid` to: sales_invoices, purchase_invoices, sales_orders, purchase_orders, proformas, quotations, goods_received_notes (already has), delivery_notes, credit_notes, debit_notes, expenses, journal_entries, stock_movements.
- Rewrite `void_document(entity_type, entity_id, reason)` RPC to:
  - Set `status='voided'` (never DELETE).
  - Insert compensating `stock_movements` (reverse qty) instead of deleting movements.
  - Insert reversing `journal_entries` (swap debit/credit) referencing original.
  - Call `recompute_party_balance(party_type, party_id)` and `recompute_bank_balance(bank_account_id)` at the end.
- Block hard DELETE: triggers on the above tables that `RAISE EXCEPTION` on DELETE unless `current_setting('app.allow_purge', true) = 'yes'` (reserved for admin data-retention jobs only).
- All read queries / reports filter `status <> 'voided'` by default; ledgers show voided rows greyed with reversal link.

## 3. Trial Balance Materialized View

```sql
CREATE MATERIALIZED VIEW mv_trial_balance AS
SELECT
  jl.tenant_id,
  jl.account_id,
  coa.code, coa.name, coa.account_type,
  date_trunc('month', je.date)::date AS period,
  SUM(jl.debit)  AS debit,
  SUM(jl.credit) AS credit,
  SUM(jl.debit - jl.credit) AS net
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
JOIN chart_of_accounts coa ON coa.id = jl.account_id
GROUP BY jl.tenant_id, jl.account_id, coa.code, coa.name, coa.account_type, period;

CREATE UNIQUE INDEX ON mv_trial_balance (tenant_id, account_id, period);
CREATE INDEX ON mv_trial_balance (tenant_id, period);
```

- `refresh_trial_balance(tenant uuid)` RPC: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance`.
- pg_cron job every 15 min; also refreshed on-demand from the Reports page button.
- RLS on the MV via wrapper view `v_trial_balance` that filters `tenant_id = get_user_tenant_id()`.

## 4. Balance Recompute RPCs

Pure, idempotent functions rebuild derived balances from source-of-truth ledgers:

- `recompute_party_balance(p_party_type text, p_party_id uuid)` →
  opening_balance + Σ(active invoices) − Σ(active payments) − Σ(active credit_note_applications) + Σ(active debit_note_applications). Writes to customers.balance / suppliers.balance.
- `recompute_bank_balance(p_bank_id uuid)` → opening_balance + Σ(active inflow payments + bank deposits) − Σ(active outflow payments + expenses paid by bank).
- `recompute_account_balance(p_account_id uuid)` → Σ(debit − credit) from posted journal_lines, honouring account_type sign.
- `recompute_product_stock(p_product_id uuid)` → Σ stock_movements (excluding void compensations already netted).
- `recompute_tenant_all(p_tenant uuid)` → wraps the above for every entity (parallel-safe via advisory locks per tenant).

All are SECURITY DEFINER, `SET search_path = public`, called by triggers AND exposed for manual reruns.

## 5. Automated Reconciliation

New table `reconciliation_log`:

```
id, tenant_id, run_at, scope text,        -- 'party'|'bank'|'account'|'stock'
entity_id uuid, entity_label text,
stored_value numeric, computed_value numeric, drift numeric,
status text ('ok'|'drift'|'fixed'), notes text
```

- RPC `run_reconciliation(p_tenant uuid, p_auto_fix boolean default false)`:
  - For each entity scope, compares stored vs `recompute_*` result.
  - If drift > 0.01, inserts row; if `p_auto_fix`, writes corrected value and marks `fixed`.
- pg_cron nightly job per tenant with `p_auto_fix = false` (alert-only); admin UI button to run with `true`.
- New Settings → System Health page lists last 50 reconciliation rows with drift; one-click "fix all" runs auto-fix.

## 6. Period Lock Hardening

- Already triggers on journal_entries, stock_movements (Phase 1). Extend to: payments, sales_invoices, purchase_invoices, grn_items, expenses, credit_notes, debit_notes.
- Add `period_lock_override` role check via `has_role(auth.uid(),'admin')` so owners can unlock when needed.

## 7. Concurrency

- Wrap `void_document`, `recompute_*`, `generate_document_number` in `pg_advisory_xact_lock(hashtext(tenant_id::text || ':' || scope))` to prevent racing double-posts.

## 8. Linter Backlog (73 warnings)

Triaged in migration:
- Add missing indexes flagged by linter (mostly FKs added Phase 1).
- Fix `function_search_path_mutable` on remaining 18 SECURITY DEFINER functions (set `search_path = public`).
- Re-enable `leaked_password_protection` in auth config.
- Move 3 mutable-now() CHECKs to triggers.

## 9. Verification

After migration:
1. Run `run_reconciliation(<tenant>, false)` — expect zero rows (empty data).
2. Seed 1 invoice + 1 payment + 1 GRN via UI; rerun reconciliation — still zero drift.
3. Void that invoice via new RPC; confirm reversing journal + compensating stock movement created, party balance returns to opening, audit_log entries present.
4. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance` — debits == credits per tenant.
5. `supabase--linter` — zero ERROR-level findings.

## Deliverables

- `supabase/migrations/<ts>_phase2_wipe_and_harden.sql` (single migration, all of the above).
- `src/pages/SystemHealth.tsx` (reconciliation viewer + manual triggers).
- `src/lib/recompute.ts` (typed RPC wrappers).
- Update `src/lib/void.ts` to call new `void_document` signature and refresh affected react-query keys.
- Docs: `phase2-notes.md` with rollback steps.

## Approval Gate

After Phase 2 verification passes, I'll surface a short report and wait for go-ahead on Phase 3 (RBAC). Reply "go" to begin, or call out anything to change first.
