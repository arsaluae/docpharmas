
-- 1. products: add purchase_cost + backfill, ensure SKU is primary identifier
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_cost numeric NOT NULL DEFAULT 0;
UPDATE public.products SET purchase_cost = COALESCE(cost_price, 0) WHERE purchase_cost = 0 AND COALESCE(cost_price,0) > 0;
UPDATE public.products SET sku = product_code WHERE (sku IS NULL OR sku = '') AND product_code IS NOT NULL AND product_code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_unique
  ON public.products (tenant_id, lower(sku))
  WHERE sku IS NOT NULL AND is_active = true;

-- 2. product_landed_costs table
CREATE TABLE IF NOT EXISTS public.product_landed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_cost numeric NOT NULL DEFAULT 0,
  printing_cost numeric NOT NULL DEFAULT 0,
  freight_cost numeric NOT NULL DEFAULT 0,
  customs_cost numeric NOT NULL DEFAULT 0,
  handling_cost numeric NOT NULL DEFAULT 0,
  other_cost numeric NOT NULL DEFAULT 0,
  other_cost_label text,
  landed_cost numeric GENERATED ALWAYS AS
    (purchase_cost + printing_cost + freight_cost + customs_cost + handling_cost + other_cost) STORED,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','purchase_invoice')),
  source_ref uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_landed_costs TO authenticated;
GRANT ALL ON public.product_landed_costs TO service_role;

ALTER TABLE public.product_landed_costs ENABLE ROW LEVEL SECURITY;

-- tenant policies
CREATE POLICY "tenant_select_plc" ON public.product_landed_costs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_plc" ON public.product_landed_costs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_plc" ON public.product_landed_costs
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_plc" ON public.product_landed_costs
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

-- block sales agents
CREATE POLICY "sa_deny_plc" ON public.product_landed_costs AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (current_tenant_role() <> 'sales_agent'::tenant_role)
  WITH CHECK (current_tenant_role() <> 'sales_agent'::tenant_role);

-- tenant auto-stamp
CREATE TRIGGER set_tenant_product_landed_costs
  BEFORE INSERT ON public.product_landed_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Sync products.cost_price with latest landed cost
CREATE OR REPLACE FUNCTION public.sync_product_landed_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET cost_price = NEW.landed_cost WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_landed_cost ON public.product_landed_costs;
CREATE TRIGGER trg_sync_landed_cost
  AFTER INSERT ON public.product_landed_costs
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_landed_cost();

CREATE INDEX IF NOT EXISTS idx_plc_product ON public.product_landed_costs (product_id, effective_from DESC);

-- 3. SKU autonumber on company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS sku_prefix text NOT NULL DEFAULT 'PRD',
  ADD COLUMN IF NOT EXISTS sku_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sku_auto_generate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sku_manual_override_admin_only boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.generate_sku()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_prefix text;
  v_next int;
  v_sku text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context';
  END IF;
  UPDATE public.company_settings
     SET sku_next_number = sku_next_number + 1
   WHERE tenant_id = v_tenant
  RETURNING sku_prefix, sku_next_number - 1 INTO v_prefix, v_next;
  IF v_prefix IS NULL THEN
    v_prefix := 'PRD'; v_next := 1;
  END IF;
  v_sku := v_prefix || '-' || lpad(v_next::text, 4, '0');
  RETURN v_sku;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_sku() TO authenticated;
