# Phase 4 — RBAC finishing pass (COMPLETED)

## What shipped
✅ Sales-agent row scoping: `sales_agents.user_id` + `is_agent_customer(customer_id)` helper + restrictive `rbac_agent_scope_*` policies on customers, proforma_invoices, sales_invoices, sales_returns, delivery_notes, warranty_invoices, credit_notes (party=customer), payments (party=customer).
✅ `RequireCap` route guard wired in `App.tsx` per module (sales, purchase, finance, inventory, accounting, reports, settings, master).
✅ `useTenant().tenantRole` widened to full `TenantRole` union; `isAdmin = role==='owner'`.
✅ Audit: new actions `role_assigned`, `role_changed`, `role_removed`, `member_invited`, `member_removed`, `member_reactivated`, `member_password_reset` on `tenant_member` entity; emitted from Settings → Team Members.
✅ Memory updated.

## Operator notes
- To activate row scoping for a sales_agent user, set `sales_agents.user_id` to the user's auth id (Settings → Sales Agents UI follow-up if needed).
- Other roles are unaffected — helper short-circuits.

## Deferred / out of scope
- UI to bind a sales_agent record to a user (currently set via SQL or admin).
- Linter `Function Search Path` warnings (pre-existing, ~80).
