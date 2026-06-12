
-- Extend stamp triggers to also fire for the legacy 'staff' role
CREATE OR REPLACE FUNCTION public.stamp_agent_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agent uuid; v_role public.tenant_role;
BEGIN
  v_role := public.current_tenant_role();
  IF NEW.agent_id IS NULL AND v_role IN ('sales_agent','staff') THEN
    v_agent := public.current_sales_agent_id();
    IF v_agent IS NOT NULL THEN NEW.agent_id := v_agent; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.stamp_payment_agent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agent uuid; v_role public.tenant_role;
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  v_role := public.current_tenant_role();
  IF v_role IN ('sales_agent','staff') THEN
    v_agent := public.current_sales_agent_id();
    IF v_agent IS NOT NULL AND NEW.agent_id IS NULL THEN NEW.agent_id := v_agent; END IF;
    IF NEW.agent_id IS NOT NULL THEN NEW.source := 'agent_collection'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Extend current_sales_agent_id helper resilience: also treat 'staff' as agent
CREATE OR REPLACE FUNCTION public.is_agent_customer(p_customer_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_agent  uuid := public.current_sales_agent_id();
  v_scope  text;
  v_role   public.tenant_role := public.current_tenant_role();
BEGIN
  IF v_tenant IS NULL THEN RETURN false; END IF;
  IF v_role NOT IN ('sales_agent','staff') THEN RETURN true; END IF;
  IF v_agent IS NULL THEN RETURN false; END IF;
  SELECT sales_agent_scope INTO v_scope FROM public.company_settings WHERE tenant_id = v_tenant LIMIT 1;
  IF COALESCE(v_scope,'assigned') = 'all' THEN
    RETURN EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND tenant_id = v_tenant);
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.agent_customers
     WHERE agent_id = v_agent AND customer_id = p_customer_id AND tenant_id = v_tenant
  );
END $$;

CREATE OR REPLACE FUNCTION public.agent_can_see_customer(p_customer_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role public.tenant_role;
BEGIN
  v_role := public.current_tenant_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role NOT IN ('sales_agent','staff') THEN RETURN true; END IF;
  IF p_customer_id IS NULL THEN RETURN false; END IF;
  RETURN public.is_agent_customer(p_customer_id);
END $$;
