
-- 1. SCHEMA CHANGES
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS sales_agent_scope text NOT NULL DEFAULT 'assigned'
    CHECK (sales_agent_scope IN ('assigned','all')),
  ADD COLUMN IF NOT EXISTS require_payment_in_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin','agent_collection')),
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.sales_agents(id) ON DELETE SET NULL;

UPDATE public.delivery_notes dn
   SET agent_id = si.agent_id
  FROM public.sales_invoices si
 WHERE dn.agent_id IS NULL
   AND dn.reference_type = 'sales_invoice'
   AND dn.reference_id = si.id
   AND si.agent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_agents_tenant_user_uq
  ON public.sales_agents (tenant_id, user_id) WHERE user_id IS NOT NULL;

-- 2. FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_sales_agent_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.sales_agents
   WHERE user_id = auth.uid()
     AND tenant_id = public.get_user_tenant_id()
     AND COALESCE(is_active, true) = true
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_agent_customer(p_customer_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_agent  uuid := public.current_sales_agent_id();
  v_scope  text;
BEGIN
  IF v_tenant IS NULL THEN RETURN false; END IF;
  IF public.current_tenant_role() <> 'sales_agent' THEN RETURN true; END IF;
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

-- 3. AUTO-STAMPING
CREATE OR REPLACE FUNCTION public.stamp_agent_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agent uuid;
BEGIN
  IF NEW.agent_id IS NULL AND public.current_tenant_role() = 'sales_agent' THEN
    v_agent := public.current_sales_agent_id();
    IF v_agent IS NOT NULL THEN NEW.agent_id := v_agent; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.stamp_payment_agent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agent uuid;
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF public.current_tenant_role() = 'sales_agent' THEN
    v_agent := public.current_sales_agent_id();
    IF v_agent IS NOT NULL AND NEW.agent_id IS NULL THEN NEW.agent_id := v_agent; END IF;
    IF NEW.agent_id IS NOT NULL THEN NEW.source := 'agent_collection'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_agent_proforma  ON public.proforma_invoices;
DROP TRIGGER IF EXISTS trg_stamp_agent_sales_inv ON public.sales_invoices;
DROP TRIGGER IF EXISTS trg_stamp_agent_dn        ON public.delivery_notes;
DROP TRIGGER IF EXISTS trg_stamp_agent_payment   ON public.payments;

CREATE TRIGGER trg_stamp_agent_proforma  BEFORE INSERT ON public.proforma_invoices  FOR EACH ROW EXECUTE FUNCTION public.stamp_agent_id();
CREATE TRIGGER trg_stamp_agent_sales_inv BEFORE INSERT ON public.sales_invoices     FOR EACH ROW EXECUTE FUNCTION public.stamp_agent_id();
CREATE TRIGGER trg_stamp_agent_dn        BEFORE INSERT ON public.delivery_notes     FOR EACH ROW EXECUTE FUNCTION public.stamp_agent_id();
CREATE TRIGGER trg_stamp_agent_payment   BEFORE INSERT ON public.payments           FOR EACH ROW EXECUTE FUNCTION public.stamp_payment_agent();

-- 4. CAPABILITIES
INSERT INTO public.role_capabilities (role, resource, can_read, can_write, can_void, can_approve) VALUES
  ('sales_agent','payment_in', true, true, false, false),
  ('sales_agent','reports.sales_agent', true, false, false, false)
ON CONFLICT (role, resource) DO UPDATE
  SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write;

UPDATE public.role_capabilities SET can_read = false WHERE role='sales_agent' AND resource='reports';

-- 5. RESTRICTIVE POLICIES — sales_agent
DROP POLICY IF EXISTS sa_restrict_customers_select ON public.customers;
CREATE POLICY sa_restrict_customers_select ON public.customers AS RESTRICTIVE FOR SELECT
  USING (public.current_tenant_role() <> 'sales_agent' OR public.is_agent_customer(id));
DROP POLICY IF EXISTS sa_restrict_customers_modify ON public.customers;
CREATE POLICY sa_restrict_customers_modify ON public.customers AS RESTRICTIVE FOR ALL
  USING (public.current_tenant_role() <> 'sales_agent')
  WITH CHECK (public.current_tenant_role() <> 'sales_agent');

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proforma_invoices','sales_invoices','delivery_notes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sa_restrict_%I_select ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY sa_restrict_%I_select ON public.%I AS RESTRICTIVE FOR SELECT
      USING (public.current_tenant_role() <> 'sales_agent'
             OR agent_id = public.current_sales_agent_id())$f$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS sa_restrict_%I_insert ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY sa_restrict_%I_insert ON public.%I AS RESTRICTIVE FOR INSERT
      WITH CHECK (public.current_tenant_role() <> 'sales_agent'
                  OR public.is_agent_customer(customer_id))$f$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS sa_restrict_%I_update ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY sa_restrict_%I_update ON public.%I AS RESTRICTIVE FOR UPDATE
      USING (public.current_tenant_role() <> 'sales_agent'
             OR agent_id = public.current_sales_agent_id())
      WITH CHECK (public.current_tenant_role() <> 'sales_agent'
                  OR agent_id = public.current_sales_agent_id())$f$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS sa_restrict_%I_delete ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY sa_restrict_%I_delete ON public.%I AS RESTRICTIVE FOR DELETE
      USING (public.current_tenant_role() <> 'sales_agent')$f$, t, t);
  END LOOP;
