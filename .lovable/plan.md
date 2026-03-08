

# System Audit — Round 2 Findings

All previous critical constraint issues (proforma status, payment party_type, expense categories, sales return status, stock movement types) have been successfully fixed. The database constraints now match the application code.

## Remaining Issues Found

### 1. Products page has outdated `MOVE_TYPES` filter (MODERATE)
`src/pages/Products.tsx` line 20 still uses the old limited list:
```
const MOVE_TYPES = ["purchase_in", "sale_out", "return_in", "return_out", "adjustment"];
```
Missing: `purchase`, `sale`, `adjustment_in`, `adjustment_out`, `opening`, `damage`, `expired`. Users filtering stock movements from the Products tab won't see all movement types.

**Fix**: Update to match the full list already used in `StockMovements.tsx`.

### 2. Delivery Note PDF doesn't show customer name (MODERATE)
`DeliveryNotes.tsx` line 53 generates the PDF without `partyLabel` / `partyName`. The delivery note has `customer_id` stored but the `load()` function only does `select("*")` — it doesn't join with `customers`. So neither the list view nor the PDF shows which customer the delivery is for.

**Fix**: Join `customers(name)` in the delivery notes query and pass `partyLabel: "Customer"` / `partyName` to `generatePdfHtml`.

### 3. Print Jobs delivery doesn't create stock movements (MODERATE)
When a print job is marked "delivered" (`PrintJobs.tsx` line 100), the delivered quantity is recorded but no `purchase_in` stock movement is created. The printed goods are not added to inventory.

**Fix**: Insert a `purchase_in` stock movement when a print job is delivered.

### 4. Payment edit uses delete-then-insert pattern (LOW)
Both `Payments.tsx` and `Expenses.tsx` use delete + re-insert for edits. This causes:
- Balance triggers fire twice (reversal + new insert)
- Original record ID is lost
- Invoice status recalculation runs twice

This works but is inefficient and can cause momentary balance inconsistencies. Leaving as-is for now since fixing requires changing to proper UPDATE logic which is more complex.

### 5. Customer/Supplier "area" field not shown in Delivery Note (LOW)
The delivery note stored items don't include the customer area, which could be useful for dispatch routing. This is a minor enhancement, not a bug.

## Implementation Plan

| File | Change |
|------|--------|
| `src/pages/Products.tsx` | Update `MOVE_TYPES` to full list |
| `src/pages/DeliveryNotes.tsx` | Join `customers(name)` in query; show customer name in table and PDF |
| `src/pages/PrintJobs.tsx` | Add `purchase_in` stock movement on delivery |

These are the only remaining actionable issues. The previous constraint fixes and stock movement additions are all verified as deployed correctly.

