## Goal

Build a **Sandbox / UAT mode** that gives an owner (or any user granted `can_use_sandbox`) a fully isolated copy of the workspace to test Sales Agent → Orders → Invoices → DN → Payments → Ledger → Stock → Reports, with **one-click cleanup** that leaves production untouched.

Implementation uses a **second tenant** ("sandbox tenant") rather than per-row flags. This is the only design that guarantees production stock/ledger/balances/reports are untouchable — the existing RLS, triggers, and reports already isolate per tenant, so we get isolation for free.

---

## Architecture

```text
auth.users (one user)
   │
   ├── tenant_users → tenant A (PRODUCTION)   ← all real data
   │
   └── tenant_users → tenant B (SANDBOX)      ← all test data
                       │ tenants.is_sandbox = true
                       │ tenants.parent_tenant_id = A.id
                       │ tenants.sandbox_session_id = uuid
```

Switching modes = switching which tenant `get_user_tenant_id()` returns for this session. Everything else (RLS, balance triggers, stock triggers, document numbering, reports, audit log) keeps working unchanged.

---

## Part 1 — Schema (one migration)

### 1.1 Mark sandbox tenants

```sql
ALTER TABLE public.tenants
  ADD COLUMN is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN parent_tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN sandbox_session_id uuid,
  ADD COLUMN sandbox_created_by uuid REFERENCES auth.users(id),
  ADD COLUMN sandbox_created_at timestamptz;

CREATE INDEX tenants_parent_idx ON public.tenants(parent_tenant_id) WHERE is_sandbox;
```

### 1.2 New RBAC capability

```sql
INSERT INTO public.role_capabilities (role, resource, can_read, can_write, can_void, can_approve)
VALUES ('owner', 'sandbox', true, true, true, true)
ON CONFLICT DO NOTHING;
-- staff/sales_agent get nothing — owner only by default.
-- Owner can later grant via a per-user flag (see 1.3).
```

### 1.3 Per-user grant (optional capability beyond owner)

```sql
ALTER TABLE public.tenant_users
  ADD COLUMN can_use_sandbox boolean NOT NULL DEFAULT false;
```

`current_user_can_sandbox()` security-definer fn returns `true` if role='owner' OR `can_use_sandbox=true`.

### 1.4 Active-tenant switching

Replace `get_user_tenant_id()` so it reads a session GUC first:

```sql
CREATE OR REPLACE FUNCTION public.get_user_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_override uuid;
BEGIN
  -- Per-session override (set by set_active_tenant RPC).
  BEGIN v_override := nullif(current_setting('app.active_tenant', true),'')::uuid;
  EXCEPTION WHEN others THEN v_override := NULL; END;

  -- Only honour the override if user actually belongs to that tenant.
  IF v_override IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_users
     WHERE user_id = auth.uid() AND tenant_id = v_override AND is_active
  ) THEN
    RETURN v_override;
  END IF;

  RETURN (SELECT tenant_id FROM public.tenant_users
           WHERE user_id = auth.uid() AND is_active
           ORDER BY created_at ASC LIMIT 1);
END $$;
```

RPC the client calls on every page load / after toggling:
```sql
CREATE OR REPLACE FUNCTION public.set_active_tenant(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_tenant IS NULL THEN
    PERFORM set_config('app.active_tenant','', false); RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tenant_users
                  WHERE user_id=auth.uid() AND tenant_id=p_tenant AND is_active) THEN
    RAISE EXCEPTION 'not a member of tenant %', p_tenant;
  END IF;
  PERFORM set_config('app.active_tenant', p_tenant::text, false);
END $$;
```

### 1.5 Session helpers

