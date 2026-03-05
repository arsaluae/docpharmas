

# Plan: Bulletproof Import + Premium UI Across All Pages

## Part 1: Fix Import (Critical Bug + Smart Merge + Universal Compatibility)

### Root Cause of Current Failure
The network request shows rows with `"category":""` (empty string) being sent. The `products_category_check` constraint rejects empty strings. The current normalization code (`if (obj.category)`) skips empty strings because `""` is falsy. This is why all 221 rows fail even after the "fix."

### Fix 1: Category Normalization — Handle Empty Strings
In `buildRowObjects()`, change:
```
if (tab === "products" && obj.category) {
```
to:
```
if (tab === "products") {
  const lower = String(obj.category || '').toLowerCase().trim();
  obj.category = VALID_CATEGORIES.has(lower) ? lower : "other";
}
```
This ensures empty strings default to `"other"` instead of being sent as `""`.

### Fix 2: Smart Merge (Duplicate Detection)
Before inserting, query existing records by name (case-insensitive). For each imported row:
- If a match exists: update only fields that are empty/null/zero in the existing record (fill gaps)
- If no match: insert as new
- Show summary: "X new, Y updated, Z skipped"

Implementation:
1. Fetch all existing records from the target table
2. Build a lookup map by `name.toLowerCase()`
3. Split rows into `toInsert[]` and `toUpdate[]`
4. For updates, use individual `.update()` calls with only the non-empty fields from import
5. Batch insert new rows as before

### Fix 3: Universal Column Mapping
Expand aliases massively to handle data from 20+ different software formats. Add aliases for:
- "item description", "material", "article", "description" → name
- "rate", "unit price", "price per unit" → selling_price
- "purchase rate", "buying price" → cost_price  
- "opening qty", "stock on hand", "available qty" → stock_quantity
- "type", "group", "class" → category
- "uom", "unit of measure" → unit
- "contact person", "poc" → name (for customers/suppliers)
- "gst no", "gstin", "tax id" → ntn
- "mobile no", "cell no", "whatsapp" → phone
- "postal code", "zip" → city (append)
- "street", "address line 1" → address

### Fix 4: SKU Conflict Handling
The `products.sku` column has a UNIQUE constraint. Empty SKU strings fail on batch insert if multiple rows have `""`. Fix: convert empty SKU to `null` before insert.

## Part 2: Premium UI Across All Pages

The app currently has inconsistent styling — Dashboard and DataImport use the Ivory Clinical theme with `glass-card`, `font-heading`, backdrop-blur headers, while other pages use basic styling. Need to unify all 20+ pages.

### Design System (Already Exists — Just Not Applied Everywhere)
- **Headers**: Sticky, `bg-background/80 backdrop-blur-xl`, border-b, Sora heading font
- **Cards**: `glass-card` class (already in CSS)
- **Status pills**: Use theme colors (primary for active, warning for pending, destructive for critical)
- **Tables**: Inside `glass-card`, with `hover:bg-accent/50` rows
- **Dialogs**: Rounded-xl, proper padding
- **Buttons**: Rounded-xl on primary actions
- **Empty states**: Centered icon + message + guidance text
- **No emerald/amber/green** — use primary (sapphire), warning (violet), destructive (rose) from theme

### Pages to Update (all get consistent premium header + glass-card tables + theme colors)

| Page | Key Changes |
|------|------------|
| `Customers.tsx` | Premium header with backdrop-blur, glass-card table wrapper, theme-colored badges |
| `Suppliers.tsx` | Same pattern, replace amber badges with warning color |
| `Products.tsx` | Replace emerald/amber stock badges with theme colors |
| `Payments.tsx` | Premium header, glass-card, theme status colors |
| `Expenses.tsx` | Premium header, replace raw category badges |
| `BankAccounts.tsx` | Premium header, glass-card cards |
| `SalesInvoices.tsx` | Already partially themed, unify status colors |
| `SalesReturns.tsx` | Premium header, glass-card |
| `PurchaseReturns.tsx` | Premium header, glass-card |
| `ProformaInvoices.tsx` | Already themed, minor color fixes |
| `PurchaseProforma.tsx` | Already themed, minor color fixes |
| `PurchaseOrders.tsx` | Already themed, minor color fixes |
| `GoodsReceivedNotes.tsx` | Already themed, minor color fixes |
| `PurchaseInvoicesPage.tsx` | Already themed, minor color fixes |
| `DeliveryNotes.tsx` | Already themed, minor color fixes |
| `WarrantyInvoices.tsx` | Premium header, glass-card |
| `Settings.tsx` | Premium header |
| `Reports.tsx` | Premium header |
| `StockMovements.tsx` | Premium header, glass-card |
| `Auth.tsx` | Premium login card styling |
| `CustomerLedger.tsx` | Premium header |
| `SupplierLedger.tsx` | Premium header |
| All report pages (11) | Premium header pattern |

### Color Replacement Map
- `emerald-*` → `primary` (sapphire) for positive states
- `amber-*` → `warning` (violet) for caution states
- `rose-*` / `red-*` → `destructive` for critical states
- `blue-*` → `primary` for info states
- `green-*` → `primary` for success states

### Sidebar Enhancement
- Add subtle gradient to sidebar background
- Improve active state indicator animation

## Implementation Order (All at Once)

Given this is a large change touching 25+ files, I will:
1. First fix DataImport.tsx (critical bug + smart merge + expanded aliases)
2. Then systematically update each page's header and table styling to use the premium pattern
3. Replace all off-theme colors (emerald, amber, etc.) with theme tokens

## Files Changed

| File | Changes |
|------|---------|
| `DataImport.tsx` | Fix empty category bug, smart merge, expanded aliases, SKU null handling |
| `Customers.tsx` | Premium header, glass-card table, theme badges |
| `Suppliers.tsx` | Premium header, glass-card table, replace amber with warning |
| `Products.tsx` | Replace emerald/amber with theme colors |
| `Payments.tsx` | Premium header, glass-card, theme status |
| `Expenses.tsx` | Premium header, glass-card, theme badges |
| `BankAccounts.tsx` | Premium header, glass-card |
| `SalesReturns.tsx` | Premium header, glass-card |
| `PurchaseReturns.tsx` | Premium header, glass-card |
| `WarrantyInvoices.tsx` | Premium header, glass-card |
| `Settings.tsx` | Premium header |
| `StockMovements.tsx` | Premium header, glass-card |
| `Auth.tsx` | Premium card styling |
| `CustomerLedger.tsx` | Premium header |
| `SupplierLedger.tsx` | Premium header |
| `Reports.tsx` | Premium header |
| `SalesInvoices.tsx` | Unify status colors |
| `PurchaseInvoicesPage.tsx` | Unify status colors |
| `ProformaInvoices.tsx` | Minor color fixes |
| `PurchaseProforma.tsx` | Minor color fixes |
| `PurchaseOrders.tsx` | Minor color fixes |
| `GoodsReceivedNotes.tsx` | Minor color fixes |
| `DeliveryNotes.tsx` | Minor color fixes |
| `Index.tsx` | Replace emerald/amber/rose with theme tokens |
| `AppSidebar.tsx` | Subtle styling enhancement |
| Report pages (11) | Premium header pattern |
| `src/index.css` | Add any missing utility classes |

