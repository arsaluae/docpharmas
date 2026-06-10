
CREATE OR REPLACE FUNCTION public.report_profit_loss(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_revenue numeric := 0;
  v_sales_returns numeric := 0;
  v_cogs numeric := 0;
  v_purchase_returns numeric := 0;
  v_expenses jsonb := '[]'::jsonb;
  v_expenses_total numeric := 0;
  v_salaries numeric := 0;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_revenue
  FROM sales_invoices
  WHERE tenant_id = v_tenant AND date BETWEEN p_from AND p_to
    AND COALESCE(status,'') NOT IN ('draft','voided','cancelled');

  SELECT COALESCE(SUM(total), 0) INTO v_sales_returns
  FROM sales_returns
  WHERE tenant_id = v_tenant AND date BETWEEN p_from AND p_to
    AND COALESCE(status,'') NOT IN ('draft','voided','cancelled');

  SELECT COALESCE(SUM(sii.quantity * COALESCE(NULLIF(sii.unit_cost,0), p.cost_price, 0)), 0) INTO v_cogs
  FROM sales_invoice_items sii
  JOIN sales_invoices si ON si.id = sii.invoice_id
  LEFT JOIN products p ON p.id = sii.product_id
  WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_from AND p_to
    AND COALESCE(si.status,'') NOT IN ('draft','voided','cancelled');

  SELECT COALESCE(SUM(total), 0) INTO v_purchase_returns
  FROM purchase_returns
  WHERE tenant_id = v_tenant AND date BETWEEN p_from AND p_to
    AND COALESCE(status,'') NOT IN ('draft','voided','cancelled');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'amount', amt) ORDER BY amt DESC), '[]'::jsonb),
         COALESCE(SUM(amt), 0)
  INTO v_expenses, v_expenses_total
  FROM (
    SELECT category, SUM(amount) AS amt
    FROM expenses
    WHERE tenant_id = v_tenant AND date BETWEEN p_from AND p_to
      AND expense_type = 'business'
      AND COALESCE(status,'') NOT IN ('draft','voided','cancelled')
    GROUP BY category
  ) t;

  SELECT COALESCE(SUM(amount), 0) INTO v_salaries
  FROM salary_payments
  WHERE tenant_id = v_tenant AND date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'date_from', p_from, 'date_to', p_to,
    'revenue', v_revenue, 'sales_returns', v_sales_returns,
    'net_revenue', v_revenue - v_sales_returns,
    'cogs', v_cogs, 'purchase_returns', v_purchase_returns,
    'net_cogs', v_cogs - v_purchase_returns,
    'gross_profit', (v_revenue - v_sales_returns) - (v_cogs - v_purchase_returns),
    'expenses_total', v_expenses_total, 'expenses_by_category', v_expenses,
    'salaries', v_salaries,
    'net_profit', (v_revenue - v_sales_returns) - (v_cogs - v_purchase_returns) - v_expenses_total - v_salaries
  );
END $$;

GRANT EXECUTE ON FUNCTION public.report_profit_loss(date, date) TO authenticated;


