---
name: role-based-access-control
description: Owner/Accountant/Sales Mgr/Sales Agent/Inventory/Purchase Mgr/Viewer roles enforced via role_capabilities matrix + restrictive RLS + void_document guard. Frontend mirrors via src/lib/rbac.ts and useRoles().
type: feature
---

7 tenant roles stored on `tenant_users.role` (`tenant_role` enum):
owner, accountant, sales_mgr, sales_agent (legacy alias: staff), inventory, purchase_mgr, viewer.

Capability matrix lives in `public.role_capabilities (role, resource, can_read, can_write, can_void, can_approve)`.
Resources: sales, purchase, inventory, finance, accounting, master, reports, settings, team, billing.

Server enforcement:
- `current_tenant_role()` and `current_user_can(resource, action)` are SECURITY DEFINER helpers.
- Every business table has 3 restrictive policies (`rbac_read`, `rbac_write`, `rbac_update`) layered on top of the existing tenant RLS via `current_user_can(table_resource(<table>), <action>)`.
- `void_document` RPC checks `current_user_can(resource, 'void')` and raises `insufficient_privilege` if denied.
- Owner short-circuits to true in `current_user_can`.

Client mirror:
- `src/lib/rbac.ts` exports `TenantRole`, `Resource`, `Action`, `can()`, `ROLE_LABEL`, `ROLE_DESCRIPTION`, `CREATABLE_ROLES`.
- `useRoles()` hook reads `current_tenant_role` RPC, exposes `{ role, isOwner, can }`.
- `useUserRole()` is a thin legacy wrapper returning `isAdmin = role === 'owner'`.
- AppSidebar items filtered by `can(resource, 'read')`. VoidDocumentButton + GraceDeleteButton return null when user lacks `void`.
- Settings → Team Members uses `CREATABLE_ROLES` picker with labels/descriptions.
- `manage-tenant` edge function whitelists all 7 roles via `ALLOWED_ROLES` array.
