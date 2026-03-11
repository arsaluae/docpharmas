

# Fix: User Creation Scoped to Wrong Tenant + Missing Owner Authorization

## Problem
Two bugs in user creation from the Subscription page:

1. **The `create_user` edge function action requires `admin` role** — so tenant owners can't create sub-users at all (it fails with "Admin access required"). Only the super admin can create users.
2. **When the admin tests "Add User" from the Subscription page**, new users get added to the admin's own tenant (PharmaZen Demo) because `tenantId` comes from `useTenant()` — not the Mouj tenant.

Result: Raja Munir was likely created by the admin and landed in the admin's tenant instead of Mouj's.

## Fix

### 1. Add `owner_create_user` action to the edge function
A new action in `manage-tenant` that:
- Validates the caller is an **owner** of the specified tenant (not just admin)
- Checks user limit for that tenant
- Creates the auth user and links to the correct tenant
- No admin role required — just ownership verification

### 2. Update `Subscription.tsx` to use `owner_create_user`
Change `handleCreateUser` to call the new action instead of `create_user`.

### 3. Keep existing `create_user` for Admin Panel
The admin-only `create_user` action stays unchanged for the Admin Panel.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/manage-tenant/index.ts` | Add `owner_create_user` action with ownership verification |
| `src/pages/Subscription.tsx` | Switch to `owner_create_user` action |

## Edge Function Logic (new action)
```text
owner_create_user:
  1. Authenticate caller via JWT
  2. Verify caller is owner of the given tenant_id via tenant_users
  3. Check max_users limit
  4. Create auth user (admin API)
  5. Insert tenant_users row with correct tenant_id
```

No database migration needed.

