

# Complete Revamp: Pharma Accounting Software for Pakistan

## What Gets Removed
Everything current is removed: Production Floor, Quality Control, Batch tracking, BMR Steps, Quarantine, DNA Timeline, Ambient Glow, BatchOrbit, AlertFeed. All existing tables will be dropped. Fresh start.

## What Gets Built

### Database Schema (New Tables)

**Core Accounting:**
- `chart_of_accounts` — id, code (e.g. "1001"), name, account_type (asset/liability/equity/revenue/expense/cogs), parent_id (self-ref for sub-accounts), is_system (prevent deletion of built-in accounts), balance numeric, created_at
- `journal_entries` — id, entry_number, date, description, reference, status (draft/posted), created_by, created_at
- `journal_lines` — id, journal_entry_id FK, account_id FK→chart_of_accounts, debit numeric, credit numeric, description

**Customers & Sales:**
- `customers` — id, name, company, ntn, strn, phone, email, address, city, credit_limit, credit_days, opening_balance, balance, created_at
- `sales_invoices` — id, invoice_number, customer_id FK, date, due_date, subtotal, gst_amount, discount, total, amount_paid, status (draft/sent/partial/paid/overdue), notes, fbr_qr_data, created_by, created_at
- `sales_invoice_items` — id, invoice_id FK, product_id FK, batch_number, quantity, rate, discount_percent, gst_rate (17%), amount
- `sales_returns` — id, return_number, invoice_id FK, customer_id FK, date, total, reason, status, created_at
- `proforma_invoices` — id, proforma_number, customer_id FK, date, validity_days, items jsonb, subtotal, gst, total, status (draft/sent/converted), converted_invoice_id, created_at

**Suppliers & Purchases:**
- `suppliers` — id, name, company, ntn, strn, phone, email, address, city, payment_terms_days, wht_rate (default 4.5%), opening_balance, balance, created_at
- `purchase_orders` — id, po_number, supplier_id FK, date, expected_delivery, subtotal, gst, total, status (draft/sent/partial/received/cancelled), notes, created_at
- `purchase_order_items` — id, po_id FK, product_id FK or raw_material text, quantity, rate, amount
- `goods_received_notes` — id, grn_number, po_id FK, supplier_id FK, date, received_by, notes, created_at
- `grn_items` — id, grn_id FK, item_name, batch_number, quantity_ordered, quantity_received, expiry_date, rate, amount
- `purchase_invoices` — id, bill_number, supplier_id FK, grn_id FK nullable, date, due_date, subtotal, gst, wht_amount, total, status (unpaid/partial/paid), created_at

**Inventory:**
- `products` — id, name, sku, category (tablet/capsule/syrup/injection/cream/ointment), drap_reg_number, pack_size, unit, cost_price, selling_price, gst_rate, stock_quantity, reorder_level, created_at
- `stock_movements` — id, product_id FK, movement_type (purchase_in/sale_out/return_in/return_out/adjustment), quantity, batch_number, reference_type, reference_id, date, notes, created_at

**Payments & Banking:**
- `bank_accounts` — id, name, bank_name, account_number, branch, opening_balance, balance, is_default, created_at
- `payments` — id, payment_number, type (received/made), party_type (customer/supplier), party_id, amount, payment_method (cash/cheque/bank_transfer/online), bank_account_id FK nullable, cheque_number, cheque_date, reference, date, notes, created_at
- `expenses` — id, expense_number, date, category (utilities/salaries/rent/transport/maintenance/marketing/regulatory/other), description, amount, gst_amount, payment_method, bank_account_id FK nullable, account_id FK→chart_of_accounts, notes, created_at

**Tax & Compliance:**
- `tax_records` — id, period (e.g. "2026-02"), type (gst_output/gst_input/wht), amount, reference_type, reference_id, date, created_at
- `drap_registrations` — id, product_id FK, registration_number, registration_date, expiry_date, renewal_fee, status (active/expiring/expired/pending), notes, created_at

**Keep:** `user_roles` table and auth system as-is.

### Pages & Navigation

Sidebar sections:

**Overview**
- `/` — Dashboard (revenue/expense cards, receivables/payables, recent transactions, cash flow mini-chart, expiring DRAP alerts)

**Sales**
- `/customers` — Customer list + create/edit + individual ledger view
- `/sales-invoices` — Sales invoice list + create with line items, GST calc, FBR QR on finalize
- `/proforma` — Proforma invoices + convert-to-invoice
- `/sales-returns` — Credit notes / returns

**Purchases**
- `/suppliers` — Supplier list + create/edit + individual ledger view  
- `/purchase-orders` — PO creation + tracking
- `/grn` — Goods Received Notes linked to POs
- `/purchase-invoices` — Supplier bills + WHT deduction

**Inventory**
- `/products` — Product catalog with DRAP reg, stock levels, costing
- `/stock` — Stock movements, batch tracking, reorder alerts

**Finance**
- `/payments` — Payments received & made, cheque tracking
- `/expenses` — Expense recording by category
- `/bank` — Bank accounts, reconciliation view

**Reports**
- `/reports/pl` — Profit & Loss statement
- `/reports/balance-sheet` — Balance Sheet
- `/reports/cash-flow` — Cash Flow statement
- `/reports/receivables` — Aging report
- `/reports/payables` — Aging report
- `/reports/product-costing` — Per-product cost breakdown & margins
- `/reports/tax` — GST summary, WHT certificates, DRAP renewals

**Settings**
- `/settings` — Company profile, fiscal year, tax rates

### Implementation Phases

Given the scope, this will be built in **3 phases** across multiple messages:

**Phase 1 (this implementation):**
1. Database migration — drop old tables, create all new tables with RLS
2. Seed default Chart of Accounts (pharma-specific: RM inventory, WIP, finished goods, COGS breakdowns)
3. Dashboard page with financial KPI cards
4. Customers page (CRUD + ledger)
5. Suppliers page (CRUD + ledger)
6. Products page (CRUD with DRAP fields)
7. Updated sidebar navigation

**Phase 2 (next message):**
8. Sales Invoices with GST + FBR QR
9. Proforma Invoices
10. Purchase Orders + GRN
11. Purchase Invoices with WHT
12. Payments (received/made)

**Phase 3 (following message):**
13. Expenses module
14. Bank accounts + reconciliation
15. Stock movements + batch tracking
16. All reports (P&L, Balance Sheet, Cash Flow, Aging, Product Costing)
17. Tax module (GST returns, WHT certificates, DRAP tracker)

### Technical Details

- All monetary values stored as `numeric` (not float)
- Pre-seeded COA with ~40 accounts following Pakistan pharma industry standards
- GST default 17%, configurable per product
- WHT rates: 4.5% filer, 6.5% non-filer (stored per supplier)
- Invoice numbering: auto-increment with prefix (SI-0001, PO-0001, etc.)
- All tables RLS-protected for authenticated users
- Existing `user_roles` and auth kept intact
- Remove all old components (dashboard/, audit/, quality/, production/, inventory/, invoicing/, notifications/)
- Fresh UI keeping same design system (Sora/DM Sans, glass-card, status-pill patterns)

