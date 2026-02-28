

# Add Bulk Delete to Sales Invoices + Detail/Edit Dialogs for All Documents

## 1. Sales Invoices — Bulk Delete (`SalesInvoices.tsx`)

- Add `selected: Set<string>` state, select-all checkbox in header, per-row checkboxes
- Add floating "Delete X selected" action bar
- Batch delete: first `sales_invoice_items.delete().in("invoice_id", chunk)`, then `sales_invoices.delete().in("id", chunk)`
- Add individual Trash2 button per row

## 2. Sales Invoice Detail/Edit Dialog (`SalesInvoices.tsx`)

- Click on any invoice row → opens a detail dialog showing full invoice info
- Header: invoice number, customer, date, due date, status, notes
- Table of line items fetched from `sales_invoice_items` with product names
- Totals summary (subtotal, discount, GST, total)
- Edit mode toggle: allows changing customer, date, due date, notes, and line items
- Save updates both `sales_invoices` and replaces `sales_invoice_items`

## 3. Proforma Detail/Edit Dialog (`ProformaInvoices.tsx`)

- Click on proforma row → detail dialog with all fields
- Shows items parsed from JSON, customer, validity, payment instructions
- Edit mode: modify customer, date, validity, payment instructions, items
- Save updates proforma record and items JSON
- Only editable when status is `draft` or `approved`

## 4. Purchase Proforma Detail/Edit Dialog (`PurchaseProforma.tsx`)

- Click on row → detail dialog with supplier, items, additional costs
- Items fetched from `purchase_proforma_items`, costs from `additional_costs`
- Edit mode: modify supplier, date, validity, notes, items, additional costs
- Save updates proforma, replaces items and costs
- Only editable when status is `draft` or `approved`

## 5. Delivery Note Detail/Edit Dialog (`DeliveryNotes.tsx`)

- Click on row → detail dialog showing DN number, date, type, items (from JSON)
- Items table: product name, batch, expiry, quantity
- Edit mode: modify date, notes, items JSON
- Save updates delivery note record

## Files Changed

| File | Change |
|------|--------|
| `SalesInvoices.tsx` | Add bulk delete + detail/edit dialog |
| `ProformaInvoices.tsx` | Add detail/edit dialog on row click |
| `PurchaseProforma.tsx` | Add detail/edit dialog on row click |
| `DeliveryNotes.tsx` | Add detail/edit dialog on row click |

