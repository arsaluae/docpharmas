
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS areas_tenant_city_name_unique
  ON public.areas (tenant_id, COALESCE(city,''), name);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_areas ON public.areas FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tenant_insert_areas ON public.areas FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tenant_update_areas ON public.areas FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tenant_delete_areas ON public.areas FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_areas BEFORE INSERT ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Backfill from existing customer.area values
INSERT INTO public.areas (tenant_id, name, city)
SELECT DISTINCT tenant_id, area, city
FROM public.customers
WHERE area IS NOT NULL AND trim(area) <> ''
ON CONFLICT DO NOTHING;

-- Add area on suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS area text;
