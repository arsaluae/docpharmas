## Confirmation first

`moujpharmaceuticals@gmail.com` **already exists** as an active **Admin** in your workspace (joined 10 Mar 2026). No new user will be created — it's already row #1 in your Team Members list, just shown as a cryptic `8990f88e…` instead of its email.

Both of your existing admins:
- `moujpharmaceuticals@gmail.com` — Admin, active
- `arsaluae@gmail.com` — Admin, active (this is you)

## Changes

**1. Show emails in Team Members list**
- Add a new `list_tenant_users` action to `supabase/functions/manage-tenant/index.ts` that returns `{ user_id, email }[]` for the tenant (uses service role to read `auth.users`, scoped to caller's tenant — owner-only).
- Update `TeamAccessCard` in `src/pages/Settings.tsx` to call it after loading members and display the email next to (or instead of) the truncated ID. "You" badge stays for the current user, with their email shown beneath.

**2. Add "Reset password" button per member**
- New `owner_reset_password` action in the edge function (owner-only, can't reset your own from here — use account menu for that). Accepts `tenant_id`, `user_id`, `new_password` (min 6 chars).
- Small "Reset password" button on each member row → opens a tiny inline input → on submit calls the action and toasts "Password updated". This lets you set `moujpharmaceuticals@gmail.com` to `Mouj_2010` directly from the UI without me touching auth secrets behind your back.

**3. (Optional) immediately set the password**
After the button ships, you click "Reset password" on `moujpharmaceuticals@gmail.com`, type `Mouj_2010`, done.

## Out of scope
- Creating a duplicate user for that email (not possible — auth would reject it).
- Sending a password reset email (you said you want to set it directly).
- Editing roles after creation (still owner-initiated only via deactivate + re-add).

## Technical notes
- Both new actions reuse the existing owner-check pattern (`tenant_users.role = 'owner'` for caller's tenant).
- Email lookup batches `supabaseAdmin.auth.admin.getUserById` for each member — fine for ≤5 users.
- No DB migration needed; no schema changes.

Reply "go" and I'll ship it.
