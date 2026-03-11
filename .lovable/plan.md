

# Product Allocation for Customers & Suppliers

## What You Asked For
Assign specific products to each customer and supplier so that when creating invoices/orders, only the relevant products appear. Each customer/supplier profile gets a "Products" tab to manage allocations.

## Database Changes

Two new junction tables:

```sql
CREATE TABLE customer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);
```

Both tables get RLS policies (tenant-scoped), `set_tenant_id` triggers, and standard CRUD policies matching the existing pattern.

## UI Changes

### Customer Profile Dialog (`CustomerProfileDialog.tsx`)
Add an **"Allocated Products"** section below distributors:
- Shows list of currently allocated products (name, code, category)
- "Add Product" button opens a searchable product picker (excluding already-allocated ones)
- Remove button to de-allocate a product

### Supplier Page (`Suppliers.tsx`)
Add a **Profile/Products** action button per supplier row (like customers have the Store icon). Opens a new `SupplierProfileDialog` with:
- Supplier stats (total purchases, balance)
- **"Allocated Products"** section — same pattern as customer: searchable add, list, remove

### Sales Invoice Creation
When a customer is selected, if that customer has allocated products, filter the product dropdown to show **only** those products. If no allocations exist, show all products (backward compatible).

### Purchase Order / Proforma Creation
Same logic for suppliers — filter products to supplier's allocated list when available.

## Files to Change

| File | Change |
|------|--------|
| DB migration | Create `customer_products` and `supplier_products` tables with RLS + triggers |
| `src/components/CustomerProfileDialog.tsx` | Add allocated products section with add/remove |
| `src/components/SupplierProfileDialog.tsx` | New component — supplier profile with allocated products |
| `src/pages/Suppliers.tsx` | Add profile button in actions column, open SupplierProfileDialog |
| Sales invoice page | Filter product picker by customer allocations when available |
| Purchase proforma page | Filter product picker by supplier allocations when available |

