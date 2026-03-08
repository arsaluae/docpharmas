

# System Audit — Errors and Issues Found

## CRITICAL Issues

### 1. `proforma_invoices.status` CHECK constraint blocks "invoiced" status
The database constraint only allows: `draft, sent, converted`. But the app writes `status: "invoiced"` (line 438 of ProformaInvoices.tsx). This means the proforma status update silently fails after invoice creation — the proforma stays as "draft" in the database even though the invoice was created successfully.

**Fix**: Update the CHECK constraint to include `invoiced, ordered, approved`.

### 2. `payments.party_type` CHECK constraint blocks "printer" payments
The constraint only allows: `customer, supplier`. But the Payments UI allows selecting "printer" as a party type (line 172). Any payment made to a printer will silently fail.

**Fix**: Add `printer` to the `payments_party_type_check` constraint.

### 3. `expenses.category` CHECK constraint blocks many categories
The constraint allows only: `utilities, salaries, rent, transport, maintenance, marketing, regulatory, other`. But the UI offers additional categories: `travel, license_renewal, insurance, office_supplies, communication, professional_fees, depreciation, food, personal`. Any expense with these categories fails silently.

**Fix**: Expand the constraint to include all categories used in the UI.

### 4. `sales_returns.status` CHECK constraint blocks "confirmed" status
The constraint allows: `draft, approved, processed`. But the code inserts `status: "confirmed"` (SalesReturns.tsx line 67). Every sales return creation fails silently.

**Fix**: Add `confirmed` to the constraint.

### 5. Returns don't create stock movements
Neither `SalesReturns.tsx` nor `PurchaseReturns.tsx` insert stock movements when a return is created. This means:
- Sales returns don't add stock back (should be `return_in`)
- Purchase returns don't remove stock (should be `return_out`)

Inventory is never adjusted for returns.

**Fix**: Add stock movement inserts in both return handlers.

### 6. `purchase_proformas.status` likely has constraint issues
The app writes `status: "ordered"` (line 312 of PurchaseProforma.tsx) but the `purchase_proformas` table likely has a CHECK constraint that may not include `ordered`. Need to verify and fix.

---

## MODERATE Issues

### 7. Payment edit uses delete-then-insert (loses original ID)
Both `Payments.tsx` and `Expenses.tsx` use a delete-then-insert pattern for edits. This means:
- The original record ID is lost (new UUID generated)
- Any foreign key references to the old payment ID break
- Balance triggers fire twice (delete reversal + insert)
- The `handle_payment_invoice_status` trigger recalculates invoice status twice unnecessarily

### 8. Stock movements page only shows 5 movement types in filter
`MOVE_TYPES` only lists `purchase_in, sale_out, return_in, return_out, adjustment` but the system uses many more types. Users can't filter by `adjustment_in`, `adjustment_out`, `opening`, `damage`, `expired`.

### 9. Dashboard queries don't filter by tenant
`Index.tsx` queries `sales_invoices`, `sales_invoice_items`, `stock_movements`, `products`, and `customers` without explicit tenant filtering. While RLS handles this, the `sales_invoice_items` query fetches ALL items without date filtering first (line 48), then filters client-side — potentially hitting the 1000-row limit.

### 10. No `purchase_proformas.status` constraint listed
The `purchase_proformas` table has no CHECK constraint on `status` in the query results. If one exists elsewhere or is missing, the `status: "ordered"` write may or may not work. Should verify.

---

## Implementation Plan

### A. Database migration to fix all CHECK constraints

| Table | Current Allowed | Missing Values |
|-------|----------------|----------------|
| `proforma_invoices.status` | draft, sent, converted | `invoiced, ordered, approved` |
| `payments.party_type` | customer, supplier | `printer` |
| `expenses.category` | 8 values | `travel, license_renewal, insurance, office_supplies, communication, professional_fees, depreciation, food, personal` |
| `sales_returns.status` | draft, approved, processed | `confirmed` |

### B. Add stock movements to Returns

- **SalesReturns.tsx**: After creating return items, insert `return_in` stock movements for each item to restore inventory.
- **PurchaseReturns.tsx**: After creating return items, insert `return_out` stock movements for each item to reduce inventory.

### C. Update StockMovements filter types
- Expand `MOVE_TYPES` array to include all valid movement types.

### D. Fix dashboard query limit risk
- Add `.limit(5000)` or server-side aggregation for `sales_invoice_items` query to avoid hitting the 1000-row cap.

### Files to Change

| File | Change |
|------|--------|
| Migration SQL | Fix 4 CHECK constraints |
| `src/pages/SalesReturns.tsx` | Add `return_in` stock movements |
| `src/pages/PurchaseReturns.tsx` | Add `return_out` stock movements |
| `src/pages/StockMovements.tsx` | Expand filter type list |
| `src/pages/Index.tsx` | Add limit to sales_invoice_items query |

