

# Auto-IDs, License Numbers & Form Restructuring

## What's Changing

### 1. Auto-Generated Readable IDs
Add auto-incrementing codes for suppliers (SUP-0001), customers (CUS-0001), and products (PRD-0001). These display in tables and forms as a readable reference alongside the internal UUID.

### 2. Supplier & Customer Form Restructuring
- **Company Name** becomes the primary required field (currently optional)
- **Contact Name** becomes optional (currently "Name" is required)
- Suppliers get a **License Number** field

### 3. Purchase Order Fix
Investigate and fix the creation errors in PurchaseProforma.

## Database Migration

```sql
-- Add code columns + license for suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code text UNIQUE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS license_number text;

-- Add code column for customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code text UNIQUE;

-- Add code column for products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code text UNIQUE;

-- Add document counters for auto-ID generation (per tenant)
-- These will be seeded by the manage-tenant edge function for new tenants
-- For existing tenants, seed them now
INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT tenant_id, 'supplier', 'SUP-', 0 FROM document_counters
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = document_counters.tenant_id AND dc2.document_type = 'supplier');

INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT tenant_id, 'customer', 'CUS-', 0 FROM document_counters
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = document_counters.tenant_id AND dc2.document_type = 'customer');

INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT tenant_id, 'product', 'PRD-', 0 FROM document_counters
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = document_counters.tenant_id AND dc2.document_type = 'product');
```

## UI Changes

### Suppliers Page (`src/pages/Suppliers.tsx`)
- Form: **Company Name \*** (required, maps to `name` column — the NOT NULL column)
- Form: **Contact Person** (optional, maps to `company` column — repurposed)
- Form: **License Number** (new field)
- Table: Add "Code" column showing SUP-0001
- On create: auto-generate `supplier_code` via `generate_document_number('supplier')`

### Customers Page (`src/pages/Customers.tsx`)
- Form: **Company Name \*** (required, maps to `name` column)
- Form: **Contact Person** (optional, maps to `company` column — repurposed)
- Table: Add "Code" column showing CUS-0001
- On create: auto-generate `customer_code` via `generate_document_number('customer')`

### Products Page (`src/pages/Products.tsx`)
- On create: auto-generate `product_code` via `generate_document_number('product')`
- Table: Add "Code" column showing PRD-0001

### Purchase Order Fix
- The `handleConfirmOrder` creates a purchase invoice without linking `grn_id`, then at receive it tries to find an unlinked bill by supplier_id — this can match wrong bills across orders. Fix: link the bill to the PO at creation via the proforma reference.

### Edge Function Update (`manage-tenant`)
- Add supplier/customer/product counters to the tenant seeding logic (alongside existing 14 counters).

## Files to Change

| File | Change |
|------|--------|
| DB migration | Add columns + seed counters |
| `src/pages/Suppliers.tsx` | Restructure form, add code + license |
| `src/pages/Customers.tsx` | Restructure form, add code |
| `src/pages/Products.tsx` | Add product code on create |
| `src/pages/PurchaseProforma.tsx` | Fix bill linking at confirm stage |
| `supabase/functions/manage-tenant/index.ts` | Seed 3 new counters on tenant creation |

