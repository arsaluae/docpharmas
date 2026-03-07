

# Plan: Dashboard Redesign, Collapsible Sidebar, Printing Integration & Data Wipe

## 1. Dashboard Redesign (`src/pages/Index.tsx`)

Complete rewrite of the dashboard with this layout:

**Row 1 — Sales Stats (4 cards)**
- This Week Sale | This Month Sale | Gross Margin (Month Sale - Cost Price of sold items) | Net Profit

**Row 2 — Quick Action Buttons (4 attractive gradient buttons)**
- Sales Order → `/proforma`
- Sales Invoice → `/proforma` (opens invoice tab)
- Warranty Invoice → `/warranty-invoices`
- Payment → `/payments`
- Style: Large gradient buttons with icons, hover animations, rounded corners

**Row 3 — Two Side-by-Side Panels**
- LEFT: "New Stock In" — 5 most recent stock movements with type `purchase_in`, showing product name + quantity
- RIGHT: "Top Selling Items (This Month)" — Top 5 products by quantity sold this month

**Row 4 — Top Customers Panel (full width)**
- Shows top customers with columns: Customer Name | This Month Sale | Yearly Sale
- Fetches yearly sales from all sales invoices in current year

**Gross Margin Calculation:**
- Fetch `sales_invoice_items` for the month, join with products to get `cost_price`
- Gross Margin = Month Sales Revenue - Sum(qty * cost_price) for each item sold

## 2. Collapsible Sidebar (`src/components/AppSidebar.tsx`)

Restructure into collapsible dropdown sections. Only section headers shown initially; click to expand:

- **Dashboard** (no dropdown, direct link)
- **Sales** → Customers, Sales Orders, Delivery Notes, Warranty Invoices, Returns
- **Purchase** → Suppliers, Purchase Orders, Returns
- **Inventory** → Products & Stock, Stock Movements
- **Printing** → Printers, Print Jobs
- **Finance** → Payments, Expenses, Bank Accounts
- **Reports** → Reports hub
- **Settings** → Company Settings, Data Import

Uses Radix Collapsible component (already installed). Each section header is clickable with a chevron indicator.

## 3. Printing Integration in Purchase Flow

When goods are received via `PurchaseProforma.tsx` (the receive/GRN flow), automatically prompt or suggest creating a print job for the received products. This is a lightweight integration:

- After GRN is created successfully, show a toast with an action button: "Create Print Job for received items?"
- Clicking it navigates to `/print-jobs` with query params (product_id, quantity) to pre-fill the form

This connects the purchase → printing workflow without making it mandatory.

## 4. Delete All Data (Database Wipe)

Truncate all business data tables while preserving structure, counters reset to 0, and system config. Tables to truncate (in order to avoid FK issues):

```sql
TRUNCATE TABLE journal_lines, journal_entries, grn_items, goods_received_notes,
  purchase_order_items, purchase_invoices, purchase_orders, purchase_proforma_items, purchase_proformas,
  sales_invoice_items, sales_invoices, sales_return_items, sales_returns,
  purchase_return_items, purchase_returns,
  delivery_notes, stock_movements, payments, expenses, tax_records, additional_costs,
  warranty_invoices, print_jobs, customer_licenses, drap_registrations,
  proforma_invoices, customers, suppliers, products, printers, bank_accounts
CASCADE;

UPDATE document_counters SET current_value = 0;
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Complete rewrite with new dashboard layout |
| `src/components/AppSidebar.tsx` | Collapsible dropdown sections |
| `src/pages/PurchaseProforma.tsx` | Add print job suggestion after GRN creation |
| DB migration | Truncate all data tables, reset counters |

