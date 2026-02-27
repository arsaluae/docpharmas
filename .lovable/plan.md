

# Phase B: Ledgers, Returns, Reports & Bulk Import/Delete

## Scope
14 deliverables: Customer/Supplier ledger views, Sales Returns, Purchase Returns, 4 new report pages, CSV bulk import with batch delete for Customers/Suppliers/Products/Inventory, plus routing and sidebar updates.

## No Database Changes Needed
All required tables already exist: `sales_returns`, `sales_return_items`, `purchase_returns`, `purchase_return_items`, `customers` (has `area`), `stock_movements`, etc.

## New Pages (9 files)

### 1. `src/pages/CustomerLedger.tsx`
- Route: `/customers/:id/ledger`
- Shows: all sales invoices, payments received, sales returns for the customer, chronologically
- Running balance calculation
- Summary cards: total sales, total received, outstanding

### 2. `src/pages/SupplierLedger.tsx`
- Route: `/suppliers/:id/ledger`
- Shows: all POs, purchase invoices, payments made, purchase returns, additional costs (where vendor_id = supplier)
- Running balance, summary cards

### 3. `src/pages/SalesReturns.tsx`
- Route: `/sales-returns`
- CRUD with line items: select customer, link to sales invoice, add return items with product, batch_number, quantity, rate
- Auto-number SR-0001
- Updates `sales_returns` + `sales_return_items` tables

### 4. `src/pages/PurchaseReturns.tsx`
- Route: `/purchase-returns`
- Same pattern: select supplier, link to purchase invoice, line items with product, batch, qty, rate
- Auto-number PR-0001

### 5. `src/pages/reports/ItemWiseReport.tsx`
- Route: `/reports/item-wise`
- Per product: total purchased qty, total sold qty, current stock, total revenue, total cost
- Date range filter

### 6. `src/pages/reports/BatchWiseReport.tsx`
- Route: `/reports/batch-wise`
- Per batch: product name, batch_number, expiry_date, qty received (from GRN), qty sold (from sales_invoice_items), remaining
- Filter by product, highlight near-expiry

### 7. `src/pages/reports/CustomerWiseReport.tsx`
- Route: `/reports/customer-wise`
- Per customer: total sales, returns, payments, balance
- Filter by area (from customers.area column)
- Area-wise summary totals

### 8. `src/pages/reports/SupplierWiseReport.tsx`
- Route: `/reports/supplier-wise`
- Per supplier: total purchases, returns, payments, balance

### 9. `src/pages/DataImport.tsx`
- Route: `/import`
- Tabs: Customers | Suppliers | Products | Inventory (opening stock)
- CSV upload with file input, parse client-side using simple split logic (no extra lib needed)
- Preview table showing parsed rows before import
- Column mapping hints (show expected columns)
- "Import Batch" button: inserts all rows, tags them with a `batch_id` (generated UUID stored in a `notes` or via a convention)
- After import: shows success count + error count
- "Delete This Import Batch" button: deletes all records created in that batch
- Individual delete: each row in Customers/Suppliers/Products tables gets a delete button (with confirmation dialog)
- For inventory import: creates stock_movements with type `adjustment` and a batch reference

## Modified Pages (4 files)

### 10. `src/pages/Customers.tsx`
- Add "View Ledger" button per row (navigates to `/customers/:id/ledger`)
- Add individual delete button with confirmation
- Add "Import CSV" button linking to `/import?tab=customers`

### 11. `src/pages/Suppliers.tsx`
- Same: ledger link, delete button, import link

### 12. `src/pages/Products.tsx`
- Add delete button with confirmation
- Add import link

### 13. `src/App.tsx`
- Add routes: `/customers/:id/ledger`, `/suppliers/:id/ledger`, `/sales-returns`, `/purchase-returns`, `/reports/item-wise`, `/reports/batch-wise`, `/reports/customer-wise`, `/reports/supplier-wise`, `/import`

### 14. `src/components/AppSidebar.tsx`
- Sales section: add "Sales Returns"
- Purchases section: add "Purchase Returns"
- Reports section: add Item-wise, Batch-wise, Customer-wise, Supplier-wise
- Add "Data Import" under a new "Settings" section

## Bulk Import Technical Approach
- Parse CSV client-side: `FileReader` + `text.split('\n')` + `row.split(',')`
- Generate a `batch_id` UUID for each import session
- Store `batch_id` in the record's `notes` field (or a dedicated approach) so we can query and delete by batch
- For customers: map columns `name, company, ntn, strn, phone, email, address, city, credit_limit, credit_days, opening_balance`
- For suppliers: `name, company, ntn, strn, phone, email, address, city, payment_terms_days, wht_rate, opening_balance`
- For products: `name, sku, category, drap_reg_number, pack_size, unit, cost_price, selling_price, gst_rate, stock_quantity, reorder_level`
- For inventory: `product_name (matched to product_id), quantity, batch_number, notes` → creates stock_movements
- Delete batch: `DELETE FROM table WHERE notes LIKE 'IMPORT:batch_id'`

## Implementation Order
1. Customer & Supplier ledger pages
2. Sales Returns & Purchase Returns pages
3. All 4 report pages
4. DataImport page with CSV parsing and batch delete
5. Update Customers/Suppliers/Products pages with delete + ledger + import buttons
6. Update App.tsx routes + AppSidebar navigation

