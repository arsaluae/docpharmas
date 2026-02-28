

# Add Delete Functionality to Proforma Invoices, Purchase Proformas & Delivery Notes

## Changes

### 1. `src/pages/ProformaInvoices.tsx`
- Add bulk select (checkboxes + select all) like Customers page
- Add individual delete button (Trash icon) per row
- Add floating "Delete X selected" bar when items selected
- Delete uses batch `.in()` calls

### 2. `src/pages/PurchaseProforma.tsx`
- Same bulk select + individual delete pattern
- When deleting, also delete related `purchase_proforma_items` via `.in("proforma_id", ids)`
- Then delete the proformas themselves

### 3. `src/pages/DeliveryNotes.tsx`
- Add bulk select + individual delete
- Simple delete from `delivery_notes` table (no child records)

### 4. `src/pages/PurchaseInvoicesPage.tsx`
- Add individual delete button per purchase invoice row
- Add bulk select + delete pattern

All deletes use confirmation dialog via `window.confirm()` and batch `.in()` chunked by 200.

| File | Change |
|------|--------|
| `ProformaInvoices.tsx` | Add select-all, checkboxes, bulk delete, individual delete |
| `PurchaseProforma.tsx` | Add select-all, checkboxes, bulk delete (cascade items), individual delete |
| `DeliveryNotes.tsx` | Add select-all, checkboxes, bulk delete, individual delete |
| `PurchaseInvoicesPage.tsx` | Add select-all, checkboxes, bulk delete, individual delete |

