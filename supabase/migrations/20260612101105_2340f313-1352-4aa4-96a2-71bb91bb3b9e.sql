
-- 1. Snapshot columns on sales_invoice_items (nullable; new rows fill from frontend, old rows unaffected)
ALTER TABLE public.sales_invoice_items
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS mrp numeric;

-- 2. Rebuild agent_stock_availability with full catalog (no cost columns)
DROP VIEW IF EXISTS public.agent_stock_availability CASCADE;
CREATE VIEW public.agent_stock_availability
WITH (security_invoker=on) AS
SELECT
  p.id                AS product_id,
  p.tenant_id,
  p.sku,
  p.product_code,
  p.name              AS product_name,
  p.name,                          -- legacy alias for existing code
  p.generic_name,
  p.category,
  p.sub_category,
  p.brand,
  s.name              AS supplier_name,
  p.unit,
  p.pack_size,
  p.mrp,
  p.selling_price,
  p.selling_price     AS sale_price,
  COALESCE(p.gst_rate, 0) AS gst_rate,
  p.stock_quantity    AS available_qty,
  p.reorder_level,
  p.low_stock_level,
  CASE
    WHEN p.stock_quantity <= 0 THEN 'out'
    WHEN p.stock_quantity <= COALESCE(p.reorder_level, 0) THEN 'low'
    ELSE 'ok'
  END                 AS stock_status,
  (
    SELECT COUNT(DISTINCT g.batch_number)
      FROM public.grn_items g
     WHERE g.product_id = p.id
       AND g.tenant_id  = p.tenant_id
       AND g.batch_number IS NOT NULL
  )                   AS batch_count,
  (
    SELECT MIN(g.expiry_date)
      FROM public.grn_items g
     WHERE g.product_id = p.id
       AND g.tenant_id  = p.tenant_id
       AND g.expiry_date IS NOT NULL
  )                   AS nearest_expiry
FROM public.products p
LEFT JOIN public.suppliers s ON s.id = p.supplier_id
WHERE p.tenant_id = public.get_user_tenant_id()
  AND COALESCE(p.is_active, true) = true;

GRANT SELECT ON public.agent_stock_availability TO authenticated;

-- 3. Alias view matching the spec name
DROP VIEW IF EXISTS public.sales_product_catalog_view CASCADE;
CREATE VIEW public.sales_product_catalog_view
WITH (security_invoker=on) AS
SELECT * FROM public.agent_stock_availability;

GRANT SELECT ON public.sales_product_catalog_view TO authenticated;

-- 4. Audit trigger on product master changes
CREATE OR REPLACE FUNCTION public.audit_product_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_changes jsonb := '{}'::jsonb;
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
  END IF;
  IF NEW.mrp IS DISTINCT FROM OLD.mrp THEN
    v_changes := v_changes || jsonb_build_object('mrp', jsonb_build_object('old', OLD.mrp, 'new', NEW.mrp));
  END IF;
  IF NEW.selling_price IS DISTINCT FROM OLD.selling_price THEN
    v_changes := v_changes || jsonb_build_object('selling_price', jsonb_build_object('old', OLD.selling_price, 'new', NEW.selling_price));
  END IF;
  IF NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
    v_changes := v_changes || jsonb_build_object('cost_price', jsonb_build_object('old', OLD.cost_price, 'new', NEW.cost_price));
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    v_changes := v_changes || jsonb_build_object('supplier_id', jsonb_build_object('old', OLD.supplier_id, 'new', NEW.supplier_id));
  END IF;
  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.audit_log (
      tenant_id, user_id, action, entity_type, entity_id, entity_number, changes
    ) VALUES (
      NEW.tenant_id, auth.uid(), 'updated', 'product', NEW.id,
      COALESCE(NEW.product_code, NEW.sku, NEW.name), v_changes
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_product_changes ON public.products;
CREATE TRIGGER trg_audit_product_changes
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_product_changes();
