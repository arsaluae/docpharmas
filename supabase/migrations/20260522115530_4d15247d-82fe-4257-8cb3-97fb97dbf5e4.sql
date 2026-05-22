
-- ============ PERFORMANCE INDEXES ============
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON public.sales_invoices(date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON public.sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant_date ON public.sales_invoices(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON public.sales_invoices(status);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON public.sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product ON public.sales_invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON public.purchase_invoices(date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON public.purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON public.purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_tenant_date ON public.purchase_invoices(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_grn_items_product ON public.grn_items(product_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON public.grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_expiry ON public.grn_items(expiry_date);

CREATE INDEX IF NOT EXISTS idx_payments_party ON public.payments(party_id, party_type, type);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_bank ON public.payments(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_bank ON public.expenses(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_type_date ON public.expenses(expense_type, date);

CREATE INDEX IF NOT EXISTS idx_purchase_proformas_status ON public.purchase_proformas(status);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_status ON public.proforma_invoices(status);

CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_notes_party ON public.credit_notes(party_id, party_type);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON public.purchase_returns(supplier_id);

-- ============ DASHBOARD AGGREGATION RPCs ============
-- Single round-trip KPI snapshot for the dashboard
CREATE OR REPLACE FUNCTION public.dashboard_kpis(
  p_week_start date,
  p_month_start date,
  p_year_start date,
  p_last_month_start date,
  p_last_month_end date,
  p_today date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(SUM(sii.quantity * COALESCE(p.cost_price, 0)), 0)
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
$$;

-- Single round-trip chart/list data for the dashboard
CREATE OR REPLACE FUNCTION public.dashboard_charts(
  p_month_start date,
  p_year_start date,
  p_trend_start date,
  p_today date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_daily jsonb;
  v_expenses jsonb;
  v_top_products jsonb;
  v_top_customers jsonb;
  v_recent_stock jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'amount', amt) ORDER BY d), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT date AS d, SUM(subtotal) AS amt
    FROM sales_invoices
    WHERE tenant_id = v_tenant AND date BETWEEN p_trend_start AND p_today
    GROUP BY date
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', category, 'value', amt) ORDER BY amt DESC), '[]'::jsonb)
  INTO v_expenses
  FROM (
    SELECT category, SUM(amount) AS amt
    FROM expenses
    WHERE tenant_id = v_tenant AND expense_type = 'business'
      AND date BETWEEN p_month_start AND p_today
    GROUP BY category
    ORDER BY amt DESC
    LIMIT 6
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'qty', qty) ORDER BY qty DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT COALESCE(p.name, 'Unknown') AS name, SUM(sii.quantity) AS qty
    FROM sales_invoice_items sii
    JOIN sales_invoices si ON si.id = sii.invoice_id
    LEFT JOIN products p ON p.id = sii.product_id
    WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_month_start AND p_today
      AND sii.product_id IS NOT NULL
    GROUP BY p.name
    ORDER BY qty DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'monthSale', m, 'yearlySale', y) ORDER BY y DESC), '[]'::jsonb)
  INTO v_top_customers
  FROM (
    SELECT COALESCE(c.name,'Unknown') AS name,
      SUM(CASE WHEN si.date >= p_month_start THEN si.subtotal ELSE 0 END) AS m,
      SUM(CASE WHEN si.date >= p_year_start THEN si.subtotal ELSE 0 END) AS y
    FROM sales_invoices si
    LEFT JOIN customers c ON c.id = si.customer_id
    WHERE si.tenant_id = v_tenant AND si.date BETWEEN p_year_start AND p_today
      AND si.customer_id IS NOT NULL
    GROUP BY c.name
    ORDER BY y DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'date', d) ORDER BY d DESC), '[]'::jsonb)
  INTO v_recent_stock
  FROM (
    SELECT COALESCE(p.name,'Unknown') AS name, sm.quantity, sm.date AS d
    FROM stock_movements sm
    LEFT JOIN products p ON p.id = sm.product_id
    WHERE sm.tenant_id = v_tenant AND sm.movement_type = 'purchase_in'
    ORDER BY sm.created_at DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'daily', v_daily,
    'expenses', v_expenses,
    'top_products', v_top_products,
    'top_customers', v_top_customers,
    'recent_stock', v_recent_stock
  );
END;
$$;
