

# Phase 3: Expenses, Banking, Stock, Reports & Tax

## Overview
Build the remaining modules to complete PharmBooks: Expenses recording, Bank accounts, Stock movements, 7 financial reports, and Tax/DRAP compliance tracking. No database changes needed — all tables already exist.

## New Pages (10 files)

### 1. Expenses Page (`src/pages/Expenses.tsx`)
- CRUD for expenses with category dropdown (utilities/salaries/rent/transport/maintenance/marketing/regulatory/other)
- GST amount field, payment method selector, bank account linking
- Auto-numbering EXP-0001
- Filter by category, search by description

### 2. Bank Accounts Page (`src/pages/BankAccounts.tsx`)
- CRUD for bank accounts (name, bank_name, account_number, branch, opening_balance)
- Show current balance per account
- Simple reconciliation view: list payments linked to each bank account

### 3. Stock Movements Page (`src/pages/StockMovements.tsx`)
- Record stock adjustments (purchase_in/sale_out/return_in/return_out/adjustment)
- Show batch_number, reference linking
- Filter by product, movement type
- Running stock balance per product

### 4. Profit & Loss Report (`src/pages/reports/ProfitLoss.tsx`)
- Date range picker
- Revenue (sum sales_invoices), COGS, Gross Profit
- Operating Expenses (sum expenses by category)
- Net Profit calculation
- All from existing table data

### 5. Balance Sheet Report (`src/pages/reports/BalanceSheet.tsx`)
- Assets: Cash + Bank balances + Receivables + Inventory value
- Liabilities: Payables + GST/WHT payable
- Equity: Assets - Liabilities
- Point-in-time snapshot

### 6. Cash Flow Report (`src/pages/reports/CashFlow.tsx`)
- Inflows: payments received
- Outflows: payments made + expenses
- Net cash flow with recharts bar chart by month

### 7. Receivables Aging (`src/pages/reports/ReceivablesAging.tsx`)
- Group unpaid/partial sales invoices by aging buckets (Current, 30, 60, 90, 90+)
- Show customer name, invoice number, amount, days outstanding

### 8. Payables Aging (`src/pages/reports/PayablesAging.tsx`)
- Same structure for unpaid purchase invoices by supplier

### 9. Product Costing (`src/pages/reports/ProductCosting.tsx`)
- Per-product: cost_price, selling_price, margin %, markup %
- Filter by category
- Sort by margin

### 10. Tax & DRAP Module (`src/pages/reports/TaxCompliance.tsx`)
- Tabs: GST Summary | WHT Certificates | DRAP Tracker
- GST: output tax (from sales invoices) vs input tax (from purchase invoices) = net payable
- WHT: list of WHT deductions from purchase invoices by supplier
- DRAP: list from drap_registrations table with status badges (active/expiring/expired), CRUD for registrations

## Updated Files

### `src/App.tsx`
- Add 10 new routes: `/expenses`, `/bank`, `/stock`, `/reports/pl`, `/reports/balance-sheet`, `/reports/cash-flow`, `/reports/receivables`, `/reports/payables`, `/reports/product-costing`, `/reports/tax`

### `src/components/AppSidebar.tsx`
- Add sidebar sections:
  - **Inventory**: add "Stock Movements" link
  - **Finance**: add "Expenses" and "Bank Accounts" links
  - **Reports**: P&L, Balance Sheet, Cash Flow, Receivables, Payables, Product Costing, Tax & DRAP

## Technical Approach
- All pages follow existing pattern: SidebarProvider + AppSidebar + header + content
- Reports are read-only query pages with date pickers and summary cards
- Use recharts (already installed) for Cash Flow chart
- All monetary formatting: `PKR ${value.toLocaleString()}`
- No new database tables or migrations needed

## Implementation Order
1. Expenses + Bank Accounts + Stock Movements (CRUD pages)
2. All 6 report pages
3. Tax & DRAP module
4. Update App.tsx routes + AppSidebar navigation

