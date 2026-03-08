

# Plan: Multi-Tenant Subscription Layer with Payment Verification

## Overview

Add subscription management with 7-day trial, a payment upload screen for tenants, and a super-admin approval workflow. The existing multi-tenant + role system is already in place; this builds on top of it.

## Database Changes

### 1. Add subscription columns to `tenants` table
```sql
ALTER TABLE tenants
  ADD COLUMN trial_starts_at timestamptz DEFAULT now(),
  ADD COLUMN subscription_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN subscription_status text DEFAULT 'trial'; -- trial, active, expired
```

### 2. Create `payment_submissions` table
Tenants upload bank transfer screenshots for admin approval.

```sql
CREATE TABLE payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'monthly',
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id_rls uuid -- for RLS
);
```
With RLS: tenants see their own, super-admins see all.

### 3. Storage bucket
Create a `payment-screenshots` bucket (private) for upload.

## Frontend Changes

### 1. Subscription Guard (`ProtectedRoute.tsx`)
After auth check, query tenant's `subscription_status` and `subscription_ends_at`. If expired, redirect to a **Subscription Expired** page showing:
- Days since expiry
- Bank details: **Arslan Amir, Meezan Bank, 09020103209991**
- Upload screenshot button
- Status of pending submissions

### 2. Payment Upload Page (`/subscription`)
- Shows current plan and expiry date
- Bank transfer details card with copy-to-clipboard
- File upload for screenshot (to storage bucket)
- Submission history with status badges (Pending/Approved/Rejected)

### 3. Super-Admin Dashboard Enhancement (`AdminPanel.tsx`)
- Only visible to `arsaluae@gmail.com` (enforced via `user_roles` admin check, already works)
- New **Payment Approvals** tab showing pending submissions
- Each submission: tenant name, amount, plan, screenshot preview, approve/reject buttons
- On approve: update tenant's `subscription_ends_at` (+30 days for monthly, +365 for yearly), set `subscription_status = 'active'`
- On reject: add admin notes

### 4. Trial Banner
- Show a dismissible banner on dashboard: "X days left in your trial" when `subscription_status = 'trial'`
- Changes to urgent red styling when <= 2 days remaining

## Edge Function

### `manage-subscription` 
Admin-only function to approve/reject payments and extend subscription dates server-side (using service role key to bypass RLS on tenants table).

## Files Changed

| File | Action |
|------|--------|
| Migration SQL | Add columns to tenants, create payment_submissions table, storage bucket |
| `src/components/ProtectedRoute.tsx` | Add subscription expiry check |
| `src/pages/Subscription.tsx` | New: payment upload + bank details page |
| `src/pages/AdminPanel.tsx` | Add payment approvals tab |
| `src/hooks/useTenant.tsx` | Expose subscription_status, subscription_ends_at, days_remaining |
| `src/App.tsx` | Add /subscription route |
| `src/components/AppSidebar.tsx` | Add Subscription link |
| `supabase/functions/manage-subscription/index.ts` | New: approve/reject + extend dates |
| `src/pages/Index.tsx` | Add trial countdown banner |