```sql
-- Create / fetch / delete the caller's sandbox tenant for the current PROD tenant.
CREATE FUNCTION public.sandbox_create_session() RETURNS uuid …          -- inserts tenants + tenant_users (owner) + company_settings row; returns sandbox tenant_id
CREATE FUNCTION public.sandbox_current_for_user() RETURNS uuid …        -- one sandbox per (user, prod tenant)
CREATE FUNCTION public.sandbox_delete_session(p_sandbox_tenant uuid) RETURNS jsonb
                                                                        -- wraps existing wipe_my_tenant logic by-tenant, then DELETE tenant_users + tenants row
CREATE FUNCTION public.sandbox_rollback_session(p_sandbox_tenant uuid) RETURNS jsonb
                                                                        -- same as delete but keeps the tenant row alive (delete child rows only)
```

All four:
- guarded by `current_user_can_sandbox()`;
- assert target tenant has `is_sandbox=true` AND `parent_tenant_id` = caller's prod tenant (defence in depth — no way to wipe prod via this RPC);
- write to `audit_log` with action `sandbox.create|delete|rollback`.

### 1.6 Document counters & numbering

Sandbox tenant gets its own `document_counters` row automatically (existing `generate_document_number` is per-tenant). Test docs will be e.g. `SO-0001` inside the sandbox without colliding with prod.

### 1.7 Workspace seat cap

Sandbox tenants are exempt from the 5-login cap (set a flag the seat-check function reads).

---

## Part 2 — Edge function: `run-sales-agent-uat`

Server-side script that runs an end-to-end pass inside the caller's sandbox tenant. Why an edge function and not client-side: we want one transactional ledger that records exactly what was created and what assertions passed, even if the browser closes.

