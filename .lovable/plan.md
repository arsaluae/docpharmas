

# Plan: Fix Data Import — Speed, Mapping Conflicts, Auto-Supplier Creation

## Root Cause of "221 skipped"

The column alias `"supplier" → "name"` causes a **fatal conflict** on the Products tab. Both "Product Name" and "Supplier" resolve to `name`. The supplier column value overwrites the product name, or creates duplicates. Since both map to the same field, data gets corrupted and rows fail.

## Root Cause of Slowness

The import loop does **one `await supabase.insert()` per row** — 221 sequential network round-trips. This should be batched.

## Changes to `src/pages/DataImport.tsx`

### 1. Fix Alias Conflicts — Context-Aware Mapping
- Add a `__supplier_name` special alias for "supplier", "supplier name", "vendor", "vendor name" when importing **products**
- These should NOT resolve to "name" on the products tab
- Update `resolveColumnName` to accept the current tab context and skip conflicting aliases

### 2. Batch Inserts (10-50x faster)
- Replace the one-by-one `for (const row of parsedRows)` loop with **chunked batch inserts**
- Build all row objects first, then insert in chunks of 100 using `supabase.from(table).insert([...chunk])`
- Collect errors per-chunk and report total

### 3. Auto-Create Suppliers During Product Import
- When importing products and a "Supplier" column exists in the file:
  - Extract all unique supplier names from the data
  - Query existing suppliers by name
  - Auto-create any missing suppliers (batch insert)
  - Store the supplier name on each product row (even though products table doesn't have a supplier_id — the suppliers are created as standalone records for later use)
- Toast message: "Also created X new suppliers from your data"

### 4. Auto-Create Missing Data for Other Tabs Too
- When importing customers/suppliers, if a column doesn't match any expected field, just ignore it gracefully (already works)
- When importing inventory, if a product doesn't exist, create it automatically from the row data instead of skipping

### 5. Progress Indicator
- Add a progress bar/counter during import showing "Importing 50/221..."
- Update state during batch processing

### 6. Better Error Reporting  
- Track which rows failed and show first few error messages
- Show a summary like "3 rows had missing names, 2 had database errors"

## Files Changed

| File | Change |
|------|--------|
| `DataImport.tsx` | Fix alias conflicts, batch inserts, auto-supplier creation, progress UI, better errors |

## Technical Notes
- No database changes needed
- Batch insert uses `supabase.from().insert([array]).select("id")` — returns all IDs at once
- Chunks of 100 rows keep request size reasonable
- Supplier auto-creation uses upsert-like logic: check existing by name first, only create new ones

