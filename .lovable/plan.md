

# Revamp: Connected Purchase & Sales Workflow with Additional Costs, Ledgers & Enhanced Reporting

This is a significant rework of the existing flow to match the real pharma business workflow described.

## Current Problems
- Proforma (purchase side) doesn't exist — only sales proforma exists
- No linked flow: Proforma → PO → GRN with quantity variance handling
- No additional costs (printing/packaging) that hit a different ledger (printer) but affect item cost
- Sales proforma doesn't have payment instructions or convert properly with batch/qty selection
- No customer/supplier ledger views
- No sales returns or purchase returns pages
- No freight in/out cost tracking
- Reports lack item-wise, batch-wise, customer-wise, area-wise, supplier-wise breakdowns

## Database Changes (Migration)

### New Tables
1. **`purchase_proformas`** — id, proforma_number, supplier_id FK, date, validity_days, items jsonb, subtotal, gst, total, status (draft/sent/confirmed/converted), converted_po_id, notes, created_at
2. **`purchase_proforma_items`** — id, proforma_id FK, product_id FK, quantity_requested, quantity_confirmed (factory may confirm less), rate, amount
3. **`additional_costs`** — id, reference_type (purchase_proforma/purchase_order/grn), reference_id uuid, cost_type (printing/packaging/freight_in/freight_out/other), description, amount, vendor_id uuid nullable (the printer/packager — references suppliers table), date, notes, created_at
   - This table tracks costs like printing/packaging. `vendor_id` points to the printer/packager supplier so it hits THEIR ledger, while `reference_id` links to the PO/proforma so the cost is reflected on the item's landed cost.
4. **`purchase_returns`** — id, return_number, supplier_id FK, purchase_invoice_id FK nullable, date, total, reason, status, created_at
5. **`purchase_return_items`** — id, return_id FK, product_id FK, batch_number, quantity, rate, amount
6. **`sales_return_items`** — id, return_id FK→sales_returns, product_id FK, batch_number, quantity, rate, amount

### Alter Existing Tables
- **`purchase_orders`**: add column `proforma_id uuid nullable` (link back to purchase proforma)
- **`purchase_order_items`**: add `quantity_confirmed numeric default 0` (factory confirms different qty)
- **`grn_items`**: add `product_id uuid nullable` (to properly link received items to products for stock)
- **`proforma_invoices`** (sales): add `payment_instructions text nullable`
- **`sales_invoice_items`**: already has `batch_number` — good
- **`customers`**: add `area text nullable` (for area-wise reporting)

### RLS
All new tables get the same authenticated CRUD policies as existing tables.

## Workflow Changes

### Purchase Flow (Revised)
1. **Purchase Proforma** (`/purchase-proforma`): User creates a proforma to the supplier/factory (e.g., 5000 units of Coliza). Can add additional costs (printing, packaging) — these link to printer's ledger via `vendor_id`.
2. **Convert to PO** (`/purchase-orders`): From proforma, convert to PO. Factory confirms quantities (may be 3000 instead of 5000). `quantity_confirmed` tracked.
3. **GRN** (`/grn`): When goods arrive, record received quantities (may be 2900 or 3050). Batch number and expiry assigned here. Variance between confirmed and received auto-creates a stock adjustment note.
4. **Purchase Invoice** (`/purchase-invoices`): Bill from supplier with WHT.

### Sales Flow (Revised)
1. **Sales Proforma** (`/proforma`): Send proforma to customer with payment instructions. Status: draft → sent → payment_received → converted.
2. **Convert to Sales Invoice** (`/sales-invoices`): Once payment confirmed, convert proforma to invoice. During conversion, user selects batch numbers and quantities from available stock.
3. **Sales Returns** (`/sales-returns`): Credit notes with item-level returns (product, batch, qty).

### Additional Costs
- Can be added on Purchase Proforma, PO, or GRN
- Each cost has a `vendor_id` (e.g., the printer) — this affects the vendor's ledger
- The cost amount is added to the item's landed cost for product costing reports
- Cost types: printing, packaging, freight_in, freight_out, other

