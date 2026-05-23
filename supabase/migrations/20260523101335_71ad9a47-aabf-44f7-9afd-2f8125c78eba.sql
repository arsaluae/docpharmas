
-- 1. Accounting periods table
CREATE TABLE public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  lock_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_accounting_periods ON public.accounting_periods
  FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_insert_accounting_periods ON public.accounting_periods
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_update_accounting_periods ON public.accounting_periods
  FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tenant_delete_accounting_periods ON public.accounting_periods
  FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_accounting_periods
  BEFORE INSERT ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE INDEX idx_accounting_periods_tenant_dates
  ON public.accounting_periods (tenant_id, period_start, period_end)
  WHERE is_locked = true;

-- 2. Period-lock enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_tenant uuid;
  v_locked boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.date;
    v_tenant := OLD.tenant_id;
  ELSE
    v_date := NEW.date;
    v_tenant := COALESCE(NEW.tenant_id, get_user_tenant_id());
  END IF;

  IF v_date IS NULL OR v_tenant IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.accounting_periods
    WHERE tenant_id = v_tenant
      AND is_locked = true
      AND v_date BETWEEN period_start AND period_end
  ) INTO v_locked;

  IF v_locked THEN
    RAISE EXCEPTION 'Accounting period containing % is locked. Unlock the period before modifying records.', v_date
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Attach trigger to financial tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales_invoices','purchase_invoices','payments','expenses',
    'sales_returns','purchase_returns','goods_received_notes',
    'credit_notes','debit_notes','salary_payments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS enforce_period_lock_trg ON public.%I', t);
      EXECUTE format('CREATE TRIGGER enforce_period_lock_trg BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock()', t);
    END IF;
  END LOOP;
END $$;

-- 3. COGS cost snapshot column on sales_invoice_items
ALTER TABLE public.sales_invoice_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.snapshot_sales_item_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.unit_cost IS NULL OR NEW.unit_cost = 0) AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(cost_price, 0) INTO NEW.unit_cost FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_sales_item_cost_trg ON public.sales_invoice_items;
CREATE TRIGGER snapshot_sales_item_cost_trg
  BEFORE INSERT ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_sales_item_cost();

-- Backfill historical rows with current product cost (best-effort)
UPDATE public.sales_invoice_items sii
SET unit_cost = COALESCE(p.cost_price, 0)
FROM public.products p
WHERE sii.product_id = p.id
  AND (sii.unit_cost = 0 OR sii.unit_cost IS NULL);

-- 4. Update dashboard_kpis to use snapshot cost
CREATE OR REPLACE FUNCTION public.dashboard_kpis(p_week_start date, p_month_start date, p_year_start date, p_last_month_start date, p_last_month_end date, p_today date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_week numeric := 0;
  v_month numeric := 0;
  v_year numeric := 0;
  v_last_month numeric := 0;
  v_revenue numeric := 0;
  v_cogs numeric := 0;
  v_recv numeric := 0;
  v_pay numeric := 0;
  v_po_count int := 0;
  v_po_value numeric := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal),0) INTO v_week
    FROM sales_invoices WHERE tenant_id = v_tenant AND date BETWEEN p_week_start AND p_today;
  SELECT COALESCE(SUM(subtotal),0) INTO v_month
    FROM sales_invoices WHERE tenant_id = v_tenant AND date BETWEEN p_month_start AND p_today;
  SELECT COALESCE(SUM(subtotal),0) INTO v_year
    FROM sales_invoices WHERE tenant_id = v_tenant AND date BETWEEN p_year_start AND p_today;
  SELECT COALESCE(SUM(subtotal),0) INTO v_last_month
    FROM sales_invoices WHERE tenant_id = v_tenant AND date BETWEEN p_last_month_start AND p_last_month_end;

  SELECT
    COALESCE(SUM(sii.amount), 0),
    COALESCE(SUM(sii.quantity * COALESCE(NULLIF(sii.unit_cost,0), p.cost_price, 0)), 0)
  INTO v_revenue, v_cogs
  FROM sales_invoice_items sii
  JOIN sales_invoices si ON si.id = sii.invoice_id
  LEFT JOIN products p ON p.id = sii.product_id
  WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_month_start AND p_today;

  SELECT COALESCE(SUM(GREATEST(balance,0)),0) INTO v_recv FROM customers WHERE tenant_id = v_tenant;
  SELECT COALESCE(SUM(GREATEST(balance,0)),0) INTO v_pay  FROM suppliers WHERE tenant_id = v_tenant;

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_po_count, v_po_value
  FROM purchase_proformas
  WHERE tenant_id = v_tenant AND status IN ('draft','ordered','confirmed','sent');

  RETURN jsonb_build_object(
    'week_sales', v_week,
    'month_sales', v_month,
    'year_sales', v_year,
    'last_month_sales', v_last_month,
    'revenue', v_revenue,
    'cogs', v_cogs,
    'gross_profit', v_revenue - v_cogs,
    'receivables', v_recv,
    'payables', v_pay,
    'upcoming_po_count', v_po_count,
    'upcoming_po_value', v_po_value
  );
END;
$function$;
