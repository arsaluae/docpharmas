

# Fix Critical Bugs + Premium Pharma UI Overhaul

## Three Issues Found

### 1. Supplier Creation Fails for New Users
The `handleSave` function in `Suppliers.tsx` silently swallows errors — it doesn't check the insert/update response for errors. When a new user's tenant isn't properly linked, the RLS policy blocks the insert but the user sees no feedback. Same issue exists in `Customers.tsx` and other CRUD pages.

**Fix**: Add proper error handling to all insert/update calls — check for `error` response and show `toast.error(error.message)`.

### 2. PDF Download/Print Button Doesn't Work
`PdfPreviewDialog` uses `iframe.contentWindow.print()` but the iframe has `sandbox="allow-same-origin allow-scripts allow-popups"` — missing `allow-modals` which is required for `window.print()` to work in sandboxed iframes.

**Fix**: Add `allow-modals` to the sandbox attribute.

### 3. Generic UI → Premium Pharma-Branded UI
The inner app pages (Dashboard, Suppliers, Customers, Sales Orders, etc.) use plain shadcn defaults. The landing page has a polished teal/violet/sage pharma palette. The inner app should match.

**Changes across files:**

#### `src/components/AppLayout.tsx`
- Premium gradient header with frosted glass effect
- Brand-colored date badge
- Subtle pharma-themed gradient accent line

#### `src/components/AppSidebar.tsx`
- Premium sidebar with gradient brand header
- Gradient active states matching teal/violet palette
- Section icons with colored backgrounds
- Polished footer with gradient logout button

#### `src/pages/Suppliers.tsx`
- Add error handling to save/delete
- Premium gradient "Add Supplier" button (teal)
- Premium search bar with frosted glass styling
- Table with subtle row hover gradients and pharma-colored badges
- Empty state with pharma-themed illustration styling

#### `src/pages/Customers.tsx`
- Same error handling + UI polish pattern as Suppliers

#### `src/components/PdfPreviewDialog.tsx`
- Add `allow-modals` to sandbox
- Premium header bar with gradient styling

#### `src/pages/Index.tsx` (Dashboard)
- Stat cards with gradient accent borders matching brand palette
- Quick action buttons already premium — minor color refinements

## Files to Change

| File | Changes |
|------|---------|
| `src/components/PdfPreviewDialog.tsx` | Add `allow-modals` to sandbox attribute |
| `src/pages/Suppliers.tsx` | Add error handling on insert/update; premium UI |
| `src/pages/Customers.tsx` | Add error handling on insert/update; premium UI |
| `src/components/AppLayout.tsx` | Premium gradient header, pharma branding |
| `src/components/AppSidebar.tsx` | Premium sidebar with gradient accents |
| `src/index.css` | Add pharma-specific utility classes for gradients |

## Implementation Priority
1. Fix PDF print (one-line fix)
2. Fix supplier/customer save error handling
3. UI overhaul across layout, sidebar, and listing pages

