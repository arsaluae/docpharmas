# Phase 3 — RBAC Expansion + Wipe Execution

## A. Execute Phase 2 Wipe (gated migration)

Run the previously-staged wipe in a single transaction:

```sql
SET LOCAL "app.allow_wipe" = 'yes';
-- truncate transactional + master tables (CASCADE) in dependency order
-- preserve: tenants, profiles, user_roles, tenant_users, subscription/plan tables
-- re-seed default chart_of_accounts + document_templates + document_counters per tenant
```

After wipe: run `run_reconciliation(tenant, false)` per tenant — expect zero rows.

## B. 7-Role RBAC Matrix

Expand `app_role` enum from current `admin/staff` to:

| Role          | Scope                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| owner         | Full access incl. billing, team, period unlock, wipe/purge gates                                                   |
| accountant    | Full read; write on payments, journals, credit/debit notes, expenses, period lock/unlock; no master-data deletes   |
| sales_mgr     | Full Sales hub + Customers + Sales Agents + Sales reports; read Products/Stock; approve sales returns              |
| sales_agent   | Own customers only (via agent_customers); create quotations/proformas/sales orders; no invoice approval, no voids  |
| inventory     | Products, stock_movements, GRN, delivery_notes, stock audit, reorder alerts; read purchases                        |
| purchase_mgr  | Full Purchase hub + Suppliers + Printers + landed costs + purchase reports; read Products/Stock                    |
| viewer        | Read-only across all reports + ledgers; no writes anywhere                                                         |

### Schema changes

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_mgr';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_agent';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'inventory';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'purchase_mgr';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';
-- migrate existing: admin -> owner, staff -> sales_agent (data wiped anyway; only role mappings retained)
```

New helper RPCs (SECURITY DEFINER, `search_path=public`):
- `has_any_role(uuid, app_role[])` — single check used in policies.
- `can_write(table_name text)` — central capability map (table → roles allowed to write).
- `is_owner()`, `is_accountant()`, `is_sales_role()`, `is_purchase_role()`, `is_inventory_role()`, `is_readonly()`.

### Permission matrix table

```sql
CREATE TABLE role_capabilities (
  role app_role,
  resource text,           -- 'sales_invoices','products','payments',...
  can_read boolean,
  can_write boolean,
  can_void boolean,
  can_approve boolean,
  PRIMARY KEY (role, resource)
);
```

Seeded with the full matrix; policies reference it via `has_capability(auth.uid(), resource, action)`.

### RLS rewrite

Every public table gets standardized policies built from `has_capability`:
- SELECT: `tenant_id = get_user_tenant_id() AND has_capability(auth.uid(), '<resource>', 'read')`
- INSERT/UPDATE: + `'write'`; sales_agent additionally constrained to `customer_id IN (SELECT customer_id FROM agent_customers WHERE agent_user_id = auth.uid())` on sales tables.
- DELETE: blocked everywhere (soft-void only); `'void'` capability gates the void_document RPC via role check inside it.

### void_document hardening

Add at top:
```sql
IF NOT has_capability(auth.uid(), p_table, 'void') THEN
  RAISE EXCEPTION 'You do not have permission to void %', p_table USING ERRCODE='insufficient_privilege';
END IF;
```

## C. Frontend RBAC

- Replace `useUserRole` (admin-only boolean) with `useRoles()` → `{ roles, can(resource, action) }`.
- New `<RequireCap resource action>` wrapper component used in routes + buttons.
- AppSidebar filters nav items by `can(resource,'read')`.
- ProtectedRoute extended to accept required capability.
- Settings → Team Members: replace 2-role picker with 7-role dropdown + capability preview (read-only matrix view of selected role).
- Hide voided-document buttons unless `can(table,'void')`.
- Sales Agent UX: scope Customers, Sales Orders, Proformas, Quotations lists to own customers (server already enforces via RLS, client filters mirror it for UX).

## D. Files changed / created

- `supabase/migrations/<ts>_phase3_wipe_execute.sql` — runs the gated truncate + re-seed.
- `supabase/migrations/<ts>_phase3_rbac.sql` — enum values, helper fns, `role_capabilities` + seed, RLS rewrite across ~50 tables, void_document guard.
- `src/hooks/useRoles.tsx` (new) — replaces `useUserRole`.
- `src/components/RequireCap.tsx` (new).
- `src/components/ProtectedRoute.tsx` — accept `requireCap`.
- `src/components/AppSidebar.tsx` — capability-filtered nav.
- `src/pages/Settings.tsx` (Team Members tab) — 7-role picker + matrix preview.
- `src/components/VoidDocumentButton.tsx`, `GraceDeleteButton.tsx` — hide via capability.
- `src/lib/rbac.ts` (new) — typed resource/action enums + `can()` helper.
- `phase3-notes.md` — rollback, capability matrix doc.

## E. Verification

1. Wipe migration: `SELECT count(*) FROM sales_invoices` == 0; reconciliation returns 0 drift.
2. Create 1 user per role; for each, attempt: list invoices, create invoice, void invoice, view billing — assert allowed/blocked matches matrix.
3. sales_agent: confirm they only see their assigned customers and cannot read others (direct SQL via their JWT).
4. Linter: zero ERROR-level findings; no new `function_search_path_mutable`.
5. UI: sidebar items hidden correctly; voided/delete buttons disabled for non-privileged roles.

## Approval Gate

Reply "go" to execute. I'll run wipe migration first, surface a quick report, then ship the RBAC migration + frontend changes.
