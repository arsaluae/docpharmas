-- Fix 1: customers — drop the ALL-restrictive policy that also blocks SELECT.
-- Replace with write-only restrictions; SELECT keeps governed by sa_restrict_customers_select + agent_scope_customers.
DROP POLICY IF EXISTS sa_restrict_customers_modify ON public.customers;

CREATE POLICY sa_restrict_customers_insert ON public.customers
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (current_tenant_role() <> 'sales_agent'::tenant_role
           OR is_agent_customer(id));

CREATE POLICY sa_restrict_customers_update_writes ON public.customers
  AS RESTRICTIVE FOR UPDATE TO public
  USING (current_tenant_role() <> 'sales_agent'::tenant_role
      OR is_agent_customer(id))
  WITH CHECK (current_tenant_role() <> 'sales_agent'::tenant_role
           OR is_agent_customer(id));

CREATE POLICY sa_restrict_customers_delete ON public.customers
  AS RESTRICTIVE FOR DELETE TO public
  USING (current_tenant_role() <> 'sales_agent'::tenant_role);

-- Fix 2: products — keep deny on the base table (hides cost_price at DB level),
-- but ensure safe views are reachable by authenticated agents.
GRANT SELECT ON public.agent_stock_availability TO authenticated;
GRANT SELECT ON public.agent_batch_availability TO authenticated;