
-- 1. Create customer_distributors table
CREATE TABLE public.customer_distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  license_number text,
  license_expiry date,
  phone text,
  notes text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_distributors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tenant_id_customer_distributors
  BEFORE INSERT ON public.customer_distributors
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE POLICY "tenant_select_customer_distributors" ON public.customer_distributors
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_insert_customer_distributors" ON public.customer_distributors
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_update_customer_distributors" ON public.customer_distributors
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_delete_customer_distributors" ON public.customer_distributors
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Add columns to warranty_invoices
ALTER TABLE public.warranty_invoices
  ADD COLUMN source_invoice_id uuid REFERENCES public.sales_invoices(id),
  ADD COLUMN discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN distributor_id uuid REFERENCES public.customer_distributors(id);

-- 3. Add mrp column to products
ALTER TABLE public.products
  ADD COLUMN mrp numeric NOT NULL DEFAULT 0;
