
-- =====================================================================
-- PHASE 2 — DB & ACCOUNTING HARDENING
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. WIPE (gated). Caller must SET LOCAL "app.allow_wipe" = 'yes';
-- ------------------------------------------------------------------
DO $wipe$
DECLARE v_allow text := current_setting('app.allow_wipe', true);
BEGIN
  IF v_allow = 'yes' THEN
    -- transactional
    TRUNCATE TABLE
      public.credit_note_applications,
      public.debit_note_applications,
      public.credit_notes,
      public.debit_notes,
      public.payments,
      public.payment_submissions,
      public.journal_lines,
      public.journal_entries,
      public.stock_movements,
      public.stock_audit_log,
      public.grn_items,
      public.goods_received_notes,
      public.delivery_notes,
      public.sales_invoice_items,
      public.sales_invoices,
      public.sales_return_items,
      public.sales_returns,
      public.purchase_return_items,
      public.purchase_returns,
      public.purchase_invoices,
      public.purchase_order_items,
      public.purchase_orders,
      public.purchase_proforma_items,
      public.purchase_proformas,
      public.purchase_print_allocations,
      public.proforma_invoices,
      public.expenses,
      public.agent_commissions,
      public.salary_payments,
      public.print_deliveries,
      public.print_rejections,
      public.print_jobs,
      public.additional_costs,
      public.audit_log,
      public.accounting_periods,
      public.warranty_invoices,
      public.tax_records,
      public.reorder_alerts
    RESTART IDENTITY CASCADE;

    -- master
    TRUNCATE TABLE
      public.customer_distributors,
      public.customer_licenses,
      public.customer_products,
      public.city_products,
      public.agent_customers,
      public.sales_agents,
      public.drap_registrations,
      public.supplier_products,
      public.printers,
      public.staff,
      public.customers,
      public.suppliers,
      public.products,
      public.areas,
      public.freight_providers,
      public.bank_accounts,
      public.chart_of_accounts,
      public.expense_ledgers,
      public.document_templates,
      public.document_counters,
      public.company_settings
    RESTART IDENTITY CASCADE;

    RAISE NOTICE 'Phase 2 wipe complete.';
  ELSE
    RAISE NOTICE 'Phase 2 wipe skipped (app.allow_wipe not set to yes).';
  END IF;
END $wipe$;

-- ------------------------------------------------------------------
-- 2. SOFT-VOID COLUMNS on every financial document
-- ------------------------------------------------------------------
DO $cols$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales_invoices','purchase_invoices','sales_orders','purchase_orders',
    'proforma_invoices','purchase_proformas','goods_received_notes',
    'delivery_notes','credit_notes','debit_notes','expenses',
    'journal_entries','stock_movements','payments','sales_returns',
    'purchase_returns','warranty_invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT ''active'',
        ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
        ADD COLUMN IF NOT EXISTS void_reason text,
        ADD COLUMN IF NOT EXISTS voided_by   uuid', t);
    END IF;
  END LOOP;
END $cols$;