END $do$;

DROP POLICY IF EXISTS sa_restrict_sii_select ON public.sales_invoice_items;
CREATE POLICY sa_restrict_sii_select ON public.sales_invoice_items AS RESTRICTIVE FOR SELECT
  USING (public.current_tenant_role() <> 'sales_agent'
         OR EXISTS (SELECT 1 FROM public.sales_invoices si
                     WHERE si.id = invoice_id AND si.agent_id = public.current_sales_agent_id()));

DROP POLICY IF EXISTS sa_restrict_payments_select ON public.payments;
CREATE POLICY sa_restrict_payments_select ON public.payments AS RESTRICTIVE FOR SELECT
  USING (public.current_tenant_role() <> 'sales_agent'
         OR (agent_id = public.current_sales_agent_id())
         OR (party_type = 'customer' AND public.is_agent_customer(party_id)));

DROP POLICY IF EXISTS sa_restrict_payments_insert ON public.payments;
CREATE POLICY sa_restrict_payments_insert ON public.payments AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    public.current_tenant_role() <> 'sales_agent'
    OR (
      type = 'received'
      AND party_type = 'customer'
      AND public.is_agent_customer(party_id)
      AND public.current_user_can('payment_in','create')
      AND bank_account_id IS NULL
    )
  );

DROP POLICY IF EXISTS sa_restrict_payments_update ON public.payments;
CREATE POLICY sa_restrict_payments_update ON public.payments AS RESTRICTIVE FOR UPDATE
  USING (
    public.current_tenant_role() <> 'sales_agent'
    OR (agent_id = public.current_sales_agent_id()
        AND COALESCE(status,'active') NOT IN ('approved','voided'))
  );

DROP POLICY IF EXISTS sa_restrict_payments_delete ON public.payments;
CREATE POLICY sa_restrict_payments_delete ON public.payments AS RESTRICTIVE FOR DELETE
  USING (public.current_tenant_role() <> 'sales_agent');

DROP POLICY IF EXISTS rbac_payment_in_write ON public.payments;
CREATE POLICY rbac_payment_in_write ON public.payments FOR INSERT
  WITH CHECK (public.current_user_can('payment_in','create')
              OR public.current_user_can('finance','write'));

-- 6. DENY sales_agent on restricted tables
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_invoices','purchase_orders','purchase_proformas','purchase_returns',
    'purchase_order_items','purchase_proforma_items','purchase_return_items',
    'goods_received_notes','grn_items','suppliers','supplier_products',
    'expenses','expense_ledgers','salary_payments','bank_accounts',
    'chart_of_accounts','journal_entries','journal_lines','additional_costs',
    'staff','agent_commissions','tax_records','stock_audit_log','reconciliation_log',
    'accounting_periods','document_counters','document_templates','backup_runs',
    'audit_log','debit_notes','debit_note_applications','print_jobs','print_deliveries',
    'print_dispatches','print_rejections','purchase_print_allocations','printers',
    'stock_movements','products'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_%I ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY sa_deny_%I ON public.%I AS RESTRICTIVE FOR ALL
      USING (public.current_tenant_role() <> 'sales_agent')
      WITH CHECK (public.current_tenant_role() <> 'sales_agent')$f$, t, t);
  END LOOP;
