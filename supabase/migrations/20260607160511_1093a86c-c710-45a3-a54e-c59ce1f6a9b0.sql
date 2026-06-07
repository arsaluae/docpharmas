ALTER TABLE public.sales_agents
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_agents_user_id ON public.sales_agents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_customers_agent ON public.agent_customers(agent_id);

CREATE OR REPLACE FUNCTION public.is_agent_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role public.tenant_role;
BEGIN
  v_role := public.current_tenant_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role <> 'sales_agent' THEN RETURN true; END IF;
  IF p_customer_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.agent_customers ac
    JOIN public.sales_agents sa ON sa.id = ac.agent_id
    WHERE ac.customer_id = p_customer_id AND sa.user_id = auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_agent_customer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_agent_customer(uuid) TO authenticated;

-- Drop any existing agent-scope policies first
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'customers','proforma_invoices','sales_invoices','sales_returns',
    'delivery_notes','credit_notes','warranty_invoices','payments'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS rbac_agent_scope_read   ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS rbac_agent_scope_write  ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS rbac_agent_scope_update ON public.%I', t);
  END LOOP;
END $$;

-- customers
CREATE POLICY rbac_agent_scope_read   ON public.customers AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_agent_customer(id));
CREATE POLICY rbac_agent_scope_write  ON public.customers AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_agent_customer(id));
CREATE POLICY rbac_agent_scope_update ON public.customers AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_agent_customer(id)) WITH CHECK (public.is_agent_customer(id));

-- tables with customer_id
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'proforma_invoices','sales_invoices','sales_returns',
    'delivery_notes','warranty_invoices'
  ])
  LOOP
    EXECUTE format('CREATE POLICY rbac_agent_scope_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_agent_customer(customer_id))', t);
    EXECUTE format('CREATE POLICY rbac_agent_scope_write ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_agent_customer(customer_id))', t);
    EXECUTE format('CREATE POLICY rbac_agent_scope_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_agent_customer(customer_id)) WITH CHECK (public.is_agent_customer(customer_id))', t);
  END LOOP;
END $$;

-- credit_notes: party_type='customer' uses party_id as customer ref
CREATE POLICY rbac_agent_scope_read ON public.credit_notes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (party_type <> 'customer' OR public.is_agent_customer(party_id));
CREATE POLICY rbac_agent_scope_write ON public.credit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (party_type <> 'customer' OR public.is_agent_customer(party_id));
CREATE POLICY rbac_agent_scope_update ON public.credit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (party_type <> 'customer' OR public.is_agent_customer(party_id))
  WITH CHECK (party_type <> 'customer' OR public.is_agent_customer(party_id));

-- payments: same pattern
CREATE POLICY rbac_agent_scope_read ON public.payments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (party_type <> 'customer' OR public.is_agent_customer(party_id));
CREATE POLICY rbac_agent_scope_write ON public.payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (party_type <> 'customer' OR public.is_agent_customer(party_id));
CREATE POLICY rbac_agent_scope_update ON public.payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (party_type <> 'customer' OR public.is_agent_customer(party_id))
  WITH CHECK (party_type <> 'customer' OR public.is_agent_customer(party_id));
