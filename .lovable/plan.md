

# Fix Customer Editing, Supplier Allocation & Sync Issues

## Current State
- Customer editing works by clicking the row, but there's no explicit "Edit" button in actions — users may not discover this
- Supplier profile dialog already has `AllocatedProducts` with rate support
- Console shows a React ref warning on the Suppliers page (SupplierProfileDialog)
- Customer form is missing the `area` field (used by Vacant Areas report)

## Changes

### 1. Add Edit button to Customer & Supplier action columns
Add an explicit pencil/edit icon button in the actions column for both pages, making editing more discoverable.

### 2. Add `area` field to Customer form
The `customers` table has an `area` column but it's not in the create/edit form. Add it alongside `city` so the Vacant Areas report has proper data.

### 3. Fix SupplierProfileDialog ref warning
The dialog content is a function component without `forwardRef`. Add `DialogDescription` (missing aria) and ensure no ref issues by wrapping properly.

### 4. Add CustomerProfileDialog edit capability
Add an "Edit Details" button inside the CustomerProfileDialog that opens the edit form directly, so users can edit from the profile view.

### 5. Verify AllocatedProducts rate sync
Ensure the rate column in `AllocatedProducts` properly saves/loads for both customer and supplier party types. The component already handles this but will verify the inline edit flow has no race conditions.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Customers.tsx` | Add Edit icon in actions, add `area` field to form |
| `src/pages/Suppliers.tsx` | Add Edit icon in actions |
| `src/components/SupplierProfileDialog.tsx` | Fix ref warning, add DialogDescription |
| `src/components/CustomerProfileDialog.tsx` | Fix DialogDescription warning, add edit trigger |
| `src/components/AllocatedProducts.tsx` | Minor: ensure rate edit saves correctly with no race conditions |

