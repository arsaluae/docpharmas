---
name: role-based-access-control
description: Owner/Accountant/Sales Mgr/Sales Agent/Inventory/Purchase Mgr/Viewer roles enforced via role_capabilities matrix + restrictive RLS + void_document guard + is_agent_customer row scoping. Frontend mirrors via src/lib/rbac.ts, useRoles(), and <RequireCap> route guard.
type: feature
---

7 tenant roles on `tenant_users.role` (`tenant_role` enum):
owner, accountant, sales_mgr, sales_agent (legacy alias: staff), inventory, purchase_mgr, viewer.

Capability matrix: `public.role_capabilities (role, resource, can_read, can_write, can_void, can_approve)`.
Resources: sales, purchase, inventory, finance, accounting, master, reports, settings, team, billing.

## Server enforcement
- `current_tenant_role()` + `current_user_can(resource, action)` SECURITY DEFINER helpers.
- Every business table has restrictive `rbac_read` / `rbac_write` / `rbac_update` policies via `current_user_can(table_resource(<table>), <action>)`.
- `void_document` RPC checks `current_user_can(resource, 'void')` and raises `insufficient_privilege` if denied.
- Owner short-circuits to true.

## Sales-agent row scoping
- `sales_agents.user_id` links an agent record to an auth user.
- `is_agent_customer(p_customer_id)` returns true for non-agent roles, else true only when the customer is in `agent_customers` for the caller's `sales_agents.user_id = auth.uid()`.
- Restrictive policies `rbac_agent_scope_{read,write,update}` on: customers, proforma_invoices, sales_invoices, sales_returns, delivery_notes, warranty_invoices (filter by customer_id), and credit_notes/payments (filter when `party_type='customer'` by party_id).

## Client mirror
- `src/lib/rbac.ts`: `TenantRole`, `Resource`, `Action`, `can()`, `ROLE_LABEL`, `ROLE_DESCRIPTION`, `CREATABLE_ROLES`.
- `useRoles()` hook: reads `current_tenant_role` RPC, exposes `{ role, isOwner, can, loading }`.
- `useUserRole()` legacy shim: `isAdmin = role === 'owner'`.
- `useTenant().tenantRole` is the full `TenantRole` union; `isAdmin` mirrors owner.
- `<RequireCap resource="..." action="read">` wraps route groups in `App.tsx` and redirects to `/dashboard` with a toast if denied.
- `AppSidebar` items filtered by `can(resource, 'read')`. `VoidDocumentButton` + `GraceDeleteButton` return null without `void`.
- Settings → Team Members: `CREATABLE_ROLES` picker; add/toggle/password-reset emit `member_invited` / `member_removed` / `member_reactivated` / `member_password_reset` audit events on entity `tenant_member`.
- `manage-tenant` edge function whitelists all 7 roles.
