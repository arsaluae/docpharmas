## Problem

The Team Members card only shows the currently logged-in user (`arsaluae@gmail.com`), even though `moujpharmaceuticals@gmail.com` is also an active Admin in the same workspace.

**Root cause:** The RLS policy `read_own_tenant` on `tenant_users` restricts each user to seeing only their **own** row (unless they have the app-level `admin` role, which workspace owners do not). The Settings page queries `tenant_users` directly from the browser, so it can never see other members.

The edge function `list_tenant_users` (which uses the service role) was added to fetch emails, but it only returns `{ user_id, email }` — so members not already in the RLS-filtered base list never appear.

## Fix

**1. `supabase/functions/manage-tenant/index.ts` — `list_tenant_users` action**
Return the full member record, not just emails:
`{ user_id, email, role, is_active, created_at }[]` — fetched via service role so RLS doesn't hide siblings.

**2. `src/pages/Settings.tsx` — `TeamAccessCard.load()`**
Stop using the direct `tenant_users` query as the source of truth. Use the edge function response to build `members`, falling back to the direct query only if the edge function fails (e.g. for the non-owner case).

No DB migration, no schema changes, no new actions.

## Verification

- Reload Settings → Team & Access. Both `arsaluae@gmail.com` (You / Admin) and `moujpharmaceuticals@gmail.com` (Admin) should appear.
- Reset-password button on the second row should work as before.