CREATE OR REPLACE FUNCTION public.report_sales_summary(
  p_from date, p_to date,
  p_customer uuid DEFAULT NULL, p_product uuid DEFAULT NULL, p_city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_gross numeric := 0; v_discount numeric := 0; v_tax numeric := 0;
  v_net numeric := 0; v_cogs numeric := 0; v_returns numeric := 0; v_invoices int := 0;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;

  SELECT
    COALESCE(SUM(si.subtotal + COALESCE(si.discount_amount,0)), 0),
    COALESCE(SUM(COALESCE(si.discount_amount,0)), 0),
    COALESCE(SUM(COALESCE(si.gst_amount,0)), 0),
    COALESCE(SUM(si.subtotal), 0),
    COUNT(*)
  INTO v_gross, v_discount, v_tax, v_net, v_invoices
  FROM sales_invoices si
  LEFT JOIN customers c ON c.id = si.customer_id
  WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_from AND p_to
    AND COALESCE(si.status,'') NOT IN ('draft','voided','cancelled')
    AND (p_customer IS NULL OR si.customer_id = p_customer)
    AND (p_city IS NULL OR LOWER(COALESCE(c.city,'')) = LOWER(p_city))
    AND (p_product IS NULL OR EXISTS (
      SELECT 1 FROM sales_invoice_items x WHERE x.invoice_id = si.id AND x.product_id = p_product
    ));

  SELECT COALESCE(SUM(sii.quantity * COALESCE(NULLIF(sii.unit_cost,0), p.cost_price, 0)), 0) INTO v_cogs
  FROM sales_invoice_items sii
  JOIN sales_invoices si ON si.id = sii.invoice_id
  LEFT JOIN products p ON p.id = sii.product_id
  LEFT JOIN customers c ON c.id = si.customer_id
  WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_from AND p_to
    AND COALESCE(si.status,'') NOT IN ('draft','voided','cancelled')
    AND (p_customer IS NULL OR si.customer_id = p_customer)
    AND (p_city IS NULL OR LOWER(COALESCE(c.city,'')) = LOWER(p_city))
    AND (p_product IS NULL OR sii.product_id = p_product);

  SELECT COALESCE(SUM(total), 0) INTO v_returns
  FROM sales_returns sr
  LEFT JOIN customers c ON c.id = sr.customer_id
  WHERE sr.tenant_id = v_tenant AND sr.date BETWEEN p_from AND p_to
    AND COALESCE(sr.status,'') NOT IN ('draft','voided','cancelled')
    AND (p_customer IS NULL OR sr.customer_id = p_customer)
    AND (p_city IS NULL OR LOWER(COALESCE(c.city,'')) = LOWER(p_city));

  RETURN jsonb_build_object(
    'date_from', p_from, 'date_to', p_to, 'invoice_count', v_invoices,
    'gross_sales', v_gross, 'discount', v_discount, 'tax', v_tax,
    'net_sales', v_net, 'sales_returns', v_returns, 'cogs', v_cogs,
    'gross_profit', v_net - v_returns - v_cogs,
    'margin_pct', CASE WHEN v_net > 0 THEN ((v_net - v_returns - v_cogs) / v_net) * 100 ELSE 0 END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.report_sales_summary(date, date, uuid, uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.report_receivables_aging(p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  invoice_id uuid, invoice_number text, customer_id uuid, customer_name text,
  city text, contact text, due_date date,
  total numeric, amount_paid numeric, outstanding numeric,
  days_overdue int, bucket text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tenant uuid := public.get_user_tenant_id();
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;
  RETURN QUERY
  SELECT
    si.id, si.invoice_number, si.customer_id, c.name, c.city, c.phone,
    si.due_date,
    si.total::numeric, COALESCE(si.amount_paid,0)::numeric,
    (si.total - COALESCE(si.amount_paid,0))::numeric,
    GREATEST(0, (p_as_of - COALESCE(si.due_date, p_as_of)))::int,
    CASE
      WHEN p_as_of - COALESCE(si.due_date, p_as_of) <= 0 THEN 'Current'
      WHEN p_as_of - si.due_date <= 30 THEN '1-30'
      WHEN p_as_of - si.due_date <= 60 THEN '31-60'
      WHEN p_as_of - si.due_date <= 90 THEN '61-90'
      ELSE '90+'
    END
  FROM sales_invoices si
  LEFT JOIN customers c ON c.id = si.customer_id
  WHERE si.tenant_id = v_tenant
    AND COALESCE(si.status,'') IN ('dispatched','unpaid','partial')
    AND COALESCE(si.status,'') NOT IN ('draft','voided','cancelled')
    AND (si.total - COALESCE(si.amount_paid,0)) > 0
  ORDER BY si.due_date NULLS LAST;
END $$;

GRANT EXECUTE ON FUNCTION public.report_receivables_aging(date) TO authenticated;


CREATE OR REPLACE FUNCTION public.report_payables_aging(p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  invoice_id uuid, bill_number text, supplier_id uuid, supplier_name text,
  city text, contact text, due_date date,
  total numeric, amount_paid numeric, outstanding numeric,
  days_overdue int, bucket text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tenant uuid := public.get_user_tenant_id();
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No tenant context'; END IF;
  RETURN QUERY
  SELECT
    pi.id, pi.bill_number, pi.supplier_id, s.name, s.city, s.phone,
    pi.due_date,
    pi.total::numeric, COALESCE(paid.amt, 0)::numeric,
    (pi.total - COALESCE(paid.amt, 0))::numeric,
    GREATEST(0, (p_as_of - COALESCE(pi.due_date, p_as_of)))::int,
    CASE
      WHEN p_as_of - COALESCE(pi.due_date, p_as_of) <= 0 THEN 'Current'
      WHEN p_as_of - pi.due_date <= 30 THEN '1-30'
      WHEN p_as_of - pi.due_date <= 60 THEN '31-60'
      WHEN p_as_of - pi.due_date <= 90 THEN '61-90'
      ELSE '90+'
    END
  FROM purchase_invoices pi
  LEFT JOIN suppliers s ON s.id = pi.supplier_id
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS amt
    FROM payments p
    WHERE p.invoice_id = pi.id
      AND p.party_type = 'supplier' AND p.type = 'made'
      AND COALESCE(p.status,'') NOT IN ('draft','voided','cancelled')
  ) paid ON true
  WHERE pi.tenant_id = v_tenant
    AND COALESCE(pi.status,'') IN ('unpaid','partial')
    AND COALESCE(pi.status,'') NOT IN ('draft','voided','cancelled')
    AND (pi.total - COALESCE(paid.amt, 0)) > 0
  ORDER BY pi.due_date NULLS LAST;
END $$;

GRANT EXECUTE ON FUNCTION public.report_payables_aging(date) TO authenticated;


CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant_date_status     ON public.sales_invoices(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_tenant_date_status  ON public.purchase_invoices(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_tenant_date_status      ON public.sales_returns(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant_date_status   ON public.purchase_returns(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date_status           ON public.payments(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date_status           ON public.expenses(tenant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant_date          ON public.salary_payments(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice_product   ON public.sales_invoice_items(invoice_id, product_id);
