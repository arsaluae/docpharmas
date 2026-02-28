

# Fix Bulk Delete + Redesign PDF Template

## Problem 1: Bulk Delete Timing Out

The current `handleBulkDelete` loops through 1000+ IDs one-by-one with individual `await` calls. This is extremely slow and effectively hangs the UI.

**Fix**: Replace the sequential loop with batch `.in()` deletes in both `Customers.tsx` and `Suppliers.tsx`:

```ts
// Delete all related licenses in one call
await supabase.from("customer_licenses").delete().in("customer_id", ids);
// Delete all customers in one call  
const { error } = await supabase.from("customers").delete().in("id", ids);
```

Note: Supabase `.in()` has a practical limit, so we'll chunk into batches of 200 for safety.

## Problem 2: PDF Template — High-End Redesign

Replace the current basic `pdf-generator.ts` with a premium pharmaceutical-grade template featuring:

- **Letterhead**: Company logo left, company info right with elegant typography, separated by a thin gold accent line
- **Document header**: Centered title with decorative borders, document number in a styled badge
- **Party info**: Two-column layout — document meta on left, customer/supplier details on right in a bordered card
- **Items table**: Alternating row colors, bold header with dark background, proper number formatting with PKR currency, right-aligned amounts
- **Totals section**: Right-aligned summary box with subtotal, discount, GST, and grand total with prominent styling
- **Footer**: Terms/notes section, dual signature lines with labels, page border frame
- **Print-optimized**: Clean `@media print` rules, proper page margins, no browser chrome

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Customers.tsx` | Replace loop delete with batch `.in()` delete (chunked) |
| `src/pages/Suppliers.tsx` | Replace loop delete with batch `.in()` delete (chunked) |
| `src/lib/pdf-generator.ts` | Complete redesign with premium template |

