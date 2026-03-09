

# Last Price Tracking + Delivery Notes Integration

## Three Changes

### 1. Last Price Given to Customer (Sales Orders)
When a product is selected in the create/edit form and a customer is already chosen, query `proforma_invoices` to find the last order for that customer containing this product, and show the last rate as a hint below the rate field. Auto-fill the rate with last price instead of default selling_price when a previous order exists.

**Implementation**: In `updateItem` (and `updateEditItem`), when `field === "product_id"` and a customer is selected, query:
```sql
SELECT items FROM proforma_invoices 
WHERE customer_id = :customerId 
ORDER BY created_at DESC LIMIT 20
```
Then parse items JSON to find matching product_id and extract the rate. Show as a small text hint: "Last: PKR X" next to the rate input.

### 2. Last Price from Supplier (Purchase Orders)
Same concept for `PurchaseProforma.tsx`. When a product is selected and supplier is chosen, query `purchase_proforma_items` joined with `purchase_proformas` to find the last rate for that product from this supplier.

```sql
SELECT rate FROM purchase_proforma_items 
WHERE product_id = :productId 
AND proforma_id IN (SELECT id FROM purchase_proformas WHERE supplier_id = :supplierId)
ORDER BY created_at DESC LIMIT 1
```

### 3. Move Delivery Notes from Sidebar into Sales Orders Page
- Remove "Delivery Notes" from `AppSidebar.tsx` sidebar menu
- Remove the `/delivery-notes` route from `App.tsx` (keep the page file for reference)
- Add a **"Delivery Notes"** tab as a 4th status button on the Sales Orders page (alongside All, Draft, Invoice)
- When this tab is active, fetch and display all delivery notes from `delivery_notes` table with customer name, showing DN#, Date, Customer, Items count, and action buttons (View PDF, Delete)
- Each DN row clickable to open the PDF preview

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Add last-price lookup on product select; add Delivery Notes tab with DN listing |
| `src/pages/PurchaseProforma.tsx` | Add last-price lookup on product select |
| `src/components/AppSidebar.tsx` | Remove "Delivery Notes" from Sales section |
| `src/App.tsx` | Remove `/delivery-notes` route |

