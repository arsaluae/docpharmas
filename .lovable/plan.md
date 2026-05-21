
# Convert to Single-Tenant App for Mouj Pharmaceuticals

Strip multi-tenant SaaS scaffolding. Keep email/password login. Only Mouj's owner can sign in. Delete the other two tenants and all their data.

## 1. Database cleanup (data only — schema stays)

Hard-delete PharmaZen Demo (`a0000000-…0001`) and Medsal PK (`62d63497-…`) plus everything tagged with those tenant_ids across all tenant-scoped tables (customers, suppliers, products, invoices, payments, print_jobs, printers, expenses, bank_accounts, document_counters, company_settings, etc. — ~40 tables).

Also:
- Delete their `tenant_users` rows
- Delete their `payment_submissions`
- Delete `pending_signups` rows
- Delete the two tenants from `tenants`
- Delete the corresponding `auth.users` (PharmaZen owner `efbde659…`, Medsal owner `a3bc3837…`) so they can't log in
- Set Mouj's tenant: `subscription_status='active'`, `subscription_ends_at=NULL` (no trial / no expiry)

Multi-tenant schema, RLS, and `get_user_tenant_id()` stay intact — they're harmless once only one tenant exists, and removing them would be a massive risky refactor.

## 2. Disable signup

- `supabase--configure_auth` → `disable_signup: true`
- Edge function `manage-tenant`: keep deployed (still used by admin if ever needed) but signup UI is gone

## 3. Frontend strip

### Routes removed (`src/App.tsx`)
- `/` and `/landing` → Landing page
- `/admin` → AdminPanel
- `/subscription` → Subscription
- `/reset-password` stays (password reset still useful)
- `/auth` stays (login only)
- Root `/` now redirects to `/dashboard` (or `/auth` if not logged in)

### Files deleted
- `src/pages/Landing.tsx`
- `src/pages/AdminPanel.tsx`
- `src/pages/Subscription.tsx`
- `src/components/TrialBanner.tsx`
- `supabase/functions/manage-subscription/` (optional; safe to leave)

### Auth page (`src/pages/Auth.tsx`)
- Remove signup mode entirely (login + forgot password only)
- Remove company name / phone fields
- Remove "Don't have an account? Sign up" link
- Remove "← Back to homepage" link

### ProtectedRoute (`src/components/ProtectedRoute.tsx`)
- Remove `PendingApprovalScreen`, `DeactivatedScreen`, `SubscriptionGuard`
- Remove all trial/expiry/pending/deactivated logic
- Just: not-logged-in → `/auth`; logged-in → render `<Outlet />`

### useTenant (`src/hooks/useTenant.tsx`)
- Simplify: still returns `tenantId` (resolved once from `tenant_users`) and `tenantName`, but drop `subscriptionStatus`, `daysRemaining`, `isPending`, `isDeactivated`, `pending_signups` lookup
- Keeps RLS-via-tenant-id working without UI noise

### Sidebar (`src/components/AppSidebar.tsx`)
- Remove Subscription, Admin Panel, and any tenant-management entries from the Settings popover
- Remove trial banner mount points

### Misc
- `src/pages/Index.tsx` (dashboard) and `src/components/AppLayout.tsx`: remove `<TrialBanner />` usages
- `src/main.tsx` / `index.html`: update `<title>` to "Mouj Pharmaceuticals — ERP"

## 4. Branding (light touch)
- Page title + meta description → Mouj Pharmaceuticals
- Auth page heading stays "DocPharmas" logo unless you'd like that swapped too (not in this plan)

## What stays untouched
- All ERP modules (Customers, Suppliers, Products, Invoices, Payments, Print Jobs, Reports, etc.)
- Dark theme + sidebar uplift from previous turn
- RLS policies, `set_tenant_id` trigger, `get_user_tenant_id` function
- Edge functions: `ai-insights`, `reorder-alerts`, `weekly-backup`, `send-approval-email`, `manage-tenant`

## Execution order
1. Migration: none needed (schema unchanged)
2. Data deletion via `supabase--insert` (DELETEs in FK-safe order, then drop the two auth users)
3. `configure_auth` → disable signup
4. Code edits + file deletions in one batch
5. Verify: login as Mouj user → dashboard loads, sidebar has no Admin/Subscription, signup link gone, no trial banner

## Result
Single login (Mouj owner) → straight into the ERP. No landing page, no signup, no trials, no admin, no other tenants in the DB.
