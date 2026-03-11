
-- Customer-Product allocation junction table
CREATE TABLE public.customer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_customer_products" ON public.customer_products FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_customer_products" ON public.customer_products FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_customer_products" ON public.customer_products FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_customer_products" ON public.customer_products FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_customer_products BEFORE INSERT ON public.customer_products FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Supplier-Product allocation junction table
CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_supplier_products" ON public.supplier_products FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_supplier_products" ON public.supplier_products FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_supplier_products" ON public.supplier_products FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_supplier_products" ON public.supplier_products FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_supplier_products BEFORE INSERT ON public.supplier_products FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
