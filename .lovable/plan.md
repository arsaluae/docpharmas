## Phase 4 — Finish remaining RBAC work

Complete the leftover items from Phase 3 so the 7-role system is fully enforced end-to-end.

### 1. Sales-agent row scoping (server)
- New SQL helper `is_agent_customer(p_customer_id)` (SECURITY DEFINER) that returns true when the current user is `owner`/`sales_mgr`/`accountant`/`viewer`, OR when role is `sales_agent` and the customer is in `agent_customers` for `auth.uid()`.
- Add RESTRICTIVE policy `rbac_agent_scope` on: `customers`, `proforma_invoices`, `sales_invoices`, `sales_returns`, `delivery_notes`, `credit_notes`, `payments` (when `party_type='customer'`), `warranty_invoices`. Each filters by `is_agent_customer(customer_id)` (or party_id for payments).
- Same scope applied to UPDATE/INSERT via WITH CHECK.

### 2. Route-level capability guard (frontend)
- New `src/components/RequireCap.tsx` — wraps `<Outlet/>`, redirects to `/dashboard` with toast if `can(resource, 'read')` is false.
- Apply in `src/App.tsx` to module routes (Purchase, Finance, Inventory, Reports, Settings, SystemHealth, AuditLog) so a sales_agent visiting `/expenses` directly is bounced.
- Keep existing `ProtectedRoute` for auth-only check.

### 3. Tenant context fix
- `useTenant` currently types `tenantRole` as `"owner" | "staff"`. Widen to the full `TenantRole` union and stop forcing `isAdmin=false`. Set `isAdmin = role === 'owner'` so legacy callers keep working.

### 4. Audit-log role events
- Extend `AuditAction` union with `role_assigned`, `role_changed`, `role_removed`, `member_invited`, `member_removed`.
- Call `logAudit` from Settings → Team Members add/update/delete handlers and from `manage-tenant` responses.

### 5. Cleanup
- Remove the legacy "staff" enum branch from `manage-tenant` whitelist comment and from `useUserRole` (keep `isAdmin` shim).
- Update `.lovable/memory/features/role-based-access-control.md` with the agent-scope rule and RequireCap pattern.
- Update `.lovable/plan.md` to mark Phase 4 done.

### Out of scope (explicit)
- No new UI screens beyond the route guard.
- No business-logic changes to invoices/payments themselves.
- Linter warning sweep — only fix warnings touched by these edits.

### Technical notes
- All new policies are RESTRICTIVE so they AND with existing tenant + rbac policies — no risk of widening access.
- `is_agent_customer` short-circuits for non-agent roles to avoid join cost on owner/manager queries.
- `RequireCap` reads from `useRoles()`; while `loading` it renders a spinner (same pattern as `ProtectedRoute`).
