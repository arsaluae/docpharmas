
-- Freight providers (couriers) table
CREATE TABLE IF NOT EXISTS public.freight_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_providers_tenant_code
  ON public.freight_providers (tenant_id, code);

ALTER TABLE public.freight_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_freight_providers ON public.freight_providers
  FOR SELECT TO authenticated
  USING ((tenant_id = public.get_user_tenant_id()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tenant_insert_freight_providers ON public.freight_providers
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.get_user_tenant_id()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tenant_update_freight_providers ON public.freight_providers
  FOR UPDATE TO authenticated
  USING ((tenant_id = public.get_user_tenant_id()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tenant_delete_freight_providers ON public.freight_providers
  FOR DELETE TO authenticated
  USING ((tenant_id = public.get_user_tenant_id()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Auto-fill tenant_id on insert
DROP TRIGGER IF EXISTS trg_freight_providers_set_tenant ON public.freight_providers;
CREATE TRIGGER trg_freight_providers_set_tenant
  BEFORE INSERT ON public.freight_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Extend delivery_notes with courier link
ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS freight_provider_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_type_label text;

CREATE INDEX IF NOT EXISTS idx_delivery_notes_freight_provider
  ON public.delivery_notes (tenant_id, freight_provider_id);

-- Seed three defaults per existing tenant
INSERT INTO public.freight_providers (tenant_id, name, code)
SELECT t.id, v.name, v.code
FROM public.tenants t
CROSS JOIN (VALUES ('NCCS','NCCS'), ('ADDA','ADDA'), ('Self','SELF')) AS v(name, code)
ON CONFLICT (tenant_id, code) DO NOTHING;
