

# Pharma Industry Pain Points Audit -- What's Missing & What's Complicated

## Industry Research Summary

After researching pharma distributor/manufacturer pain points across multiple sources, here are the top challenges mapped against DocPharmas' current state:

---

## CRITICAL MISSING FEATURES

### 1. Expiry Management Dashboard (Industry Pain #1)
**Problem**: Pharma distributors lose 3-8% revenue annually to expired stock. The system has batch/expiry data in `grn_items` but **no proactive expiry alert system**.
- BatchWiseReport exists but is buried in reports -- not actionable
- No dashboard widget for "Expiring in 30/60/90 days"
- No automated near-expiry alerts (like reorder alerts exist)
- No FEFO (First Expiry First Out) enforcement during sales

**Plan**: Add an **Expiry Alert Dashboard Card** on Index.tsx showing critical/warning/info expiry counts. Add a dedicated **Expiry Management** page with actions (return to supplier, discount sale, write-off). Add FEFO suggestion in sales order item selection.

### 2. Scheme / Bonus Management (Industry Pain #2)
**Problem**: Pharma manufacturers run "bonus schemes" (buy 10 get 2 free) constantly. Distributors track these manually. No `schemes` table exists.
- No way to define product-level schemes (X+Y free)
- No scheme tracking in invoices
- No scheme reporting (cost of goods given free)

**Plan**: Create `product_schemes` table (product_id, buy_qty, free_qty, start_date, end_date, active). Auto-apply during invoice creation. Show scheme badge on product selection.

### 3. Batch-wise Stock Tracking (Industry Pain #3)
**Problem**: Products table tracks `stock_quantity` as a single number. In pharma, stock is **per batch**. Two batches of the same product can have different expiry dates and costs.
- Current: `products.stock_quantity` = flat number
- Needed: `batch_inventory` table tracking qty per product+batch+expiry
- GRN creates batch records, Sales deducts from specific batches

**Plan**: Create `batch_inventory` table. Modify GRN flow to upsert batch records. Modify sales to pick from specific batches (FEFO). This is a **major architectural change** -- recommend as Phase 2.

### 4. Return / Claim Management (Industry Pain #4)
**Problem**: Returns exist but there's no **claim workflow** -- when a distributor returns expired/damaged stock to the manufacturer, they file a "claim" and track its approval status.
- Sales/Purchase returns exist but are simple debit/credit
- No claim number, claim status tracking, claim aging
- No manufacturer response tracking

**Plan**: Add `claim_status`, `claim_reference`, `manufacturer_response` fields to purchase returns. Add claim aging report.

### 5. Credit Limit Enforcement (Industry Pain #5)
**Problem**: `customers.credit_limit` and `customers.credit_days` exist in the database but are **never enforced** during order creation.
- Sales order creation doesn't check if customer balance exceeds credit limit
- No warning when credit days are exceeded
- No overdue invoice blocking

**Plan**: Add credit limit check in ProformaInvoices.tsx `handleSave`. Show warning toast when limit exceeded. Add override option for authorized users. Add overdue highlight in customer list.

---

## COMPLICATED / POORLY DESIGNED AREAS

### 6. Product Search in Invoices is Too Slow
**Problem**: When creating a sales/purchase order with 200+ products, the `SearchableSelect` loads all products. For pharma companies with 500-2000 products, this is painful.
- Currently loads ALL products on page mount
- No server-side search/filter
- No recent/frequent products shortcut

**Plan**: Add debounced server-side search to product selection. Show "Recently Used" products at top. Add barcode/product-code quick-entry field.

### 7. No Duplicate Invoice Detection
**Problem**: Pharma distributors process 50+ invoices daily. No system prevents creating duplicate orders for the same customer on the same day.

**Plan**: Add duplicate detection -- warn if same customer has an order in last 24 hours before saving.

### 8. Discount Structure Missing from Sales Flow
**Problem**: Pharma pricing has complex discount tiers (trade discount, cash discount, special discount). The sales invoice items have `discount_percent` in warranty invoices but **not in regular proforma/sales flow**.

**Plan**: Add `discount_percent` field per line item in ProformaInvoices. Calculate net amount after discount. Show discount column in PDF.

---

## QUICK WINS (Low Effort, High Impact)

### 9. Dashboard: Expiry Alerts Widget
Add a card showing count of items expiring in 30/60/90 days from `grn_items` data.

### 10. Credit Limit Warning
Show a red badge on customer name in sales order creation when balance > credit_limit.

### 11. Product Quick-Add in Invoice
Allow typing a product code and pressing Enter to add it as a line item instantly.

### 12. Supplier Payment Due Date Tracking  
Calculate and display payment due dates based on `suppliers.payment_terms_days` in the purchase and supplier list.

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Credit limit enforcement in sales | Small | High -- prevents bad debt |
| 2 | Expiry alerts dashboard widget | Small | High -- prevents losses |
| 3 | Line-item discounts in sales orders | Medium | High -- daily workflow |
| 4 | Duplicate invoice detection | Small | Medium -- prevents errors |
| 5 | Scheme/bonus management | Large | High -- core pharma feature |
| 6 | Product quick-entry by code | Small | High -- speed improvement |
| 7 | Batch-wise inventory (FEFO) | Very Large | Critical -- architectural |
| 8 | Claim management workflow | Medium | Medium -- improves returns |

## Recommended First Implementation Batch

I recommend implementing **Priority 1-4 and 6** together as they are small-to-medium effort with immediate daily impact:

**Files to change:**
- `src/pages/Index.tsx` -- Add expiry alerts widget
- `src/pages/ProformaInvoices.tsx` -- Credit limit check, duplicate detection, line-item discount, product quick-entry
- `src/pages/PurchaseProforma.tsx` -- Duplicate detection, product quick-entry  
- `src/pages/Customers.tsx` -- Credit limit warning badges
- `src/pages/Suppliers.tsx` -- Payment due date display
- New edge function or DB query for expiry alert data

**Database migrations needed:**
- None for credit limit (fields already exist, just need frontend enforcement)
- None for expiry alerts (data already in `grn_items`)
- Optional: Add `discount_percent` to `proforma_invoice_items` / `sales_invoice_items` if not present

