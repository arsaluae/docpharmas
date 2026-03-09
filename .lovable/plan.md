

# Rebrand to DocPharmas + Add Logo + Data Backup

## 1. Rebrand: Replace "PharmaZen" → "DocPharmas" Everywhere

**Files to update:**
- `index.html` — title, og:title, twitter:title (5 occurrences)
- `src/components/AppSidebar.tsx` — sidebar brand name (line 90)
- `src/pages/Landing.tsx` — navbar, hero text, dashboard mockup label, before/after sections, testimonials, footer (12+ occurrences)
- `src/pages/Auth.tsx` — login page brand (line 65)
- `src/pages/ResetPassword.tsx` — reset page brand (line 80)
- `supabase/functions/reorder-alerts/index.ts` — WhatsApp alert message (line 116)

## 2. Add DocPharmas Logo

- Copy uploaded `DocPharmas_Logo.jpg` to `public/images/docpharmas-logo.jpg` for favicon and to `src/assets/docpharmas-logo.jpg` for React components
- Update `index.html` favicon to use the logo
- Replace the `Pill` icon placeholder with the actual logo image in:
  - `AppSidebar.tsx` — sidebar header
  - `Landing.tsx` — navbar, footer
  - `Auth.tsx` — login page
  - `ResetPassword.tsx` — reset page

## 3. Data Backup Feature

Add a "Data Backup" section in `src/pages/Settings.tsx` (new tab "Backup"):
- **Export All Data** button that fetches all tenant tables (customers, suppliers, products, proforma_invoices, sales_invoices, purchase_invoices, payments, expenses, stock_movements, etc.) and downloads them as a single `.xlsx` file (using existing `xlsx` dependency) with one sheet per table
- Shows last backup timestamp (stored in localStorage)
- Simple, clean UI with a download button and explanation text

**Implementation:** A `handleBackup` function that:
1. Queries each major table via Supabase client (RLS ensures tenant isolation)
2. Creates an xlsx workbook with sheets: Customers, Suppliers, Products, Sales Orders, Sales Invoices, Purchase Orders, Purchase Invoices, Payments, Expenses, Bank Accounts, Stock Movements, Delivery Notes
3. Triggers browser download of `DocPharmas_Backup_YYYY-MM-DD.xlsx`

## Files to Change

| File | Change |
|------|--------|
| `index.html` | Rebrand title/meta + favicon |
| `src/components/AppSidebar.tsx` | Logo image + "DocPharmas" |
| `src/pages/Landing.tsx` | Logo image + all "PharmaZen" → "DocPharmas" |
| `src/pages/Auth.tsx` | Logo image + rebrand |
| `src/pages/ResetPassword.tsx` | Logo image + rebrand |
| `src/pages/Settings.tsx` | Add "Backup" tab with xlsx export |
| `supabase/functions/reorder-alerts/index.ts` | Rebrand alert text |

