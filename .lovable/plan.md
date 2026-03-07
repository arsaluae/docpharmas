

# Plan: Landing Page, Multi-Tenant SaaS Backend & System Audit Fixes

This is a large scope covering three areas: (A) a converting landing page, (B) multi-tenant client management backend, and (C) remaining system flaws.

---

## A. SYSTEM AUDIT — Remaining Flaws

### Still Present Issues
1. **`handle_sales_item_stock` function is orphaned** — trigger was dropped but the function still exists. Harmless but should be cleaned up.
2. **Auth check still copy-pasted** in every page (~20 files) — no `ProtectedRoute` wrapper yet.
3. **No layout wrapper** — `SidebarProvider + AppSidebar + header` boilerplate repeated in every page.
4. **No staff role restriction** — current system has admin role but no "staff" role with limited (sales-only) access.
5. **`print_jobs` trigger is named `on_print_job_change`** — inconsistent naming but functional.
6. **No password reset flow** — Auth page has login/signup but no forgot password link or `/reset-password` page.

### Fixes in this plan
- Drop orphaned `handle_sales_item_stock` function via migration
- Create `ProtectedRoute` and `AppLayout` components to DRY up all 20+ pages
- Add password reset flow

---

## B. LANDING PAGE (`/landing`)

A high-converting pharmaceutical SaaS landing page with:

### Structure
1. **Hero Section** — Bold headline targeting pharma business owners, animated gradient background, CTA buttons (Start Free Trial / WhatsApp), pulsing data visualization mockup
2. **Pain Points Section** — 4-6 cards addressing: manual ledger errors, stock expiry losses, DRAP compliance headaches, printing cost disputes, no real-time visibility, GST/WHT filing chaos
3. **Features Grid** — Animated cards for: Sales & Invoicing, Purchase & GRN, Inventory & Batch Tracking, Printing Management, Financial Reports, Tax Compliance
4. **Live Stats** — Animated counters (e.g., "50+ Pharma Businesses", "10,000+ Invoices Processed")
5. **Pricing Section** — Single plan: PKR 5,000/month OR PKR 45,000/year (save 25%) + PKR 30,000 one-time setup
6. **WhatsApp Button** — Floating sticky button linking to `https://wa.me/447477210590`
7. **Footer** with contact info

### Style
- Sora headings, DM Sans body (already configured)
- Primary blue gradients with pharma green accents
- Framer Motion animations (already installed) for scroll reveals, counters, card hovers
- Glass morphism cards matching existing design system

### Route
- `/landing` — public, no auth required
- Update `/auth` to redirect to `/` (dashboard) if already logged in
- App root `/` stays as dashboard for logged-in users

---

## C. MULTI-TENANT CLIENT MANAGEMENT

### Database Changes (Migration)

1. **`tenants` table** — Each client company is a tenant
   - `id`, `company_name`, `owner_email`, `phone`, `plan` (monthly/yearly), `setup_paid`, `is_active`, `max_users` (default 2), `created_at`

2. **`tenant_users` table** — Maps auth users to tenants with roles
   - `id`, `tenant_id` (FK tenants), `user_id` (FK auth.users), `role` (enum: 'owner', 'staff'), `is_active`, `created_at`
   - Unique on `(tenant_id, user_id)`

3. **Add `tenant_id` column** to ALL business tables (customers, suppliers, products, proforma_invoices, sales_invoices, sales_invoice_items, purchase_proformas, purchase_orders, payments, expenses, bank_accounts, stock_movements, printers, print_jobs, etc.)
   - Default NULL for now, backfill later
   - Add RLS policies: users can only see data where `tenant_id` matches their tenant

4. **RLS Policy Pattern** — Create a `get_user_tenant_id()` security definer function:
   ```sql
   CREATE FUNCTION get_user_tenant_id() RETURNS uuid AS $$
     SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1
   $$ LANGUAGE sql STABLE SECURITY DEFINER;
   ```
   Then all table policies become: `tenant_id = get_user_tenant_id()`

5. **Staff role restriction** — Staff users with role='staff' only see Sales section data (sales_invoices, proforma_invoices, customers, delivery_notes, warranty_invoices). Other sections hidden in sidebar.

### Frontend Changes

1. **Admin Panel** (`/admin`) — Protected route for the super-admin (you) to manage all 50 clients:
   - List all tenants with status, plan, user count
   - Create new tenant + generate owner login credentials
   - Activate/deactivate tenants
   - View tenant stats (invoices created, products, etc.)

2. **Auth flow update** — After login, fetch `tenant_users` to determine:
   - Which tenant the user belongs to
   - Their role (owner vs staff)
   - If staff → restrict sidebar to Sales section only
   - If no tenant → show "Access not configured" message

3. **Sidebar modification** — Use tenant role to conditionally show/hide sections:
   ```typescript
   const { role } = useTenantRole(); // 'owner' | 'staff'
   const visibleSections = role === 'staff' 
     ? sections.filter(s => s.label === 'Sales') 
     : sections;
   ```

4. **Context Provider** — `TenantProvider` wrapping the app to provide `tenantId` and `role` globally

### Super Admin Detection
- Use existing `user_roles` table with `app_role = 'admin'` to identify super-admin
- Super-admin bypasses tenant restrictions, sees admin panel

---

## D. AUTH IMPROVEMENTS

1. **Forgot Password** link on Auth page
2. **`/reset-password` page** — form to set new password after email link
3. **Login redirects**: if user has `admin` role → can access `/admin`; if tenant user → dashboard

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/Landing.tsx` | **Create** — Full landing page |
| `src/pages/AdminPanel.tsx` | **Create** — Tenant management for super-admin |
| `src/pages/ResetPassword.tsx` | **Create** — Password reset form |
| `src/components/ProtectedRoute.tsx` | **Create** — Auth guard wrapper |
| `src/components/AppLayout.tsx` | **Create** — Shared sidebar+header layout |
| `src/hooks/useTenant.tsx` | **Create** — Tenant context & role hook |
| `src/components/WhatsAppButton.tsx` | **Create** — Floating WhatsApp CTA |
| `src/App.tsx` | **Modify** — Add routes, wrap with TenantProvider |
| `src/pages/Auth.tsx` | **Modify** — Add forgot password, post-login routing |
| `src/components/AppSidebar.tsx` | **Modify** — Role-based section filtering |
| `src/pages/Index.tsx` | **Modify** — Use AppLayout, remove boilerplate |
| All 20+ page files | **Modify** — Replace boilerplate with AppLayout |
| DB migration | **Create** — tenants, tenant_users tables, tenant_id columns, RLS policies, get_user_tenant_id() function, drop orphaned function |

### Migration SQL Summary
- Create `tenants` and `tenant_users` tables with RLS
- Add `tenant_id uuid` to ~25 business tables
- Create `get_user_tenant_id()` security definer function
- Update RLS policies on all business tables to filter by tenant
- Drop orphaned `handle_sales_item_stock` function

---

## Implementation Order

1. **DB migration** — Tables, columns, functions, RLS
2. **TenantProvider + useTenant hook** — Core context
3. **ProtectedRoute + AppLayout** — DRY up all pages
4. **Landing page** — Full marketing page with animations
5. **Admin Panel** — Tenant CRUD for super-admin
6. **Auth improvements** — Reset password, role-based routing
7. **Sidebar role filtering** — Staff sees sales only
8. **Refactor all pages** — Use AppLayout wrapper

> **Note**: This is a large change. I recommend implementing it in 2-3 messages: (1) DB + core infrastructure, (2) Landing page, (3) Admin panel + page refactoring. Shall I proceed with all at once or split?

