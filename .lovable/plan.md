

# Mobile-First Redesign, Data Export & Import Simplification

## Issues Identified

1. **Mobile (384px viewport)**: Tables with 8-10 columns are unusable -- horizontal scroll on tiny screens. Summary cards overflow. Dashboard KPI labels get truncated. The DataImport step wizard (1→2→3→4) overflows horizontally. Import result cards stack poorly.

2. **Products vs Inventory in Import**: You're right -- "Products" imports product catalog data (name, price, stock qty) and "Inventory" imports stock adjustments (product_name, quantity, batch). But for most users, "inventory" IS products. The distinction is confusing. The inventory tab should be renamed to "Stock Adjustments" and the description clarified.

3. **No Export function**: No way to export Customers, Products, Suppliers, or any data to CSV/Excel.

4. **UI Complexity**: Tables show too many columns on mobile. Listing pages have dense information that doesn't adapt well to small screens.

## Plan

### 1. Data Export Function (All Listing Pages)
Add an "Export" button next to search on Customers, Products, Suppliers, Expenses, Payments, Salaries, CreditNotes pages. Uses the `xlsx` library (already installed) to export filtered data as `.xlsx`.

Create a reusable `exportToExcel(data, columns, filename)` utility in `src/lib/export-utils.ts`.

Add export button to each listing page's header actions.

### 2. Merge Import Tabs: Rename "Inventory" to "Stock Adjustments"
- Rename the tab label from "Inventory" to "Stock Adjustments"
- Update icon from 📦 to 🔄
- Update description to "Adjust stock quantities by product & batch (not for adding new products)"
- Add a helper note: "To add new products with stock, use the Products tab"

### 3. Mobile-Friendly Tables (Card View on Mobile)
For all major listing pages (Customers, Products, Suppliers, Expenses, Payments, Salaries, CreditNotes), on mobile (<640px) render each row as a stacked card instead of a table row:

```text
┌─────────────────────┐
│ Customer Name    [▸] │
│ Company · City       │
│ Balance: PKR 50,000  │
│ Credit: PKR 100,000  │
└─────────────────────┘
```

Implement via a `MobileCard` pattern within each page -- show `<Table>` on `sm:` and above, show card list on mobile.

### 4. Dashboard Mobile Optimization
- KPI cards: Already `grid-cols-2` -- good. But text sizes need tweaking for 384px.
- Quick actions: Already `grid-cols-4` -- reduce to `grid-cols-3` on very small screens with text hidden (icon-only).
- Charts: Already responsive. Keep as-is.
- Expiry/Reorder sections: Stack badges vertically on mobile.

### 5. DataImport Mobile Fixes
- Step wizard (1→2→3→4): Stack vertically on mobile instead of horizontal
- Tab pills: Make horizontally scrollable on mobile
- Import result cards: Stack vertically instead of flex-row
- Column mapping badges: Already wrapping -- good

## Files to Change

| File | Changes |
|------|---------|
| `src/lib/export-utils.ts` | **NEW** -- Reusable Excel export utility |
| `src/pages/Customers.tsx` | Add export button, mobile card view |
| `src/pages/Products.tsx` | Add export button, mobile card view |
| `src/pages/Suppliers.tsx` | Add export button, mobile card view |
| `src/pages/Expenses.tsx` | Add export button, mobile card view |
| `src/pages/Payments.tsx` | Add export button |
| `src/pages/Salaries.tsx` | Add export button |
| `src/pages/CreditNotes.tsx` | Add export button |
| `src/pages/DataImport.tsx` | Rename Inventory→Stock Adjustments, mobile layout fixes |
| `src/pages/Index.tsx` | Quick actions mobile grid, KPI mobile tweaks |

