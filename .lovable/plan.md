# Plan — Forgot Password + Sub-user (Sales) Access

## 1. Forgot password — make it actually work end-to-end

The login form already has a "Forgot?" link that calls `supabase.auth.resetPasswordForEmail`, but the recovery side has two gaps:

a. **`src/pages/ResetPassword.tsx` is stale** — it still uses removed utilities (`glass-card-glow`, `pharma`-era logo image, glow blur background). Refactor it onto the same `mouj-dark-auth` shell as `Auth.tsx` so the recovery page renders correctly when users click the email link. Same split-panel layout, same wordmark, two password fields, submit button.

b. **Failed-login affordance** — in `Auth.tsx`, when `signInWithPassword` returns `Invalid login credentials`, track a small counter (`failedAttempts`) in component state. After 2 failures, show an inline hint under the password field: *"Trouble signing in? Reset your password →"* that switches `mode` to `"forgot"` with the email field pre-filled. Reset the counter on mode change or successful login.

c. **Redirect URL correctness** — keep `redirectTo: ${window.location.origin}/reset-password`. Confirm `/reset-password` is a public route in `App.tsx` (it should already be — verify, no change expected). No Supabase auth-config changes; the existing default email template + signing keys handle delivery.

d. **UX polish** — in `forgot` mode show a small success state inside the card after the email is sent (instead of just a toast + mode swap), with a "Back to sign in" link. Keeps the user oriented if they miss the toast.

## 2. Give a new sub-user Sales-only access

The backend already supports it: `manage-tenant` edge function exposes `owner_create_user` with a `role` field (`owner` | `staff`), enforces the 2-login cap, and `tenant_users.role = 'staff'` already drives the sidebar to "Sales-only" via `useTenant` / `AppSidebar` (`tenantRole === "owner" ? "Admin" : "Staff"`). There is **no UI** today to actually create one — add it.

**New section in `src/pages/Settings.tsx`** — "Team & Access" card (visible only when `tenantRole === 'owner'`):

- Lists current `tenant_users` rows for this tenant: email, role badge (Admin / Sales), active toggle, created date.
- "Add sub-user" button opens a small inline form: Email, Password (min 6), Role (locked to `staff` for now, labeled "Sales — limited to sales module"). On submit:
  ```ts
  supabase.functions.invoke("manage-tenant", {
    body: { action: "owner_create_user", tenant_id, email, password, role: "staff" }
  })
  ```
  Toast success, refresh the list. Surface the edge function's 2-login-cap error verbatim if it fires.
- Per-row "Deactivate / Reactivate" button calls `manage-tenant` with `action: "toggle_user_active"` (already implemented server-side per the existing pattern — verify in the edge function; if missing, add a tiny branch that flips `tenant_users.is_active`).
- Helper text under the form: *"Sales users can only see Customers, Sales Orders, Sales Invoices, Delivery Notes, Returns and Payments-received. They cannot access Purchase, Reports or Settings."* — matches the existing Staff sidebar filter.

No new DB tables, no migrations. RBAC enforcement already lives in `AppSidebar` + route guards driven by `tenantRole`.

## Files touched

- `src/pages/Auth.tsx` — failed-attempt hint, success card for forgot mode, prefill email when switching to forgot.
- `src/pages/ResetPassword.tsx` — rewrite onto `mouj-dark-auth` shell, drop `glass-card-glow` + logo image.
- `src/pages/Settings.tsx` — add "Team & Access" card with list + add-user form (owner-only).
- `supabase/functions/manage-tenant/index.ts` — add `toggle_user_active` branch only if it doesn't already exist (verify first; create_user + role=staff already supported).

No DB migrations. No new dependencies. No auth-config changes.
