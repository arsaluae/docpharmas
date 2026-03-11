

# Product Rate in Allocations + Allocation Report + Vacant Area Analysis

## 1. Add Rate to Product Allocations

**Database**: Add a `rate` column to both `customer_products` and `supplier_products` tables.

```sql
ALTER TABLE customer_products ADD COLUMN rate numeric NOT NULL DEFAULT 0;
ALTER TABLE supplier_products ADD COLUMN rate numeric NOT NULL DEFAULT 0;
```

**UI (`AllocatedProducts.tsx`)**: Add a rate input field when allocating a product, and show the rate column in the allocated products table. Allow inline editing of rate.

## 2. New Report: Product Allocation Report

Create `src/pages/reports/ProductAllocationReport.tsx` — a new report page showing:
- **By Product view**: Each product row expands to show which customers and suppliers it's allocated to, with their rates
- **By Customer/Supplier view**: Each party row shows their allocated products and rates
- Filterable by product, customer, or supplier

Add it to `Reports.tsx` under the "Party Reports" section and register the route in `App.tsx`.

## 3. Vacant Area Analysis

Add a new report `src/pages/reports/VacantAreas.tsx` that:
- Fetches all distinct `city` values from `customers` table
- For each product, checks which cities have a customer with that product allocated
- Shows a matrix/list of products vs cities, highlighting **vacant areas** (cities where no customer has that product allocated)
- This helps identify which areas still need coverage for each product

Add to `Reports.tsx` under a new "Coverage" section and register route in `App.tsx`.

## Files to Change

| File | Change |
|------|--------|
| DB migration | Add `rate` column to both junction tables |
| `src/components/AllocatedProducts.tsx` | Add rate input on add, show rate column, allow edit |
| `src/pages/reports/ProductAllocationReport.tsx` | New — allocation report by product/party |
| `src/pages/reports/VacantAreas.tsx` | New — vacant area analysis |
| `src/pages/Reports.tsx` | Add 2 new report cards |
| `src/App.tsx` | Register 2 new routes |

