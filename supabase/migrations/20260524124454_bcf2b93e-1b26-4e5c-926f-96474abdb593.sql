ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.city_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  city text NOT NULL,
  product_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  preferred_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS city_products_tenant_city_product_uniq
  ON public.city_products (tenant_id, lower(city), product_id);

ALTER TABLE public.city_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_city_products ON public.city_products
  FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_insert_city_products ON public.city_products
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_update_city_products ON public.city_products
  FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_delete_city_products ON public.city_products
  FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_city_products
  BEFORE INSERT ON public.city_products
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();