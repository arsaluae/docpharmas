

# Fix Import Errors + UX Audit & Streamlining

## 1. Import Bug Fix

**Root Cause**: The column mapping does `h.toLowerCase().trim()` to match headers, but Excel files from accounting software often have headers like "Customer Name", "Party Name", "Item Name" etc. — not just "name". Also, empty rows at the end of Excel files produce insert attempts with null `name`.

**Fix in `DataImport.tsx`**:
- Add smart column alias mapping: e.g., "customer name" / "party name" / "account name" all map to `name`; "item name" / "product name" maps to `name` for products tab; "contact" maps to `phone`; "town" maps to `city`, etc.
- Skip rows where the `name` field is empty/blank (the #1 cause of the current errors)
- Filter out completely empty rows from parsed data before import
- Store imported record IDs in memory so "Delete This Batch" works for ALL tabs (customers/suppliers/products), not just inventory
- Show a validation warning before import if required columns (like `name`) are not found in the headers

## 2. Sidebar Streamlining — Reduce Noise

Current sidebar has 22+ items across 7 sections. Consolidate to fewer, cleaner groups:

**New sidebar structure**:
- **Dashboard** (1 item)
- **Sales** — Customers, Invoices, Returns (3 items — remove separate "Proforma" link, make it accessible from within Sales Invoices page as a tab or button)
- **Purchases** — Suppliers, Orders & GRN, Bills, Returns (4 items — merge "Purchase Proforma" into Purchase Orders as a tab/step, remove standalone link)
- **Inventory** — Products & Stock (1 item — merge Stock Movements into Products page as a tab)
- **Finance** — Payments, Expenses, Bank (3 items)
- **Reports** — Consolidate into a single "Reports" link that opens a reports hub page with cards for each report type (1 item instead of 11)
- **Settings** — Data Import (1 item)

Total: ~14 items down from 22+. Much cleaner.

## 3. Enhanced Products/Inventory Page

Merge Products and Stock Movements into one page with tabs: **Catalog | Stock Overview | Movements**

**Stock Overview tab** (new):
- Table showing: Product Name, Current Stock, Cost Price, Selling Price, Stock Value (qty × cost), Margin %, Reorder Level, Status (OK/Low/Out)
- Summary cards at top: Total Stock Value, Total Retail Value, Low Stock Count, Out of Stock Count
- Color-coded rows: red for out of stock, yellow for low stock

## 4. Dashboard Enhancement

Add to the dashboard:
- **Inventory Value card**: Total stock value (sum of qty × cost_price)
- **Total Retail Value card**: sum of qty × selling_price
- **Recent Activity section**: last 5 sales invoices and purchase orders
- Remove "Quick Start" section (user is past onboarding)

## 5. Reports Hub Page

Create `/reports` as a single landing page with cards linking to each report:
- Financial: P&L, Balance Sheet, Cash Flow
- Receivables & Payables
- Inventory: Product Costing, Item-wise, Batch-wise
- Party: Customer-wise, Supplier-wise
- Compliance: Tax & DRAP

## Files to Create
1. `src/pages/Reports.tsx` — Reports hub page

## Files to Modify
1. `src/pages/DataImport.tsx` — Fix column mapping, skip empty rows, batch delete for all tabs
2. `src/components/AppSidebar.tsx` — Streamlined navigation
3. `src/pages/Products.tsx` — Add Stock Overview tab with value calculations
4. `src/pages/Index.tsx` — Enhanced dashboard with inventory value + recent activity
5. `src/App.tsx` — Add `/reports` route