Inputs: none (uses caller's auth, finds/creates their sandbox).

Steps (each step writes a row to `sandbox_uat_runs` / `sandbox_uat_steps`):

1. **Setup** — ensure sandbox exists; switch active tenant.
2. **Create test customer** (`UAT Customer`, city Karachi) + assign to a **test sales agent** (creates one if missing).
3. **Create test product** + GRN it (creates batch with 90-day expiry, qty 100, cost 100, MRP 150).
4. **Create sales order** (qty 10) → assert: order row exists, agent stamped, stock untouched.
5. **Convert to sales invoice** (dispatch) → assert: `customers.balance` rose by total, stock decreased by 10 via `stock_movements`, batch availability dropped from 100→90.
6. **Generate delivery note** → assert: linked to invoice, status 'pending'.
7. **Record customer payment** (cash, full amount) → assert: `customers.balance` back to 0, `sales_invoices.amount_paid=total`, `status='paid'`, bank balance rose.
8. **Ledger checks** — call `report_receivables_aging` (should be empty for this customer), `customer_ledger` should show 2 entries netting to 0.
9. **Audit checks** — `audit_log` has create rows for customer/product/invoice/payment.

For every assertion: insert `sandbox_uat_steps(step_name, status:'pass'|'fail', details jsonb, latency_ms)`.

Final summary row in `sandbox_uat_runs`: `passed_count`, `failed_count`, `started_at`, `finished_at`. UI fetches and renders pass/fail rows with red/green dots.

---

## Part 3 — Bulk test-data seeder

Second edge function `seed-sandbox-data` (or pg function — pg is fine since it's all SQL). Takes:

```
{ customers: 20, suppliers: 10, products: 50, batches_per_product: 2,
  sales_orders: 20, invoices_from_orders: 20, delivery_notes: 10, payments: 10 }
```

Generates realistic names (Karachi/Lahore cities, pharma SKUs like "Panadol 500mg"), then runs the natural creation flow inside the sandbox tenant. Returns counts.

---

## Part 4 — Frontend

### 4.1 Global state

New hook `useActiveTenant()`:
- on mount, calls `set_active_tenant(localStorage.activeTenantId || null)` so the GUC matches the visible mode after refresh;
- exposes `{ isSandbox, sandboxTenantId, prodTenantId, enterSandbox(), exitSandbox() }`.

`useTenant()` already exists — extend it to also list all tenants the user is a member of.

### 4.2 Sandbox banner

New `<SandboxBanner />` mounted in `AppLayout`. When `isSandbox`:
- sticky bar above the header: amber gradient, text "SANDBOX MODE · Session SBX-{shortId} · created {date}";
- buttons: `Exit Sandbox`, `Delete Session`, `Rollback Session`;
- the entire `AppLayout` adds a faint amber tint to the header/sidebar so it's impossible to forget.

### 4.3 Settings → Testing Environment (new tab)

`src/pages/SettingsTesting.tsx` (linked from existing Settings page). Sections:

- **Status** — "Sandbox active / inactive", session id, created by, created at, record counts (customers / products / invoices / payments in sandbox).
- **Actions** — `Enable Sandbox Mode` (creates if missing + switches), `Disable Sandbox Mode` (switches back), `Create Test Session` (only enabled if none exists), `Delete Test Session` (typed-confirm "DELETE SANDBOX"), `Rollback Test Session`.
- **Seed data** — form with the counts above + `Seed` button.
- **Run Sales Agent UAT** — button + last run summary table (pass/fail per step).
- **Access** — toggle `can_use_sandbox` per team member (owner only).

### 4.4 Reports

Nothing to do. Reports already scope by tenant — production reports never see sandbox data. We do **not** add an "Include sandbox data" toggle (your spec mentions it, but with the tenant-isolation approach there is no meaningful way to show both; mixing the two would re-introduce exactly the leakage risk you're trying to avoid). If you still want that toggle for a specific report, we can add it as a follow-up by querying both tenant ids and union-ing — call out the report(s) and I'll add it surgically.

---

## Part 5 — Audit

Extend `logAudit()` calls (already in `src/lib/audit.ts`) with three new action codes:
`sandbox.session.created`, `sandbox.session.deleted`, `sandbox.session.rolled_back`, plus `sandbox.uat.run`. Audit rows are written inside the sandbox tenant so the prod audit log stays clean; the create/delete actions also write a mirror row in the **prod** tenant's audit log ("opened sandbox session …", "wiped sandbox session …") so owners have a trail in their main audit view.

---

## Part 6 — Acceptance tests (manual checklist after build)

1. Enable sandbox → banner appears, customer list is empty, products empty, dashboard KPIs all zero. ✓ isolation.
2. Disable sandbox → real customers reappear, sandbox data invisible. ✓
3. Click Run Sales Agent UAT → 9 green steps, sandbox customer balance ends at 0, sandbox stock = 90 for the batch.
4. In prod mode, run `Reports → Receivables Aging`, `Daily Cash`, `Stock`, `Customer Ledger` — none mention "UAT Customer". ✓
5. Click Delete Session → record counts return to 0, banner disappears, tenant row removed. Prod tenant counts unchanged. ✓
6. Sales agent user (not owner, no `can_use_sandbox`): Settings → Testing Environment is hidden; `set_active_tenant(sandbox_id)` RPC returns "not a member". ✓

---

## Out of scope

- No "is_test_record" flags on production tables (replaced by tenant isolation, which is stronger).
- No sandbox for purchase-side flows beyond what the Sales Agent UAT touches (GRN is included because invoicing needs stock). Purchase invoices / returns can be added later by extending the seeder.
- No automatic refresh of sandbox from production data (would couple them — out of scope).
- The published-app subscription quota does not count the sandbox tenant (we exempt it explicitly).

---

## Technical notes

- The GUC approach (`set_config('app.active_tenant', …, false)`) is session-local, so two browser tabs of the same user can be in different modes safely.
- Sandbox tenant is created lazily on first "Enable Sandbox Mode" click — no zombie tenants for users who never test.
- One sandbox per (user, prod tenant). Re-enabling reuses the existing sandbox tenant unless explicitly deleted.
- Wipe reuses the existing battle-tested `wipe_my_tenant` deletion order; we add a thin wrapper that targets the sandbox tenant id directly instead of `get_user_tenant_id()`.

Approve and I'll ship it: 1 migration, 2 edge functions (`run-sales-agent-uat`, `seed-sandbox-data`), 1 new Settings page, 1 banner component, 1 hook.