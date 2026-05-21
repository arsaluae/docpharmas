## Goal

Make `arsaluae@gmail.com` / `Mouj_1179` a working login that lands inside the existing **Mouj Pharmaceuticals** tenant as **Owner**, alongside the current `moujpharmaceuticals@gmail.com` owner.

## What I found

- `auth.users` contains only `moujpharmaceuticals@gmail.com`. That's why every login attempt for `arsaluae@gmail.com` returns `invalid_credentials` — the account simply does not exist yet.
- The Mouj tenant (`Mouj Pharmaceuticals`, id `c7548f94…`) already has one owner mapped in `tenant_users`.
- The platform's 2-login-per-tenant rule allows one more user (Owner or Staff).

## Steps

1. **Create the auth user** via the service-role admin API inside a one-shot edge function call:
   - email: `arsaluae@gmail.com`
   - password: `Mouj_1179`
   - `email_confirm: true` (auto-verified so login works immediately, no inbox needed)

2. **Map the new user to the existing tenant** by inserting into `tenant_users`:
   - `tenant_id = c7548f94-57c2-4004-b3bf-972e1e7d1bd6`
   - `role = 'owner'`
   - `is_active = true`

3. **Verify** with a `SELECT` from `auth.users` + `tenant_users` that the new row exists and is active.

4. **Confirm login flow** — sign in with the new credentials on `/auth`; expect redirect to `/dashboard` with full Mouj data visible (shared tenant).

## Technical notes

- Implementation will reuse the existing `manage-tenant` edge function (which already uses `SUPABASE_SERVICE_ROLE_KEY` for privileged inserts). A small one-off invocation script writes both the auth user and the `tenant_users` row in a single transaction-like flow; on failure the auth user is rolled back so we don't leave an orphan.
- No schema changes. No RLS changes. No email infra needed (auto-confirm).
- Nothing else in the prior in-flight work (logo, AcceptQuotation/ConfirmPurchase dialogs, unified PDF template) is touched by this plan.

## Out of scope

- Resetting `moujpharmaceuticals@gmail.com`'s password.
- Creating a separate tenant.
- Any further work on the sales/purchase quotation→invoice flow (still queued from earlier turns).
