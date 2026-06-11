# Customers/Suppliers Fixes

You have 436 customers (435 missing codes) and 126 suppliers (all missing codes). The "Total 50" issue is a UI bug — the summary card shows the current page count instead of the real DB total.

## 1. Backfill codes (DB migration)
- For every existing `customers` row where `customer_code IS NULL`, set `customer_code = generate_document_number('customer')` (tenant-scoped, sequential per tenant: `CUS-0001`, `CUS-0002`…).
- Same for `suppliers.supplier_code` using `generate_document_number('supplier')`.
- Add a `BEFORE INSERT` trigger on both tables that auto-fills the code if NULL, so future imports / manual inserts never miss it again.

## 2. Fix "Total = 50" + per-page summary cards (`src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`)
The summary KPIs (Total, Receivables, Credit Limit, Over Limit / Payables, With Balance, Avg Terms) currently sum only the visible 50 rows. Fix by fetching tenant-wide aggregates with a small RPC `customers_summary()` / `suppliers_summary()` (one row, security-definer, tenant-scoped) and binding the KPI cards to those numbers instead of `customers.length`.

## 3. City filter (both pages)
- Add a city dropdown next to the search box, populated from `DISTINCT city` for the current tenant (small RPC `customers_cities()` / `suppliers_cities()`).
- When a city is selected, push it into the server query (`.eq("city", city)`) so the filter works across ALL 436 rows, not just the current page.
- Search box also moves server-side (`.or("name.ilike…,company.ilike…,customer_code.ilike…")`) so searching across 400+ rows works.

## 4. Sales invoice → ledger (verify)
`CustomerLedger.tsx` already pulls `sales_invoices` for the customer and renders them as debit entries (line 87). Since there are 0 SIs in the DB today, nothing shows yet — but the wiring is correct. Confirmed working; no change needed unless you want SI drafts excluded too.

## Technical details

**Migration**
```sql
-- backfill
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id, tenant_id FROM customers WHERE customer_code IS NULL ORDER BY created_at LOOP
    UPDATE customers SET customer_code =
      (SELECT public.generate_document_number_for_tenant('customer', r.tenant_id))
    WHERE id = r.id;
  END LOOP;
END $$;
-- (same loop for suppliers)

-- auto-assign trigger
CREATE OR REPLACE FUNCTION set_customer_code() RETURNS trigger ...
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := public.generate_document_number('customer');
  END IF;
CREATE TRIGGER trg_customer_code BEFORE INSERT ON customers ...
```
(Need a small tenant-aware variant of `generate_document_number` for the backfill loop since it normally relies on `auth.uid()`.)

**RPCs**
- `customers_summary()` → `{ total, receivables, credit_limit, over_limit }`
- `customers_cities()` → `text[]`
- Same pair for suppliers.

**UI**
- `Customers.tsx` / `Suppliers.tsx`:
  - Add `const [cityFilter, setCityFilter] = useState<string>("all")`.
  - `useEffect` deps: `[page, showInactive, cityFilter, debouncedSearch]`.
  - Move `search` and `city` into the supabase query, drop client-side `.filter()`.
  - KPI cards read from `summary` state, not `customers.length`.

## Files touched
- new migration: backfill + triggers + 4 RPCs
- `src/pages/Customers.tsx`
- `src/pages/Suppliers.tsx`
