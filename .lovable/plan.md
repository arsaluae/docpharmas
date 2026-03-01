

# Make Tax Settings (GST, WHT, FBR) Optional and Centrally Controlled

## Problem
Currently GST rate is hardcoded at 17% on products, WHT rate is hardcoded at 4.5% on suppliers, and FBR is a simple toggle. These should all be optional -- controlled from one place in Settings, and when disabled, hidden across the entire app.

## Database Change

Add 4 new columns to `company_settings`:

| Column | Type | Default |
|--------|------|---------|
| `gst_enabled` | boolean | `false` |
| `default_gst_rate` | numeric | `17` |
| `wht_enabled` | boolean | `false` |
| `default_wht_rate` | numeric | `4.5` |

## Settings UI Update (`Settings.tsx`)

Replace the existing "FBR Integration" card with a unified **"Tax Configuration"** card containing:
- **GST toggle** + default rate input (when enabled)
- **WHT toggle** + default rate input (when enabled)  
- **FBR QR toggle** (existing)

All saved together with the company profile.

## `useCompanySettings` Hook Update

Add `gst_enabled`, `default_gst_rate`, `wht_enabled`, `default_wht_rate` to the `CompanySettings` interface so every page can read these values.

## Conditional Display Across All Pages

When a tax is **disabled**, hide its columns, fields, and calculations:

| Page | GST off | WHT off | FBR off |
|------|---------|---------|---------|
| **Products.tsx** | Hide "GST Rate" field in form, hide column in table | -- | -- |
| **SalesInvoices.tsx** | Hide GST column in items, skip GST calc, hide GST row in totals | -- | Hide FBR QR button |
| **PurchaseInvoicesPage.tsx** | Hide GST field | Hide WHT field and calc | -- |
| **ProformaInvoices.tsx** | Hide GST in items | -- | -- |
| **PurchaseProforma.tsx** | Hide GST in totals | -- | -- |
| **WarrantyInvoices.tsx** | Hide GST columns | -- | -- |
| **Expenses.tsx** | Hide GST Amount field | -- | -- |
| **Suppliers.tsx** | -- | Hide "WHT Rate" field | -- |
| **TaxCompliance.tsx** | Hide GST tab when off | Hide WHT tab when off | -- |
| **PDF generator** | Skip GST row when off | Skip WHT when off | Skip FBR QR when off |

When a tax is **enabled**, use `default_gst_rate` / `default_wht_rate` from settings as the pre-filled default (instead of hardcoded 17 / 4.5).

## Files Changed

| File | Change |
|------|--------|
| New migration | Add 4 columns to `company_settings` |
| `src/hooks/useCompanySettings.tsx` | Extend interface with new fields |
| `src/pages/Settings.tsx` | Replace FBR card with Tax Configuration card |
| `src/pages/Products.tsx` | Conditionally show GST rate field |
| `src/pages/SalesInvoices.tsx` | Conditionally show GST calc + FBR button |
| `src/pages/PurchaseInvoicesPage.tsx` | Conditionally show GST + WHT |
| `src/pages/ProformaInvoices.tsx` | Conditionally show GST |
| `src/pages/PurchaseProforma.tsx` | Conditionally show GST |
| `src/pages/WarrantyInvoices.tsx` | Conditionally show GST |
| `src/pages/Expenses.tsx` | Conditionally show GST Amount field |
| `src/pages/Suppliers.tsx` | Conditionally show WHT Rate field |
| `src/pages/reports/TaxCompliance.tsx` | Conditionally show GST/WHT tabs |
| `src/lib/pdf-generator.ts` | Conditionally render GST/WHT/FBR sections |

