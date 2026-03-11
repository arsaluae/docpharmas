
-- Create sales_agents table
CREATE TABLE public.sales_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  status text NOT NULL DEFAULT 'active',
  commission_type text NOT NULL DEFAULT 'percentage',
  commission_rate numeric NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_sales_agents" ON public.sales_agents FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_sales_agents" ON public.sales_agents FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_sales_agents" ON public.sales_agents FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_sales_agents" ON public.sales_agents FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_sales_agents BEFORE INSERT ON public.sales_agents FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Create agent_customers table
CREATE TABLE public.agent_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, customer_id)
);

ALTER TABLE public.agent_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_agent_customers" ON public.agent_customers FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_agent_customers" ON public.agent_customers FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_agent_customers" ON public.agent_customers FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_agent_customers" ON public.agent_customers FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_agent_customers BEFORE INSERT ON public.agent_customers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Create agent_commissions table
CREATE TABLE public.agent_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  month text NOT NULL,
  total_sales numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage',
  commission_rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_id uuid,
  notes text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_agent_commissions" ON public.agent_commissions FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_agent_commissions" ON public.agent_commissions FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_agent_commissions" ON public.agent_commissions FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_agent_commissions" ON public.agent_commissions FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_agent_commissions BEFORE INSERT ON public.agent_commissions FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Add agent_id to proforma_invoices
ALTER TABLE public.proforma_invoices ADD COLUMN agent_id uuid REFERENCES public.sales_agents(id);

-- Add agent_id to sales_invoices
ALTER TABLE public.sales_invoices ADD COLUMN agent_id uuid REFERENCES public.sales_agents(id);

-- Add document counter for commission
INSERT INTO public.document_counters (tenant_id, document_type, prefix, current_value)
SELECT t.id, 'commission', 'COM-', 0
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_counters dc WHERE dc.tenant_id = t.id AND dc.document_type = 'commission'
);