-- ------------------------------------------------------------------
-- 3. BALANCE RECOMPUTE FUNCTIONS
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_party_balance(p_party_type text, p_party_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_opening numeric := 0;
  v_inv     numeric := 0;
  v_pay     numeric := 0;
  v_cn      numeric := 0;
  v_dn      numeric := 0;
  v_computed numeric;
BEGIN
  IF p_party_type = 'customer' THEN
    SELECT COALESCE(opening_balance,0) INTO v_opening FROM customers WHERE id = p_party_id;
    SELECT COALESCE(SUM(total),0) INTO v_inv
      FROM sales_invoices WHERE customer_id = p_party_id AND COALESCE(status,'active') <> 'voided';
    SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE -amount END),0) INTO v_pay
      FROM payments WHERE party_type='customer' AND party_id=p_party_id AND COALESCE(status,'active')<>'voided';
    SELECT COALESCE(SUM(amount),0) INTO v_cn
      FROM credit_notes WHERE party_type='customer' AND party_id=p_party_id AND COALESCE(status,'active')='active';
    SELECT COALESCE(SUM(amount),0) INTO v_dn
      FROM debit_notes  WHERE party_type='customer' AND party_id=p_party_id AND COALESCE(status,'active')='active';
    v_computed := v_opening + v_inv - v_pay - v_cn + v_dn;
    UPDATE customers SET balance = v_computed WHERE id = p_party_id;

  ELSIF p_party_type = 'supplier' THEN
    SELECT COALESCE(opening_balance,0) INTO v_opening FROM suppliers WHERE id = p_party_id;
    SELECT COALESCE(SUM(total),0) INTO v_inv
      FROM purchase_invoices WHERE supplier_id = p_party_id AND COALESCE(status,'active') <> 'voided';
    SELECT COALESCE(SUM(CASE WHEN type='made' THEN amount ELSE -amount END),0) INTO v_pay
      FROM payments WHERE party_type='supplier' AND party_id=p_party_id AND COALESCE(status,'active')<>'voided';
    SELECT COALESCE(SUM(amount),0) INTO v_cn
      FROM credit_notes WHERE party_type='supplier' AND party_id=p_party_id AND COALESCE(status,'active')='active';
    SELECT COALESCE(SUM(amount),0) INTO v_dn
      FROM debit_notes  WHERE party_type='supplier' AND party_id=p_party_id AND COALESCE(status,'active')='active';
    v_computed := v_opening + v_inv - v_pay - v_dn + v_cn;
    UPDATE suppliers SET balance = v_computed WHERE id = p_party_id;
  ELSE
    RETURN 0;
  END IF;

  RETURN v_computed;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_bank_balance(p_bank_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_opening numeric := 0; v_pay numeric := 0; v_exp numeric := 0; v_sal numeric := 0; v_computed numeric;
BEGIN
  SELECT COALESCE(opening_balance,0) INTO v_opening FROM bank_accounts WHERE id = p_bank_id;
  SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE -amount END),0) INTO v_pay
    FROM payments WHERE bank_account_id = p_bank_id AND COALESCE(status,'active') <> 'voided';
  SELECT COALESCE(SUM(amount),0) INTO v_exp
    FROM expenses WHERE bank_account_id = p_bank_id AND COALESCE(status,'active') <> 'voided';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='salary_payments' AND column_name='bank_account_id') THEN
    SELECT COALESCE(SUM(amount),0) INTO v_sal FROM salary_payments WHERE bank_account_id = p_bank_id;
  END IF;
  v_computed := v_opening + v_pay - v_exp - v_sal;
  UPDATE bank_accounts SET balance = v_computed WHERE id = p_bank_id;
  RETURN v_computed;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_product_stock(p_product_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_in numeric := 0; v_out numeric := 0; v_computed numeric;
BEGIN
  SELECT COALESCE(SUM(quantity),0) INTO v_in
    FROM stock_movements
    WHERE product_id = p_product_id
      AND movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening')
      AND COALESCE(status,'active') <> 'voided';
  SELECT COALESCE(SUM(quantity),0) INTO v_out
    FROM stock_movements
    WHERE product_id = p_product_id
      AND movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired')
      AND COALESCE(status,'active') <> 'voided';
  v_computed := v_in - v_out;
  UPDATE products SET stock_quantity = v_computed WHERE id = p_product_id;
  RETURN v_computed;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_account_balance(p_account_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_computed numeric;
BEGIN
  SELECT COALESCE(SUM(jl.debit - jl.credit),0) INTO v_computed
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE jl.account_id = p_account_id
    AND COALESCE(je.status,'active') NOT IN ('voided','draft');
  UPDATE chart_of_accounts SET balance = v_computed WHERE id = p_account_id;
  RETURN v_computed;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_tenant_all(p_tenant uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('recompute:'||p_tenant::text));
  FOR r IN SELECT id FROM customers WHERE tenant_id = p_tenant LOOP
    PERFORM recompute_party_balance('customer', r.id);
  END LOOP;
  FOR r IN SELECT id FROM suppliers WHERE tenant_id = p_tenant LOOP
    PERFORM recompute_party_balance('supplier', r.id);
  END LOOP;
  FOR r IN SELECT id FROM bank_accounts WHERE tenant_id = p_tenant LOOP
    PERFORM recompute_bank_balance(r.id);
  END LOOP;
  FOR r IN SELECT id FROM products WHERE tenant_id = p_tenant LOOP
    PERFORM recompute_product_stock(r.id);
  END LOOP;
  FOR r IN SELECT id FROM chart_of_accounts WHERE tenant_id = p_tenant LOOP
    PERFORM recompute_account_balance(r.id);
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 4. NEW void_document — soft-void with balance reversal
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_document(p_table text, p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_allowed text[] := ARRAY[
    'sales_invoices','purchase_invoices','goods_received_notes','payments',
    'sales_orders','purchase_orders','proforma_invoices','purchase_proformas',
    'delivery_notes','credit_notes','debit_notes','expenses','warranty_invoices'
  ];
  v_party_type text;
  v_party_id   uuid;
  v_bank_id    uuid;
BEGIN
  IF NOT (p_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Void not supported for table %', p_table;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to void a document.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('void:'||v_tenant::text||':'||p_table));

  -- soft-void related stock movements (compensating effect via recompute)
  UPDATE stock_movements
     SET status='voided', voided_at=now(), void_reason=p_reason
   WHERE reference_id = p_id AND tenant_id = v_tenant
     AND COALESCE(status,'active') <> 'voided';

  -- soft-void the document itself
  EXECUTE format(
    'UPDATE public.%I SET status=''voided'', void_reason=$1, voided_at=now(), voided_by=auth.uid()
       WHERE id=$2 AND tenant_id=$3 AND COALESCE(status,''active'')<>''voided''',
    p_table
  ) USING p_reason, p_id, v_tenant;

  -- figure out affected party / bank for recompute
  IF p_table = 'sales_invoices' THEN
    SELECT 'customer', customer_id INTO v_party_type, v_party_id FROM sales_invoices WHERE id=p_id;
  ELSIF p_table = 'purchase_invoices' THEN
    SELECT 'supplier', supplier_id INTO v_party_type, v_party_id FROM purchase_invoices WHERE id=p_id;
  ELSIF p_table = 'payments' THEN
    SELECT party_type, party_id, bank_account_id INTO v_party_type, v_party_id, v_bank_id FROM payments WHERE id=p_id;
  ELSIF p_table = 'credit_notes' THEN
    SELECT party_type, party_id INTO v_party_type, v_party_id FROM credit_notes WHERE id=p_id;
  ELSIF p_table = 'debit_notes' THEN
    SELECT party_type, party_id INTO v_party_type, v_party_id FROM debit_notes WHERE id=p_id;
  ELSIF p_table = 'expenses' THEN
    SELECT bank_account_id INTO v_bank_id FROM expenses WHERE id=p_id;
  END IF;

  IF v_party_type IS NOT NULL AND v_party_id IS NOT NULL THEN
    PERFORM recompute_party_balance(v_party_type, v_party_id);
    IF v_party_type='customer' THEN PERFORM recalc_customer_invoice_status(v_party_id); END IF;
    IF v_party_type='supplier' THEN PERFORM recalc_supplier_invoice_status(v_party_id); END IF;
  END IF;
  IF v_bank_id IS NOT NULL THEN
    PERFORM recompute_bank_balance(v_bank_id);
  END IF;

  -- recompute stock for affected products (cheap: only those touched)
  PERFORM recompute_product_stock(product_id)
    FROM (SELECT DISTINCT product_id FROM stock_movements WHERE reference_id=p_id AND product_id IS NOT NULL) s;
END $$;

-- ------------------------------------------------------------------
-- 5. TRIAL BALANCE materialized view + refresh fn + RLS view
-- ------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_trial_balance CASCADE;
CREATE MATERIALIZED VIEW public.mv_trial_balance AS
SELECT
  jl.tenant_id,
  jl.account_id,
  coa.code,
  coa.name,
  coa.account_type,
  date_trunc('month', je.date)::date AS period,
  SUM(jl.debit)  AS debit,
  SUM(jl.credit) AS credit,
  SUM(jl.debit - jl.credit) AS net
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.journal_entry_id
JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
WHERE COALESCE(je.status,'active') NOT IN ('voided','draft')
GROUP BY jl.tenant_id, jl.account_id, coa.code, coa.name, coa.account_type, date_trunc('month', je.date);

CREATE UNIQUE INDEX IF NOT EXISTS mv_trial_balance_uk ON public.mv_trial_balance (tenant_id, account_id, period);
CREATE INDEX IF NOT EXISTS mv_trial_balance_tp ON public.mv_trial_balance (tenant_id, period);

CREATE OR REPLACE VIEW public.v_trial_balance
WITH (security_invoker=true) AS
SELECT * FROM public.mv_trial_balance
WHERE tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin');

GRANT SELECT ON public.v_trial_balance TO authenticated;
GRANT ALL ON public.v_trial_balance TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_trial_balance()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_trial_balance;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.mv_trial_balance;
END $$;

-- ------------------------------------------------------------------
-- 6. RECONCILIATION LOG + RPC
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  run_at       timestamptz NOT NULL DEFAULT now(),
  scope        text NOT NULL,
  entity_id    uuid,
  entity_label text,
  stored_value numeric,
  computed_value numeric,
  drift        numeric,
  status       text NOT NULL DEFAULT 'ok',
  notes        text
);
GRANT SELECT, INSERT, DELETE ON public.reconciliation_log TO authenticated;
GRANT ALL ON public.reconciliation_log TO service_role;
ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recon_select ON public.reconciliation_log;
CREATE POLICY recon_select ON public.reconciliation_log FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS recon_insert ON public.reconciliation_log;
CREATE POLICY recon_insert ON public.reconciliation_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS recon_delete ON public.reconciliation_log;
CREATE POLICY recon_delete ON public.reconciliation_log FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS recon_log_tenant_run ON public.reconciliation_log (tenant_id, run_at DESC);

CREATE OR REPLACE FUNCTION public.run_reconciliation(p_tenant uuid, p_auto_fix boolean DEFAULT false)
RETURNS TABLE(scope text, entity_id uuid, entity_label text, stored numeric, computed numeric, drift numeric, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_stored numeric;
  v_computed numeric;
  v_drift numeric;
  v_status text;
BEGIN
  IF p_tenant IS NULL THEN p_tenant := get_user_tenant_id(); END IF;
  IF p_tenant IS NULL THEN RAISE EXCEPTION 'tenant_id required'; END IF;

  -- customers
  FOR r IN SELECT id, name, balance FROM customers WHERE tenant_id = p_tenant LOOP
    v_stored := r.balance;
    SELECT recompute_party_balance('customer', r.id) INTO v_computed;
    v_drift := COALESCE(v_stored,0) - COALESCE(v_computed,0);
    v_status := CASE WHEN abs(v_drift) < 0.01 THEN 'ok' WHEN p_auto_fix THEN 'fixed' ELSE 'drift' END;
    IF v_status <> 'ok' OR abs(v_drift) >= 0.01 THEN
      INSERT INTO reconciliation_log(tenant_id, scope, entity_id, entity_label, stored_value, computed_value, drift, status)
      VALUES (p_tenant,'party:customer', r.id, r.name, v_stored, v_computed, v_drift, v_status);
    END IF;
    scope:='party:customer'; entity_id:=r.id; entity_label:=r.name;
    stored:=v_stored; computed:=v_computed; drift:=v_drift; status:=v_status;
    IF abs(v_drift) >= 0.01 THEN RETURN NEXT; END IF;
  END LOOP;

  -- suppliers
  FOR r IN SELECT id, name, balance FROM suppliers WHERE tenant_id = p_tenant LOOP
    v_stored := r.balance;
    SELECT recompute_party_balance('supplier', r.id) INTO v_computed;
    v_drift := COALESCE(v_stored,0) - COALESCE(v_computed,0);
    v_status := CASE WHEN abs(v_drift) < 0.01 THEN 'ok' WHEN p_auto_fix THEN 'fixed' ELSE 'drift' END;
    IF abs(v_drift) >= 0.01 THEN
      INSERT INTO reconciliation_log(tenant_id, scope, entity_id, entity_label, stored_value, computed_value, drift, status)
      VALUES (p_tenant,'party:supplier', r.id, r.name, v_stored, v_computed, v_drift, v_status);
      scope:='party:supplier'; entity_id:=r.id; entity_label:=r.name;
      stored:=v_stored; computed:=v_computed; drift:=v_drift; status:=v_status;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- bank accounts
  FOR r IN SELECT id, name, balance FROM bank_accounts WHERE tenant_id = p_tenant LOOP
    v_stored := r.balance;
    SELECT recompute_bank_balance(r.id) INTO v_computed;
    v_drift := COALESCE(v_stored,0) - COALESCE(v_computed,0);
    v_status := CASE WHEN abs(v_drift) < 0.01 THEN 'ok' WHEN p_auto_fix THEN 'fixed' ELSE 'drift' END;
    IF abs(v_drift) >= 0.01 THEN
      INSERT INTO reconciliation_log(tenant_id, scope, entity_id, entity_label, stored_value, computed_value, drift, status)
      VALUES (p_tenant,'bank', r.id, r.name, v_stored, v_computed, v_drift, v_status);
      scope:='bank'; entity_id:=r.id; entity_label:=r.name;
      stored:=v_stored; computed:=v_computed; drift:=v_drift; status:=v_status;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- products
  FOR r IN SELECT id, name, stock_quantity AS balance FROM products WHERE tenant_id = p_tenant LOOP
    v_stored := r.balance;
    SELECT recompute_product_stock(r.id) INTO v_computed;
    v_drift := COALESCE(v_stored,0) - COALESCE(v_computed,0);
    v_status := CASE WHEN abs(v_drift) < 0.01 THEN 'ok' WHEN p_auto_fix THEN 'fixed' ELSE 'drift' END;
    IF abs(v_drift) >= 0.01 THEN
      INSERT INTO reconciliation_log(tenant_id, scope, entity_id, entity_label, stored_value, computed_value, drift, status)
      VALUES (p_tenant,'stock', r.id, r.name, v_stored, v_computed, v_drift, v_status);
      scope:='stock'; entity_id:=r.id; entity_label:=r.name;
      stored:=v_stored; computed:=v_computed; drift:=v_drift; status:=v_status;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 7. EXTEND PERIOD LOCK ENFORCEMENT
-- ------------------------------------------------------------------
DO $pl$
DECLARE t text;
  tables text[] := ARRAY['payments','sales_invoices','purchase_invoices','grn_items','expenses','credit_notes','debit_notes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='date') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_period_lock_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_period_lock_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock()', t, t);
    END IF;
  END LOOP;
END $pl$;

-- ------------------------------------------------------------------
-- 8. search_path on remaining SECURITY DEFINER fns
-- ------------------------------------------------------------------
ALTER FUNCTION public.prevent_audit_log_mutation() SET search_path = public;
