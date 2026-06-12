# Fix User Management + Sales Agent Access

## Root causes found

1. **Sales Agent sees nothing** — when owner creates a `sales_agent` via `manage-tenant`, **no row is created in `sales_agents`** and `user_id` is never linked. So `current_sales_agent_id()` returns NULL → every `RESTRICTIVE` policy (`is_agent_customer`, `agent_id = current_sales_agent_id()`) evaluates false → empty customer list, no proforma/invoice/DN/payment visible, creates rejected.
2. **Default scope is `'assigned'`** with zero `agent_customers` mappings → even with a linked agent record, list is empty.
3. **User delete** action does not exist in `manage-tenant`; only `toggle_user_active` does. No safety check for "has transactions".
4. RLS policies themselves are already correct once (1)+(2) are addressed; no policy rewrites required.

---

## Part 1 — User Management (Deactivate / Reactivate / Delete)

### Edge function `manage-tenant` — add `delete_tenant_user`
- Owner-only.
- Refuse self-delete and refuse last active owner.
- Run a `has_transactions` probe (count > 0 in any of: `sales_invoices`, `proforma_invoices`, `purchase_invoices`, `payments`, `delivery_notes`, `sales_returns`, `purchase_returns`, `journal_entries`, `expenses`, `stock_movements` filtered by `created_by = target_user`).
- If transactions exist → return `409 { error: "user_has_history", message }`. UI offers Deactivate instead.
- If clean → delete `tenant_users` row, delete linked `sales_agents` row (if any), then `supabaseAdmin.auth.admin.deleteUser(target_user_id)`. Audit-log `member_deleted`.

### UI — `Settings → Team Members`
- Add three new columns/labels: **Last login** (from `auth.users.last_sign_in_at`, exposed via `list_tenant_users`), **Status** badge (Active/Inactive).
- Action buttons per row: **Deactivate / Reactivate** (existing), **Delete** (new; owner only, hidden for self and last owner).
- Confirmation dialog: "Are you sure? This action may affect audit history." with typed-confirm of the email.
- On `user_has_history`, show toast: "User has business records. Deactivate instead of deleting." and keep the row.
- Audit events: `member_deleted`, `member_reactivated`, `member_removed` already wired.

### Login gating
- `is_active = false` is already filtered by `get_user_tenant_id()` and `current_tenant_role()` (both use `is_active = true`). Add an explicit `Auth.tsx` check: after sign-in, query `tenant_users` for an active row; if none, sign out and toast "Account deactivated. Contact your admin."

---

## Part 2 — Sales Agent end-to-end fix

### A. Auto-provision `sales_agents` record on owner_create_user
In `manage-tenant` → `owner_create_user`, when `resolvedRole === 'sales_agent'`, after inserting `tenant_users`, upsert into `sales_agents` `{ tenant_id, user_id: newUser.id, name: email-localpart, email, is_active: true, code: generate_document_number_for_tenant('sales_agent_code', tenant_id) (or fallback 'SA-####') }`. Reuse existing row if email already linked.

### B. Backfill migration
- For every existing `tenant_users` row with role in (`sales_agent`,`staff`) and `is_active`, ensure a matching `sales_agents` row exists with `user_id` set. If an unlinked `sales_agents` row exists with the same email, set its `user_id`; otherwise insert a new row.
- Flip `company_settings.sales_agent_scope` from `'assigned'` to `'all'` **only when** the tenant has zero `agent_customers` rows (per spec default). Owners can switch back via Settings.

### C. Settings → Sales → Sales Agent Customer Scope
- Add a small card in `Settings.tsx` (gated by `can('settings','write')`) with a radio:
  - **All customers** (default when no assignments) → updates `company_settings.sales_agent_scope = 'all'`.
  - **Assigned customers only** → `= 'assigned'`.
- Helper text explains effect; show count of current `agent_customers` mappings.

### D. Sidebar already correct
`AppSidebar` already renders the flat `salesAgentNav` for `isSalesAgentRole`. Confirm routes exist for: `/dashboard`, `/customers`, `/proforma`, `/sales-invoices`, `/delivery-notes`, `/stock-availability`, `/collect-payment`, `/reports/agent`. Add `/customer-ledger` link? Spec lists "View assigned customer ledger" — the existing `CustomerProfileDialog` opened from Customers list serves this; keep current nav.

### E. Route guards
`<RequireCap resource="purchase" action="read">` etc. is already wired in `App.tsx`. Verify and tighten so `/expenses`, `/bank`, `/suppliers`, `/purchase-*`, `/salaries`, `/landed-costs`, `/printers`, `/reports/*` (except agent), `/settings`, `/backups`, `/audit-log` all reject sales_agent. Denied route shows existing toast.

### F. Cost/profit visibility
Audit list/form components used by sales agent — `Products` page (read-only stock-only view already exists at `/stock-availability`), `ProformaInvoices` editor — hide `unit_cost`, `margin`, `profit` columns when `isSalesAgentRole(tenantRole)`. (Small conditional renders only.)

### G. Empty states
- Customers page when agent's filtered list is 0: "No customers available. Ask admin to assign customers or enable all-customer access."
- Sales Invoices page when empty: "No sales invoices yet. Create your first invoice."

### H. No RLS rewrites needed
Once a `sales_agents` row exists with `user_id` linked, the existing RESTRICTIVE policies already permit:
- read/insert/update `customers` filtered by `is_agent_customer(id)`
- read/insert/update `proforma_invoices`, `sales_invoices`, `delivery_notes`, `warranty_invoices`, `sales_returns` for the agent's customers
- `payments` (received, customer party, agent's customers, no bank account)
- `products` read via `master:read`
- `stock_movements` via `inventory:read`

The `sa_restrict_customers_modify` ALL policy currently blocks sales-agent from inserting customers. Spec doesn't require agent to create customers (just see/use them) — leave as-is.

---

## Testing checklist (run after implementation)

1. Create test sales agent → confirm `sales_agents` row auto-created and linked.
2. As that user: sidebar shows only sales modules; `/expenses` redirects with toast.
3. Customer list loads (mode=all by default); creating a proforma succeeds with `agent_id` stamped by trigger.
4. Sales invoice list shows agent's invoices only; create works.
5. Stock availability page loads; cost column not shown.
6. Payment-in (received, no bank) works; supplier payment blocked by RLS.
7. Owner deactivates the agent → next login fails with toast.
8. Owner reactivates → agent can log in again.
9. Delete a fresh user with no transactions → succeeds and removes auth.user.
10. Delete a user with transactions → 409, UI suggests deactivate.

---

## Files touched

- `supabase/functions/manage-tenant/index.ts` — add `delete_tenant_user` action, expose `last_sign_in_at` in `list_tenant_users`, auto-create `sales_agents` row in `owner_create_user`.
- New migration — backfill `sales_agents.user_id`; flip empty-assignment tenants to scope `'all'`.
- `src/pages/Settings.tsx` — TeamMembers card: Last login, Delete button + confirm; new "Sales Agent Customer Scope" card.
- `src/pages/Auth.tsx` — post-login active-tenant gate.
- `src/pages/Customers.tsx`, `src/pages/SalesInvoicesList.tsx`, `src/pages/ProformaInvoices.tsx` — empty-state copy + hide cost/margin for sales_agent.
- `src/App.tsx` — confirm `<RequireCap>` wraps blocked routes.

No new tables. No public-schema GRANT changes. No edits to `src/integrations/supabase/client.ts` or `types.ts`.
