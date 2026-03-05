

# Plan: Simplify Entire Sales + Purchase Workflow

## Problem
Currently there are too many separate pages and manual steps. The user has to navigate between Proforma, Invoices, Delivery Notes (sales side) and Purchase Proforma, Purchase Orders, GRN, Bills (purchase side). This over-complicates what should be a smooth, linear flow.

## New Simplified Architecture

### Sales Side: ONE page called "Sales"
Replaces: Proforma + Sales Invoices + Delivery Notes (3 pages become 1)

Statuses on a single document:
- **Draft** = what was previously "Proforma" (unconfirmed quote)
- **Invoiced** = confirmed/approved, auto-creates the sales_invoice record, deducts stock
- **Dispatched** = goods sent, auto-creates delivery_note record

User actions: Create draft → click "Confirm" (becomes invoice + DN in one click) → mark Dispatched if needed separately, or auto-dispatch on confirm.

The page shows ALL documents (drafts and invoices) in one unified table with status filters. Print button renders as "Proforma" PDF if draft, "Invoice" PDF if invoiced.

### Purchase Side: ONE page called "Purchases"  
Replaces: Purchase Proforma + Purchase Orders + GRN + Bills (4 pages become 1)

Statuses on a single document:
- **Draft** = unconfirmed order request
- **Ordered** = confirmed and sent to supplier (was PO)
- **Received** = goods arrived, auto-creates GRN + Bill records, adds stock

User actions: Create draft → click "Confirm Order" (becomes PO) → click "Mark Received" (creates GRN + Bill in one click)

### Sidebar Simplification
**Sales section**: Customers, Sales, Warranty Invoices, Returns
**Purchases section**: Suppliers, Purchases, Returns

6 fewer sidebar items. Much cleaner.

### Warranty Invoices
Stays as separate page (different purpose: MRP pricing for distributor/pharmacy). No changes needed.

### Payments
Stay as-is. "Payment from Customer" and "Payment to Supplier" on the same page.

## Technical Approach

### Sales Page (new unified)
- Query both `proforma_invoices` (status=draft) and `sales_invoices` in one view
- Or simpler: use `proforma_invoices` as the single source of truth, with status progression (draft → invoiced → dispatched)
- When status changes to "invoiced", the existing `handleConvert` logic runs behind the scenes (creates sales_invoice record, sales_invoice_items, stock_movements, delivery_note)
- The confirm action is a single button click, no batch selection dialog (use FIFO auto-batch or skip batch requirement for simplicity)
- Show unified table: Doc #, Customer, Date, Status, Total, Actions

### Purchase Page (new unified)
- Use `purchase_proformas` as single source of truth with status progression (draft → ordered → received → billed)
- "Confirm Order" = creates purchase_order record automatically (existing logic)
- "Mark Received" = creates GRN + purchase_invoice automatically (existing logic from GRN page)
- Single table, single page

### What stays the same
- All underlying database tables remain (no schema changes needed)
- All triggers and balance logic remain
- PDF generation remains
- Returns pages remain separate (they reference invoices)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Major rewrite: becomes unified "Sales" page with draft/invoiced/dispatched flow, one-click confirm |
| `src/pages/PurchaseProforma.tsx` | Major rewrite: becomes unified "Purchases" page with draft/ordered/received flow, one-click actions |
| `src/components/AppSidebar.tsx` | Remove Invoices, Purchase Orders, GRN, Bills from nav. Rename Proforma→Sales, Purchase Proforma→Purchases |
| `src/App.tsx` | Keep all routes (backward compat), add redirects from old URLs to new unified pages |
| `src/pages/SalesInvoices.tsx` | Redirect to /proforma (or keep as read-only archive) |
| `src/pages/PurchaseOrders.tsx` | Redirect to /purchase-proforma |
| `src/pages/GoodsReceivedNotes.tsx` | Redirect to /purchase-proforma |
| `src/pages/PurchaseInvoicesPage.tsx` | Redirect to /purchase-proforma |

No database migrations needed. All existing data remains accessible.