END $do$;

DROP POLICY IF EXISTS sa_restrict_sales_agents ON public.sales_agents;
CREATE POLICY sa_restrict_sales_agents ON public.sales_agents AS RESTRICTIVE FOR SELECT
  USING (public.current_tenant_role() <> 'sales_agent' OR user_id = auth.uid());
DROP POLICY IF EXISTS sa_deny_sales_agents_write ON public.sales_agents;
CREATE POLICY sa_deny_sales_agents_write ON public.sales_agents AS RESTRICTIVE FOR INSERT
  WITH CHECK (public.current_tenant_role() <> 'sales_agent');
DROP POLICY IF EXISTS sa_deny_sales_agents_upd ON public.sales_agents;
CREATE POLICY sa_deny_sales_agents_upd ON public.sales_agents AS RESTRICTIVE FOR UPDATE
  USING (public.current_tenant_role() <> 'sales_agent');
DROP POLICY IF EXISTS sa_deny_sales_agents_del ON public.sales_agents;
CREATE POLICY sa_deny_sales_agents_del ON public.sales_agents AS RESTRICTIVE FOR DELETE
  USING (public.current_tenant_role() <> 'sales_agent');

DROP POLICY IF EXISTS sa_restrict_agent_customers ON public.agent_customers;
CREATE POLICY sa_restrict_agent_customers ON public.agent_customers AS RESTRICTIVE FOR SELECT
  USING (public.current_tenant_role() <> 'sales_agent'
         OR agent_id = public.current_sales_agent_id());

-- 7. STOCK VIEWS
DROP VIEW IF EXISTS public.agent_stock_availability;
CREATE VIEW public.agent_stock_availability
WITH (security_invoker = true) AS
SELECT
  p.id              AS product_id,
  p.tenant_id,
  p.product_code,
  p.name,
  p.category,
  p.brand,
  p.unit,
  p.pack_size,
  p.selling_price,
  p.mrp,
  p.stock_quantity  AS available_qty,
  p.reorder_level,
  CASE
    WHEN p.stock_quantity <= 0 THEN 'out'
    WHEN p.stock_quantity <= COALESCE(p.reorder_level,0) THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM public.products p
WHERE p.tenant_id = public.get_user_tenant_id()
  AND COALESCE(p.is_active, true) = true;

GRANT SELECT ON public.agent_stock_availability TO authenticated;

DROP VIEW IF EXISTS public.agent_batch_availability;
CREATE VIEW public.agent_batch_availability
WITH (security_invoker = true) AS
SELECT
  g.tenant_id,
  g.product_id,
  p.product_code,
  p.name AS product_name,
  g.batch_number,
  g.expiry_date,
  GREATEST(COALESCE(SUM(g.quantity_received),0)
    - COALESCE((
        SELECT SUM(sii.quantity)
          FROM public.sales_invoice_items sii
          JOIN public.sales_invoices si ON si.id = sii.invoice_id
         WHERE sii.product_id = g.product_id
           AND sii.batch_number = g.batch_number
           AND sii.tenant_id = g.tenant_id
           AND COALESCE(si.status,'') <> 'voided'
      ),0), 0) AS available_qty,
  CASE
    WHEN g.expiry_date IS NULL THEN 'none'
    WHEN g.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN g.expiry_date < CURRENT_DATE + 30 THEN 'critical'
    WHEN g.expiry_date < CURRENT_DATE + 90 THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,
  p.selling_price
FROM public.grn_items g
JOIN public.products p ON p.id = g.product_id
WHERE g.tenant_id = public.get_user_tenant_id()
GROUP BY g.tenant_id, g.product_id, p.product_code, p.name, g.batch_number, g.expiry_date, p.selling_price;

GRANT SELECT ON public.agent_batch_availability TO authenticated;
