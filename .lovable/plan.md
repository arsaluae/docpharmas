

# Mobile-Friendly Redesign — Landing Page + ERP App

## Overview
Make both the public landing page and the authenticated ERP fully responsive and touch-friendly on mobile devices.

## Landing Page (`src/pages/Landing.tsx`)

### Navbar
- Shrink logo + text on mobile, stack CTA buttons or use a hamburger menu
- Reduce padding: `px-4 py-3` on mobile

### Hero Section
- Reduce heading size: `text-3xl` on mobile (currently jumps from `text-4xl`)
- Hide decorative floating shapes on small screens (`hidden sm:block`)
- Stack CTA buttons vertically on mobile (already using `flex-col sm:flex-row` — good)
- Reduce hero padding: `py-16 md:py-36`

### Dashboard Mockup
- Make the 3-stat grid `grid-cols-1` on very small screens, `grid-cols-3` on `sm+`
- Make the 4-button row `grid-cols-2` on mobile instead of `grid-cols-4`

### Challenges & Features Grids
- Already responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) — minor padding tweaks

### Stats Section
- Currently `grid-cols-2 md:grid-cols-4` — good, reduce text size on mobile: `text-3xl` instead of `text-4xl`

### Pricing Cards
- Already `grid-cols-1 md:grid-cols-2` — add better spacing on mobile

### Footer
- Stack items vertically with centered alignment on mobile

## ERP App Layout

### `src/components/AppLayout.tsx`
- Reduce main content padding on mobile: `p-3 sm:p-6`
- Reduce header padding: `px-3 sm:px-6 py-3 sm:py-4`
- Shrink title text: `text-lg sm:text-xl`

### Dashboard (`src/pages/Index.tsx`)
- KPI row: already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — good
- Quick Actions: change from `grid-cols-2 md:grid-cols-4` to `grid-cols-3 sm:grid-cols-4` with smaller card heights on mobile (`h-[90px] sm:h-[120px]`)
- Charts: reduce height on mobile
- Tables: add horizontal scroll wrapper for small screens
- Reorder alerts: reduce padding

### Sales/Purchase Pages (`ProformaInvoices.tsx`, `PurchaseProforma.tsx`)
- Status cards: ensure they stack properly on mobile with `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`
- Table: wrap in `overflow-x-auto` for horizontal scroll
- Action buttons in table rows: use icon-only on mobile, hide text labels
- Create/Edit dialog: make full-width on mobile with `max-w-full sm:max-w-4xl`
- Month selector: stack above cards on mobile

### All List Pages (Customers, Suppliers, Products, etc.)
- Ensure tables have `overflow-x-auto` wrappers
- Reduce cell padding on mobile

### Sidebar (`AppSidebar.tsx`)
- Already uses Sheet on mobile via the sidebar component — no changes needed

## Files to Edit

| File | Changes |
|------|---------|
| `src/pages/Landing.tsx` | Responsive navbar, hero sizing, mockup grid, footer stacking |
| `src/components/AppLayout.tsx` | Reduce padding/title size on mobile |
| `src/pages/Index.tsx` | Smaller quick action cards, chart heights, table scroll |
| `src/pages/ProformaInvoices.tsx` | Status card grid, table scroll, dialog sizing, compact row actions |
| `src/pages/PurchaseProforma.tsx` | Mirror ProformaInvoices mobile fixes |
| `src/index.css` | Add mobile utility classes if needed |

