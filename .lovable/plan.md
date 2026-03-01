
# System Audit — Implementation Status

## ✅ COMPLETED (Phase 1 — Data Integrity)

### 1. ✅ Balance update triggers
Database triggers auto-update `customers.balance`, `suppliers.balance`, and `bank_accounts.balance` when:
- Payments are inserted/deleted
- Sales invoices are inserted/deleted
- Purchase invoices are inserted/deleted
- Sales returns are inserted/deleted
- Purchase returns are inserted/deleted
- Expenses with bank accounts are inserted/deleted

### 2. ✅ Stock update triggers
- `stock_movements` trigger updates `products.stock_quantity` based on movement type
- `sales_invoice_items` trigger auto-deducts stock when invoice items are created

### 3. ✅ Document number sequences
- `document_counters` table with atomic `generate_document_number()` function
- All 13 document types migrated from count-based to sequence-based numbering
- Counters synced with existing data counts

## ✅ COMPLETED (Phase 2 — Code Fixes)

### 4. ✅ P&L uses subtotal for revenue (not total with GST)
### 5. ✅ P&L filters out personal expenses from operating costs
### 6. ✅ Customer edit no longer overwrites balance with opening_balance
### 7. ✅ Supplier edit no longer overwrites balance with opening_balance
### 8. ✅ calcTotals in SalesInvoices now includes `settings` in dependency array

## 🔲 REMAINING (Phase 2 — Functional)

### 9. Add edit/delete for expenses
### 10. Add edit/delete for payments
### 11. Add line items to purchase bills

## 🔲 REMAINING (Phase 3 — UX)

### 12. Add pagination
### 13. Add loading skeletons
### 14. Enhanced dashboard with time-based metrics
### 15. Date filters on Cash Flow and Balance Sheet
### 16. Area column for customers (already exists in DB)

## ⚠️ PRE-EXISTING (Not new to this migration)

### RLS policies use `USING (true)`
All tables use permissive RLS (`true`) gated by auth. This is by design — the app requires login, and all authenticated users share data (single-company system).
