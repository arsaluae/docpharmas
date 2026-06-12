DROP VIEW IF EXISTS public.agent_stock_availability;
CREATE VIEW public.agent_stock_availability AS
SELECT id AS product_id,
    tenant_id,
    product_code,
    name,
    category,
    brand,
    unit,
    pack_size,
    selling_price,
    mrp,
    COALESCE(gst_rate, 0) AS gst_rate,
    stock_quantity AS available_qty,
    reorder_level,
    CASE
      WHEN stock_quantity <= 0 THEN 'out'
      WHEN stock_quantity <= COALESCE(reorder_level, 0) THEN 'low'
      ELSE 'ok'
    END AS stock_status
FROM products p
WHERE tenant_id = get_user_tenant_id()
  AND COALESCE(is_active, true) = true;

GRANT SELECT ON public.agent_stock_availability TO authenticated;