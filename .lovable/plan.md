

# Fix: New User Signup Not Appearing in Admin Panel

## Root Cause

After `supabase.auth.signUp()`, the user's email is unconfirmed, so no session exists. `auth.uid()` returns null, causing the RLS INSERT policy on `pending_signups` (`user_id = auth.uid()`) to silently reject the insert. The error is only `console.error`'d, so the user sees "Account created!" but nothing is saved.

## Fix

**Route the pending_signup insert through the `manage-tenant` edge function** which uses the service role key and bypasses RLS.

### Changes

1. **`supabase/functions/manage-tenant/index.ts`** — Add a new `create_pending_signup` action that:
   - Does NOT require admin auth (it's called by unauthenticated users)
   - Validates the user_id exists in auth.users
   - Inserts into pending_signups using service role
   
2. **`src/pages/Auth.tsx`** — Replace the direct Supabase insert with a call to the edge function:
   ```typescript
   await supabase.functions.invoke("manage-tenant", {
     body: { 
       action: "create_pending_signup",
       user_id: data.user.id,
       email,
       company_name: companyName.trim(),
       phone: phone.trim() || null,
     },
   });
   ```

3. **Fix orphaned users** — Create pending_signup records for the two existing users (moujpharmaceuticals@gmail.com and medsalpk@gmail.com) via a one-time DB insert so they appear in the admin panel immediately.

### Security

The `create_pending_signup` action will validate:
- `user_id` exists in `auth.users`
- No duplicate pending_signup exists for that user_id
- No admin auth required (public action), but scoped to only creating pending records

