

# Fix Payment Status, Default Route, Balance Column & Data Import UX

## Issues to Fix

### 1. Default Route → Landing Page
Currently `"/"` goes to the dashboard (requires auth). Change so unauthenticated users land on the landing page, while authenticated users still get the dashboard.

**Approach**: Swap routes — make `"/"` the Landing page, move dashboard to `"/dashboard"`, update all internal links. OR simpler: redirect `"/"` to `/landing` for unauthenticated users. Simplest: just swap the route paths.

### 2. Balance Column Shows Wrong Values
Line 968 in `ProformaInvoices.tsx` shows the full invoice total as "balance" for any non-paid invoice. This is incorrect — partial payments are ignored. Same issue exists in `PurchaseProforma.tsx`.

**Fix**: During `load()`, batch-fetch payment sums grouped by `invoice_id` for all converted invoices, then calculate actual remaining balance per row.

### 3. Payment Status Still Not Updating (Investigation)
The recalc functions look correct. The likely issue is the `amount_paid` column — the recalc function updates `amount_paid` on `sales_invoices`, but the `load()` function in `ProformaInvoices.tsx` only fetches `status` from `sales_invoices` (line 157). It should also fetch `amount_paid` to compute accurate balances.

**Fix**: Fetch `amount_paid` alongside `status` from `sales_invoices` and use it for balance display. The recalc trigger should be working — let me verify the trigger is actually attached.

### 4. Data Import — Smoother Onboarding for New Users
The current import page is functional but could be friendlier:
- Add a **step-by-step wizard feel** with numbered steps (1. Select type → 2. Upload file → 3. Review mapping → 4. Import)
- Add a **"Download Sample"** button for each tab so users know the expected format
- Add a brief **onboarding banner** for first-time users explaining what to do

## Changes

### `src/App.tsx`
- Make `"/"` route the Landing page (public)
- Move dashboard to `"/dashboard"` (protected)
- Update `"/landing"` to redirect to `"/"`

### `src/components/ProtectedRoute.tsx`
- After auth, redirect to `/dashboard` instead of `/`

### `src/pages/Auth.tsx`
- After login, navigate to `/dashboard`

### `src/pages/Landing.tsx`
- Update CTA links from `/auth` to stay consistent; "Get Started" still goes to `/auth`

### `src/pages/ProformaInvoices.tsx`
- In `load()`: fetch `amount_paid` from `sales_invoices` alongside `status`
- Also batch-fetch direct payment sums per invoice_id for accurate balance
- Update balance column to show `total - amount_paid` instead of just `total`
- Store `amount_paid` on each SalesOrder object

### `src/pages/PurchaseProforma.tsx`
- Mirror the same balance fix

### `src/pages/DataImport.tsx`
- Add step indicators (visual numbered steps)
- Add "Download Sample CSV" button per tab
- Add a welcoming onboarding card at the top with tips
- Add smooth transitions between steps using existing animation classes

### `src/components/AppSidebar.tsx` + `src/pages/Index.tsx`
- Update any navigation links from `"/"` to `"/dashboard"`

## Files to Change

| File | Changes |
|------|---------|
| `src/App.tsx` | Swap route: `/` = Landing, `/dashboard` = Index |
| `src/pages/Auth.tsx` | Navigate to `/dashboard` after login |
| `src/components/ProtectedRoute.tsx` | No change needed (Outlet handles it) |
| `src/pages/ProformaInvoices.tsx` | Fix balance column with real payment data |
| `src/pages/PurchaseProforma.tsx` | Mirror balance fix |
| `src/pages/DataImport.tsx` | Add step wizard UX, sample downloads, onboarding tips |
| `src/components/AppSidebar.tsx` | Update home link to `/dashboard` |
| `src/pages/Index.tsx` | Update any self-references |
| `src/pages/Landing.tsx` | Update CTA links |

