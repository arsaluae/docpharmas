# Phase 3 — RBAC Expansion + Wipe Execution (COMPLETED)

## Status

✅ Wipe migration executed (all transactional + master data cleared; tenants/users/auth preserved).
✅ `tenant_role` enum expanded: owner, staff, accountant, sales_mgr, sales_agent, inventory, purchase_mgr, viewer.
✅ `role_capabilities` matrix table + seed.
✅ Helper RPCs: `current_tenant_role()`, `current_user_can(resource, action)`, `table_resource(table)`.
✅ Restrictive RBAC policies (`rbac_read`, `rbac_write`, `rbac_update`) layered on top of tenant RLS for ~58 business tables.
✅ `void_document` hardened with capability check + insufficient_privilege error.
✅ Frontend: `src/lib/rbac.ts`, `useRoles()` hook, sidebar filtered by capability, VoidDocumentButton + GraceDeleteButton hidden without `void` capability.
✅ Settings → Team Members: 7-role picker with descriptions; legacy 2-button picker removed.
✅ `manage-tenant` edge function accepts all 7 roles.

## Phase 4 (next, awaiting go)

- Sales agent row-scoping: add policy that limits sales_agent reads/writes on sales tables to `customer_id IN (SELECT customer_id FROM agent_customers WHERE agent_user_id = auth.uid())`.
- Add `RequireCap` route guard + capability-aware ProtectedRoute for routes that need module-level lock.
- Linter cleanup (84 warnings remain — mostly pre-existing).
- Audit log: emit `role_assigned`/`role_changed` events.
- E2E test matrix: one user per role × representative actions.
