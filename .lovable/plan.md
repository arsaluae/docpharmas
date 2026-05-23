## Team Management — Admin & Sales Users

Your current state: `arsaluae@gmail.com` (admin) and `moujpharmaceuticals@gmail.com` (admin) are both active owners of the Mouj Pharmaceuticals workspace, which is currently capped at 2 logins (already full).

### Changes

**1. Raise workspace user cap to 5**
- Migration: bump `tenants.max_users` from 2 → 5 for your tenant.
- Update memory + any UI copy that still says "2 logins".

**2. Team Members card — role selector**
File: `src/pages/Settings.tsx` (`TeamAccessCard`)
- Replace the "Add Sales User" button + form with a unified "Add Team Member" form that includes:
  - Email
  - Temporary password
  - **Role selector**: Admin (full access, mapped to `owner`) / Sales (restricted, mapped to `staff`)
- Show clear helper text per role explaining what each can access.
- Existing badges already render Admin/Sales correctly — keep as is.
- Deactivate/Reactivate buttons: allow on any member except yourself and the last remaining admin (guard added in UI; edge function still blocks self-toggle).

**3. Edge function — accept role from owner**
File: `supabase/functions/manage-tenant/index.ts` (`owner_create_user`)
- Currently hardcodes `role: role || "staff"`. Validate `role` is one of `"owner" | "staff"` and pass it through (already partially supports it — just need to surface in UI and tighten validation).

**4. Sales role access — add read-only Products/Stock**
File: `src/components/AppSidebar.tsx` (or wherever staff route filtering lives — will locate during build)
- Add Products & Stock pages to the staff-allowed routes.
- On Products/Stock pages, when role is `staff`: hide Create/Edit/Delete buttons and disable inline editing (read-only view). Search, filters and viewing remain.

### Out of scope
- Self-signup of new admins (still owner-initiated from Settings).
- Granular per-module permissions beyond the Admin/Sales split.
- Password reset / email invitations (admins share the temp password manually as today).

### Confirmation needed
Reply "go" and I'll implement.