### Ledger Views
- **Customer Ledger** (on Customers page): Click a customer → see all sales invoices, payments received, sales returns, running balance
- **Supplier Ledger** (on Suppliers page): Click a supplier → see all POs, purchase invoices, payments made, purchase returns, additional costs (where they are the vendor), running balance

### Returns
- **Sales Returns** (`/sales-returns`): Full page with item-level detail (product, batch, qty, rate)
- **Purchase Returns** (`/purchase-returns`): New page — return to supplier with item-level detail

### Freight
- Handled via `additional_costs` table with cost_type `freight_in` or `freight_out`
- Freight in: added on purchase side (increases landed cost)
- Freight out: added on sales side (tracked as expense)

## Enhanced Reports
Update existing report pages + add new ones:

- **Item-wise Report** (`/reports/item-wise`): Sales/purchases/stock by product
- **Batch-wise Report** (`/reports/batch-wise`): Stock, sales, expiry by batch
- **Customer-wise Report** (`/reports/customer-wise`): Sales, returns, balance by customer
- **Area-wise Report** (`/reports/area-wise`): Sales by customer area/city
- **Supplier-wise Report** (`/reports/supplier-wise`): Purchases, returns, balance by supplier

## Pages to Create/Modify

### New Pages (8)
1. `src/pages/PurchaseProforma.tsx` — Purchase proformas with additional costs + convert to PO
2. `src/pages/PurchaseReturns.tsx` — Purchase returns with line items
3. `src/pages/SalesReturns.tsx` — Revamp existing (currently minimal) to include line items with batch selection
4. `src/pages/CustomerLedger.tsx` — Detailed ledger for a single customer (linked from Customers page)
5. `src/pages/SupplierLedger.tsx` — Detailed ledger for a single supplier
6. `src/pages/reports/ItemWiseReport.tsx`
7. `src/pages/reports/BatchWiseReport.tsx`
8. `src/pages/reports/CustomerWiseReport.tsx` (includes area-wise filter)
9. `src/pages/reports/SupplierWiseReport.tsx`

### Modified Pages (7)
1. `src/pages/ProformaInvoices.tsx` — Add payment instructions field, improve convert-to-invoice with batch/qty selection
2. `src/pages/PurchaseOrders.tsx` — Add "from proforma" linking, quantity_confirmed column
3. `src/pages/GoodsReceivedNotes.tsx` — Auto-populate from PO items, track variance, assign batch/expiry, auto stock adjustment
4. `src/pages/SalesInvoices.tsx` — Batch selection when creating from proforma conversion
5. `src/pages/Customers.tsx` — Add area field, link to customer ledger view
6. `src/pages/Suppliers.tsx` — Link to supplier ledger view
7. `src/components/AppSidebar.tsx` — Add new nav items
8. `src/App.tsx` — Add new routes

## Implementation Phases

Given scope, split into **2 phases**:

**Phase A (this implementation):**
1. Database migration (new tables + alter existing)
2. Purchase Proforma page with additional costs
3. Rework PO to link from proforma with confirmed quantities
4. Rework GRN with variance handling + batch assignment + auto stock adjustment
5. Sales Proforma with payment instructions + convert with batch selection
6. Update sidebar + routes

**Phase B (next message):**
7. Customer & Supplier ledger views
8. Sales Returns with line items + batch
9. Purchase Returns with line items
10. All 4 new report pages (item/batch/customer+area/supplier-wise)
11. Freight in/out via additional costs on both sides

## Technical Details
- `additional_costs.vendor_id` references suppliers table (printers, packagers are added as suppliers with a category)
- GRN variance: if received != confirmed, auto-insert `stock_movements` with type `adjustment` and notes explaining variance
- Sales invoice conversion from proforma: dialog shows available batches (from stock_movements/grn_items) for each product, user picks batch + qty
- Ledger views aggregate: invoices + payments + returns chronologically with running balance
- Area field on customers enables area-wise grouping in reports

