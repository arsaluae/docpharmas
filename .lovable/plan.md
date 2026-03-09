

# Sales & Purchase Order Workflow Improvements

## Changes Overview

### 1. Sales Orders: Add Void/Rollback for Invoiced Orders
Currently once a draft is submitted (creating invoice + delivery note + stock movements), there's no way to undo it. Add a "Void" button that:
- Deletes the associated `sales_invoice` and its `sales_invoice_items`
- Deletes the associated `delivery_note`
- Deletes the `stock_movements` linked to that invoice (which auto-restores inventory via the trigger)
- Resets the proforma back to `draft` status (clears `converted_invoice_id`)

The Void button will appear for orders with status `invoiced` or `dispatched`, with a confirmation dialog.

### 2. Sales Orders: Remove "Paid" Status Button
Remove the 5th "Paid" status filter button from the dashboard grid, making it a 4-column grid: All, Draft, Invoiced, Dispatched.

### 3. Purchase Orders: Confirm Creates Invoice + Delivery Note
Currently: Draft → Confirm (creates PO only) → Receive (creates GRN + Bill).
Change to: When a draft purchase order is **confirmed**, also auto-create:
- A **Purchase Invoice** (bill) with the order items and totals
- A **Delivery Note** (without prices, just product names and quantities)

Update the purchase dashboard status buttons to: All, Draft, Confirmed, Received (remove Ordered, keep the receive flow for batch/expiry assignment).

### 4. Purchase Orders: Add Void/Rollback
Same as sales - add ability to void a confirmed purchase order by deleting the auto-created invoice and delivery note, resetting back to draft.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Add `handleVoid` function, void button in actions + preview; remove Paid status button; change grid to 4 columns |
| `src/pages/PurchaseProforma.tsx` | Update `handleConfirmOrder` to also create purchase invoice + delivery note; add `handleVoid`; update status buttons |

## Technical Details

**Sales Void Logic:**
```
1. Get converted_invoice_id from proforma
2. Delete stock_movements where reference_id = invoice_id (trigger restores stock)
3. Delete sales_invoice_items where invoice_id
4. Delete sales_invoices where id (trigger reverses customer balance)
5. Delete delivery_notes where reference_id = invoice_id
6. Update proforma: status = 'draft', converted_invoice_id = null
```

**Purchase Confirm Enhancement:**
After creating the PO (existing code), also:
1. Generate `purchase_invoice` number and insert bill
2. Generate `delivery_note` number and insert DN with supplier_id, items (no prices)

