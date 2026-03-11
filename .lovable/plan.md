

# Fix Data Sync Issues: Distributors RLS + Delivery Notes

## Root Cause Analysis

### 1. Distributor Insert Fails (403 Error)
The `customer_distributors` table has **RESTRICTIVE** RLS policies instead of **PERMISSIVE**. In PostgreSQL, RESTRICTIVE policies can only further restrict access already granted by a PERMISSIVE policy. Since there are zero PERMISSIVE policies on this table, **all operations are denied** — SELECT returns empty, INSERT/UPDATE/DELETE fail with 403. This is why distributors appear to not save and the list always shows empty.

### 2. Delivery Notes Not Showing Supplier Names
The delivery notes page query joins only `customers(name)` but some delivery notes have `supplier_id` instead of `customer_id`. The supplier name is never fetched, so those rows show "—" in the Customer column.

## Changes

### Database Migration
Drop the 4 RESTRICTIVE policies on `customer_distributors` and re-create them as PERMISSIVE:

```sql
DROP POLICY "tenant_select_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_insert_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_update_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_delete_customer_distributors" ON public.customer_distributors;

CREATE POLICY "tenant_select_customer_distributors" ON public.customer_distributors
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_insert_customer_distributors" ON public.customer_distributors
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_update_customer_distributors" ON public.customer_distributors
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_delete_customer_distributors" ON public.customer_distributors
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));
```

### `src/pages/DeliveryNotes.tsx`
- Update query to join both `customers(name)` and `suppliers(name)` so supplier-type delivery notes display the correct party name
- Update the table to show whichever name is available (customer or supplier)

| File | Change |
|------|--------|
| **DB Migration** | Fix customer_distributors RLS from RESTRICTIVE to PERMISSIVE |
| `src/pages/DeliveryNotes.tsx` | Add suppliers join + show correct party name |

