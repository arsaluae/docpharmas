## Plan

### 1. Fix invoice PDF rows so old and new invoices show serial number + item name
- Update the PDF generator to normalize row keys before rendering templates:
  - `srno` / `idx` / `__rowNum` all resolve to the visible serial number.
  - `product_name` / `name` / `item_name` / `description` all resolve to the visible item name.
- Stop duplicate serial columns by making the auto `#` column compatible with templates that already contain `Sr#`.
- Apply this to Sales Invoice, Purchase Invoice, Purchase Order, GRN, Delivery Note, Print Job PDFs, including previous invoices opened from history.

### 2. Add visible row serial numbers on Sales + Purchase creation screens
- Add a clear `#` column/label in the item entry rows for:
  - Sales Order creation.
  - Purchase Order creation.
  - Edit forms where the same row layout is used.

### 3. Build the print-job availability panel inside purchase invoice flow
On Purchase Order / Purchase Invoice creation, once product + supplier + quantity are selected, show a compact operational panel per item with three choices:

```text
Product: Coliza
Required for invoice: 10,000 pcs

1) Already at pharma factory/supplier: 2,000 pcs
2) Existing print jobs available to dispatch/use: 10,000 pcs
3) Create new print job for shortfall
```

The panel will show:
- Packaging already dispatched to this supplier/factory but not yet consumed.
- Existing delivered print-job stock still available at our side/factory.
- Open/in-progress print jobs for the same product.
- Shortfall against the purchase invoice quantity.
- Action buttons: `Use Factory Qty`, `Use Print Job`, `Create Print Job`.

### 4. Track printing stock correctly by product + supplier
Add a small allocation table to record printing usage against purchase items, so the system knows:
- How many printed pieces were dispatched to a pharma supplier/factory.
- How many were consumed when a purchase invoice/GRN is created.
- What remains at that factory for that product.

This covers your example:
- Print job = 5,000 pcs.
- Pharma factory makes/GRN receives 3,000 pcs.
- Remaining available for Coliza at that factory = 2,000 pcs.

### 5. Keep ledgers separated correctly
- Purchase Invoice stays material only: supplier ledger gets only product cost, e.g. `1,000 × 50 = 50,000`.
- Print Job settlement hits only the Printer/Vendor ledger, e.g. `5,000 × 5 = 25,000`.
- Pharma suppliers and printer vendors remain separate ledgers.
- Remove/avoid any purchase invoice flow that adds printing/packaging cost into the pharma supplier invoice total.

### 6. Connect printing cost to stock/reporting, not customer invoice value
- When purchase stock is received, attach the used printing cost per unit to the received stock costing layer.
- Sales invoice amount remains customer sale value only.
- Reports can later show: material cost + printing cost + gross profit without inflating the customer invoice.

### Technical changes
- Migration: add `purchase_print_allocations` or equivalent tenant-scoped table with RLS for product, supplier, purchase/GRN link, print job link, allocated quantity, consumed quantity, and printing cost per unit.
- `PurchaseProforma.tsx`: add the print availability panel and allocation actions in create/receive invoice flow.
- `PrintJobs.tsx`: expose available delivered qty, dispatched qty, and remaining factory/supplier balance cleanly.
- `PrinterLedger.tsx` / print job settlement: verify printer balance is updated only from print jobs/payments, not supplier invoices.
- `pdf-generator.ts`: repair template key aliases so previous invoice PDFs show `Sr#` and product names correctly.