

# Warranty Invoice Overhaul + Customer Distributors System

## Summary
Complete rework of the warranty invoice flow to be linked to sales invoices, with proper MRP/TP pricing, distributor management per customer, and a customer profile popup.

## Database Changes

### 1. New table: `customer_distributors`
Stores pharmacies/distributors linked to each customer (a customer can have 3-4).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| name | text NOT NULL | Distributor/pharmacy name |
| address | text | |
| license_number | text | |
| license_expiry | date | |
| phone | text | |
| notes | text | |
| tenant_id | uuid | RLS |
| created_at | timestamptz | |

### 2. Add columns to `warranty_invoices`
- `source_invoice_id` (uuid, FK → sales_invoices) — links warranty to the original sale
- `discount_percent` (numeric, default 0)
- `discount_amount` (numeric, default 0)
- `distributor_id` (uuid, FK → customer_distributors, nullable)

### 3. Add `mrp` column to `products` table
- `mrp` (numeric, default 0) — Maximum Retail Price stored at product level

## UI Changes

### Warranty Invoice Creation Flow (complete rework)
1. **Step 1**: Search and select a **Customer**
2. **Step 2**: System shows all **sales invoices** for that customer — user clicks one
3. **Step 3**: Items auto-populate from the selected sales invoice:
   - Product name, batch number, expiry, quantity all pre-filled
   - **MRP** column: pulled from `products.mrp` if set, otherwise editable manually
   - **TP (Trade Price)** column: auto-calculated as MRP - 15% (= MRP * 0.85)
   - **Amount** = Quantity × TP
   - User can adjust quantities (e.g., partial warranty)
4. **Discount**: Add discount % or flat discount amount field — applied to subtotal
5. **Distributor/Pharmacy**: Dropdown of distributors linked to the selected customer, or type new one
6. Total = Sum of (Qty × TP) - Discount

### Customer Profile Popup (clicking customer name anywhere)
A dialog/sheet showing:
- Customer basic info (name, company, address)
- **Total Sales** (sum of sales_invoices.total)
- **Amount Due** (customer.balance)
- **Top 5 Selling Items** (from sales_invoice_items)
- **Sales by Month** (last 6 months bar/list)
- **Linked Distributors/Pharmacies** with add/edit/delete

### Customer Page Enhancement
- Add a "Distributors" button (like the existing "Licenses" button)
- Dialog to manage distributors per customer (CRUD)

### Document Template Settings
- Update the warranty_invoice template default columns to include: Sr#, Product Name, Batch No, Batch Expiry, Qty, MRP, TP Rate, Discount, Amount
- Template settings remain editable in Settings page

## Files to Create/Edit

| File | Action |
|------|--------|
| DB migration | Create `customer_distributors` table, add columns to `warranty_invoices` and `products` |
| `src/pages/WarrantyInvoices.tsx` | Complete rewrite with new flow |
| `src/pages/Customers.tsx` | Add distributor management + customer profile popup |
| `src/hooks/useDocumentTemplates.tsx` | Update warranty_invoice default template columns |
| `src/components/CustomerProfileDialog.tsx` | New — reusable customer profile popup |

## Pricing Logic
- **MRP** = Maximum Retail Price (stored on product or entered manually)
- **TP** = Trade Price = MRP × 0.85 (15% less than MRP)
- **Line Amount** = Quantity × TP
- **Subtotal** = Sum of line amounts
- **Discount** = either % of subtotal or flat amount
- **Total** = Subtotal - Discount

