

# Fix Approve/Reject Error + Add Approval Confirmation Email

## Root Cause of the Error

The `manage-tenant` edge function on line 110 uses `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")` to create a client for verifying the admin's JWT. This environment variable doesn't exist in the edge function runtime — the correct variable is `SUPABASE_ANON_KEY`. This causes a 500 error: `"supabaseKey is required."`.

## Changes

### 1. Fix Edge Function (`supabase/functions/manage-tenant/index.ts`)
- Replace `SUPABASE_PUBLISHABLE_KEY` with `SUPABASE_ANON_KEY` on line 110
- Add email sending logic in the `approve_signup` action using the Lovable AI API to generate a branded HTML email, then send via a simple SMTP/Resend approach — actually, the simplest approach: after approval, use `supabaseAdmin.auth.admin.updateUserById()` to confirm the user's email (so they can log in), and send an approval notification email via a new `send-approval-email` edge function

### 2. Create Approval Email Edge Function (`supabase/functions/send-approval-email/index.ts`)
Since this is a transactional email (not an auth email), create a dedicated edge function that:
- Receives `email`, `company_name`, `trial_ends_at` as params
- Uses the Lovable AI API to send a branded HTML email matching DocPharmas styling:
  - Primary color: `hsl(199, 89%, 48%)` (the blue from CSS vars)
  - Font: Sora / DM Sans
  - Logo from `public/images/docpharmas-logo.jpg`
  - Content: "Your account has been approved! You have a 7-day free trial. Log in now."
- Called from `manage-tenant` after successful approval

### 3. Update `manage-tenant` to call the email after approval
- After marking signup as approved, invoke `send-approval-email` with the user's details

### 4. Fix duplicate Reject button in Admin Panel UI
- The screenshot shows two reject buttons — one plain "Reject" and one red "Reject". Remove the duplicate.

## Files to Edit/Create

| File | Action |
|------|--------|
| `supabase/functions/manage-tenant/index.ts` | Fix `SUPABASE_ANON_KEY`, add email call after approval |
| `supabase/functions/send-approval-email/index.ts` | Create — branded approval email |
| `supabase/config.toml` | Add `verify_jwt = false` for send-approval-email |

