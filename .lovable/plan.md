

# Scaling Audit: Critical Issues for 100+ Tenants

After studying every module, here are the problems you will face and the fixes needed.

---

## CRITICAL BUGS (Will break with multiple tenants)

### 1. Document Number Counter is Shared Across ALL Tenants
The `generate_document_number` function does NOT filter by `tenant_id`. It updates ALL rows matching `document_type`, so Tenant A and Tenant B increment each other's counters. With 100+ tenants, invoice numbers will collide or skip wildly.

**Fix**: Rewrite the function to filter by the calling user's tenant:
```sql
UPDATE document_counters
SET current_value = current_value + 1
WHERE document_type = p_document_type
  AND tenant_id = get_user_tenant_id()  -- ADD THIS
```

### 2. Self-Signup Creates Orphaned Users
The Auth page allows signup, but there is NO `pending_signups` table (it was planned but never created). Signed-up users get an auth account but NO tenant link, leaving them stuck on an empty dashboard forever. At scale, you'll accumulate hundreds of orphaned auth users with no way to manage them.

**Fix**: Create `pending_signups` table + update Auth page to collect company name + update ProtectedRoute to show "Pending Approval" screen + add approval flow in Admin Panel + update edge function.

### 3. New Tenants Get No Document Counters
When admin creates a tenant and user via `manage-tenant`, NO `document_counters` rows are seeded. The first time that tenant tries to create any document, `generate_document_number` fails with "Unknown document type" because no counter row exists for their tenant.

**Fix**: Seed all 14 document counter rows in the `manage-tenant` edge function when creating a tenant/approving signup.

### 4. No Company Settings Seeded for New Tenants
New tenants have no `company_settings` row. The Settings page handles this (creates on save), but `useCompanySettings` returns `null` until then. Every page using `settings?.gst_enabled` etc. will silently fail or show wrong UI.

**Fix**: Auto-create a default `company_settings` row when approving a tenant.

---

## HIGH PRIORITY (Will cause problems at scale)

### 5. Admin Panel N+1 Query Problem
`loadTenants()` loops through EVERY tenant and runs a separate query for each to fetch users. With 100 tenants, that's 101 database queries on every admin page load.

**Fix**: Single query: `supabase.from("tenant_users").select("*")` then group client-side.

### 6. Tenant Deactivation Not Enforced
The `is_active` flag on tenants exists but is never checked. Deactivated tenants can still log in and use the system normally. RLS policies don't check `is_active`, and ProtectedRoute doesn't either.

**Fix**: Check tenant `is_active` in `useTenant.tsx` and block access if deactivated.

### 7. Dashboard Loads Unbounded Data
`Index.tsx` fetches up to 5000 `sales_invoice_items` with no date filter. As tenants accumulate data over months/years, this will become slow and eventually hit the 1000-row default limit (the `.limit(5000)` override helps but is fragile).

**Fix**: Add date filters (current month/year only) to dashboard queries.

### 8. Backup Can Timeout for Large Tenants
The backup feature queries 15 tables sequentially with `select("*")`. A tenant with thousands of invoices will hit browser memory limits or request timeouts.

**Fix**: Add pagination to backup queries (fetch in chunks of 500) and show progress indicator.

---

## MEDIUM PRIORITY (Should fix before launch)

### 9. No Rate Limiting on Signup
Anyone can spam the signup form to create unlimited auth users, consuming your auth quota.

### 10. No Email Verification Enforcement
Auth signup sends a confirmation email, but the system doesn't check if email is verified before allowing login. Users can bypass verification.

### 11. Payment Screenshot Storage is Private But No Download Auth
The `payment-screenshots` bucket is private, but admin views screenshots via `getPublicUrl()` which won't work for private buckets. Admin can't see payment screenshots.

**Fix**: Use `createSignedUrl()` instead of `getPublicUrl()` for private bucket files.

---

## Implementation Plan

| # | Priority | Change | Files |
|---|----------|--------|-------|
| 1 | CRITICAL | Fix `generate_document_number` to filter by tenant_id | DB migration |
| 2 | CRITICAL | Create `pending_signups` table + signup flow + approval | DB migration, Auth.tsx, ProtectedRoute.tsx, useTenant.tsx, AdminPanel.tsx, manage-tenant edge function |
| 3 | CRITICAL | Seed document_counters + company_settings on tenant approval | manage-tenant edge function |
| 4 | HIGH | Fix Admin N+1 queries | AdminPanel.tsx |
| 5 | HIGH | Enforce tenant `is_active` check | useTenant.tsx |
| 6 | HIGH | Add date filters to dashboard | Index.tsx |
| 7 | HIGH | Fix payment screenshot signed URLs | AdminPanel.tsx |
| 8 | MEDIUM | Paginate backup exports | Settings.tsx |

