# Fix empty product picker for sales agents

## Root cause
The new `agent_stock_availability` and `sales_product_catalog_view` views were created `WITH (security_invoker=on)`. That makes the views execute RLS as the **caller**. Sales agents have a RESTRICTIVE policy on `products`:

```
sa_deny_products: RESTRICTIVE ALL → current_tenant_role() <> 'sales_agent'
```

So when an agent queries the view, the underlying `products` SELECT is blocked → the view returns **zero rows** → empty product list in Sales Orders / Products page.

`agent_batch_availability` has the same flag and the same problem (it joins `products`).

## Fix (single small migration)
Drop `security_invoker` from all three agent-facing views so they execute as their owner (postgres) and bypass the restrictive policy. Tenant isolation is preserved by the `WHERE tenant_id = public.get_user_tenant_id()` predicate already in each view. Cost columns are still absent from the view → agents still cannot read cost data.

Steps:
1. `ALTER VIEW public.agent_stock_availability   RESET (security_invoker);`
2. `ALTER VIEW public.sales_product_catalog_view RESET (security_invoker);`
3. `ALTER VIEW public.agent_batch_availability   RESET (security_invoker);`

No frontend changes — the picker code is already pointing at `sales_product_catalog_view`.

## Verification
After migration, agent reloads Sales Orders → product picker populates with name, MRP, sale price, available qty, nearest expiry. Direct `from('products')` still returns zero rows for agents (cost stays hidden).
