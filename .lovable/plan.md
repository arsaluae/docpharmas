

# Fix Import + Warranty Invoices + Customer Licenses

## 1. Fix Import — "Business Name" / "First Name + Last Name" Not Mapped

**Problem**: The Excel file has columns "Business Name", "First Name", "Last Name" — none map to `name`. Result: 428 rows skipped.

**Fix in `DataImport.tsx`**:
- Add aliases: `"business name" → "company"`, `"first name" → "name"` (as primary name source)
- Add post-parse logic: if both "First Name" and "Last Name" columns exist, concatenate them into `name` before import
- If "Business Name" exists and no "name" mapped, use "Business Name" as `name` fallback
- Add `"business name" → "name"` to alias map as highest priority for customers tab
- This ensures the user's actual Excel format works out of the box

## 2. Warranty Invoices — New Feature

**Concept**: A warranty invoice is issued at MRP (retail) price on behalf of a customer's downstream pharmacy/distributor. Same items, batches, expiry — but different price and recipient details.

**New DB table: `warranty_invoices`**
- `id`, `warranty_number` (WI-0001), `date`, `customer_id` (your customer who requested it)
- `pharmacy_name`, `pharmacy_address`, `pharmacy_license_no` (the downstream recipient)
- `items` (jsonb — product_id, product_name, batch_number, expiry_date, quantity, mrp_rate, amount)
- `subtotal`, `gst_amount`, `total`, `notes`, `status`, `created_at`
- RLS: authenticated users can CRUD

**New page: `src/pages/WarrantyInvoices.tsx`**
- Route: `/warranty-invoices`
- Form: Select customer → enter pharmacy/distributor name, address, license → add line items with product, batch, expiry, qty, MRP rate
- Auto-number WI-0001
- List view with search

## 3. Customer Medical Licenses — Sub-feature

**New DB table: `customer_licenses`**
- `id`, `customer_id`, `license_number`, `license_type` (drug license, retail license, etc.)
- `expiry_date`, `address`, `notes`, `created_at`
- RLS: authenticated users can CRUD

**UI**: Add a "Licenses" button/icon on each customer row in Customers page → opens a dialog showing that customer's licenses with add/edit/delete capability. Not shown on the main table — only accessible when needed.

## Files to Create
1. `src/pages/WarrantyInvoices.tsx` — Full CRUD page
2. DB migration: `warranty_invoices` + `customer_licenses` tables

## Files to Modify
1. `src/pages/DataImport.tsx` — Fix alias mapping + first/last name concatenation
2. `src/pages/Customers.tsx` — Add "Licenses" button per row with dialog
3. `src/App.tsx` — Add `/warranty-invoices` route
4. `src/components/AppSidebar.tsx` — Add "Warranty Invoices" under Sales section

