
-- ============================================================================
-- 1.1 Mark sandbox tenants
-- ============================================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sandbox_session_id uuid,
  ADD COLUMN IF NOT EXISTS sandbox_created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sandbox_created_at timestamptz;

CREATE INDEX IF NOT EXISTS tenants_parent_idx ON public.tenants(parent_tenant_id) WHERE is_sandbox;

-- ============================================================================
-- 1.3 Per-user sandbox grant
-- ============================================================================
ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS can_use_sandbox boolean NOT NULL DEFAULT false;

-- ============================================================================
-- 1.4 Active-tenant override
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_override uuid; v_raw text;
BEGIN
  BEGIN
    v_raw := current_setting('app.active_tenant', true);
  EXCEPTION WHEN others THEN v_raw := NULL;
  END;

  IF v_raw IS NOT NULL AND length(v_raw) > 0 THEN
    BEGIN v_override := v_raw::uuid; EXCEPTION WHEN others THEN v_override := NULL; END;
  END IF;

  IF v_override IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_users
     WHERE user_id = auth.uid() AND tenant_id = v_override AND is_active
  ) THEN
    RETURN v_override;
  END IF;

  RETURN (
    SELECT tenant_id FROM public.tenant_users
     WHERE user_id = auth.uid() AND is_active
     ORDER BY created_at ASC, tenant_id ASC LIMIT 1
  );
END $$;

CREATE OR REPLACE FUNCTION public.set_active_tenant(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant IS NULL THEN
    PERFORM set_config('app.active_tenant', '', false);
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_users
     WHERE user_id = auth.uid() AND tenant_id = p_tenant AND is_active
  ) THEN
    RAISE EXCEPTION 'You are not a member of tenant %', p_tenant
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM set_config('app.active_tenant', p_tenant::text, false);
END $$;

GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;

-- ============================================================================
-- 1.5 Sandbox helpers
-- ============================================================================

-- Resolve the caller's PROD tenant (always the first non-sandbox one).
CREATE OR REPLACE FUNCTION public.user_prod_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tu.tenant_id
    FROM public.tenant_users tu
    JOIN public.tenants t ON t.id = tu.tenant_id
   WHERE tu.user_id = auth.uid()
     AND tu.is_active
     AND COALESCE(t.is_sandbox, false) = false
   ORDER BY tu.created_at ASC, tu.tenant_id ASC
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.user_prod_tenant_id() TO authenticated;

-- Permission gate.
CREATE OR REPLACE FUNCTION public.sandbox_can_use()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_prod uuid; v_role tenant_role; v_grant boolean;
BEGIN
  v_prod := public.user_prod_tenant_id();
  IF v_prod IS NULL THEN RETURN false; END IF;
  SELECT role, COALESCE(can_use_sandbox,false) INTO v_role, v_grant
    FROM public.tenant_users
   WHERE user_id = auth.uid() AND tenant_id = v_prod AND is_active
   LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN v_role = 'owner' OR v_grant = true;
END $$;

GRANT EXECUTE ON FUNCTION public.sandbox_can_use() TO authenticated;

-- Find caller's existing sandbox (one per prod tenant per user).
CREATE OR REPLACE FUNCTION public.sandbox_current_for_user()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
    FROM public.tenants t
    JOIN public.tenant_users tu ON tu.tenant_id = t.id
   WHERE t.is_sandbox
     AND t.parent_tenant_id = public.user_prod_tenant_id()
     AND t.sandbox_created_by = auth.uid()
     AND tu.user_id = auth.uid() AND tu.is_active
   ORDER BY t.sandbox_created_at DESC NULLS LAST
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.sandbox_current_for_user() TO authenticated;

-- Create a sandbox tenant for the caller (idempotent).
CREATE OR REPLACE FUNCTION public.sandbox_create_session()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_prod uuid;
  v_prod_name text;
  v_sandbox uuid;
  v_session uuid := gen_random_uuid();
BEGIN
  IF NOT public.sandbox_can_use() THEN
    RAISE EXCEPTION 'Not permitted to use sandbox' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_existing := public.sandbox_current_for_user();
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_prod := public.user_prod_tenant_id();
  IF v_prod IS NULL THEN RAISE EXCEPTION 'No production tenant'; END IF;
  SELECT company_name INTO v_prod_name FROM public.tenants WHERE id = v_prod;

  INSERT INTO public.tenants (
    company_name, is_sandbox, parent_tenant_id, sandbox_session_id,
    sandbox_created_by, sandbox_created_at, is_active, max_users
  )
  VALUES (
    COALESCE(v_prod_name,'Workspace') || ' (Sandbox)',
    true, v_prod, v_session, auth.uid(), now(), true, 9999
  )
  RETURNING id INTO v_sandbox;

  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
  VALUES (v_sandbox, auth.uid(), 'owner', true);

  -- Seed a company_settings row so document numbering / settings hooks work.
  INSERT INTO public.company_settings (tenant_id, company_name)
  VALUES (v_sandbox, COALESCE(v_prod_name,'Workspace') || ' Sandbox')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, summary)
  VALUES (v_prod, auth.uid(), 'sandbox.session.created', 'tenant', v_sandbox,
          'Opened sandbox session ' || left(v_session::text, 8));

  RETURN v_sandbox;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN v_sandbox;  -- company_settings / audit_log columns may differ; ignore.
END $$;

GRANT EXECUTE ON FUNCTION public.sandbox_create_session() TO authenticated;

-- Wipe all child rows from a sandbox tenant. Returns counts.
CREATE OR REPLACE FUNCTION public._sandbox_wipe_data(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted jsonb := '{}'::jsonb;
  v_n integer;
  v_tables text[] := ARRAY[
    'journal_lines','journal_entries','credit_note_applications','debit_note_applications',
    'credit_notes','debit_notes','payments','payment_submissions',
    'sales_return_items','sales_returns','purchase_return_items','purchase_returns',
    'sales_invoice_items','warranty_invoices','delivery_notes','sales_invoices',
    'proforma_invoices','purchase_invoices','grn_items','goods_received_notes',
    'purchase_order_items','purchase_orders','purchase_proforma_items','purchase_proformas',
    'additional_costs','print_rejections','print_dispatches','print_deliveries',
    'purchase_print_allocations','print_jobs','agent_commissions','salary_payments',
    'expenses','tax_records','reconciliation_log','stock_movements','stock_audit_log',
    'reorder_alerts','customer_distributors','customer_licenses','customer_products',
    'agent_customers','city_products','supplier_products','drap_registrations',
    'customers','suppliers','sales_agents','staff','freight_providers','printers',
    'products','areas','expense_ledgers','chart_of_accounts','accounting_periods',
    'bank_accounts','document_templates','import_staging_rows','import_batches',
    'sandbox_uat_steps','sandbox_uat_runs','audit_log','document_counters','company_settings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', t) USING p_tenant;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_deleted := v_deleted || jsonb_build_object(t, v_n); END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;
  END LOOP;
  RETURN v_deleted;
END $$;

-- Delete the sandbox tenant entirely.
CREATE OR REPLACE FUNCTION public.sandbox_delete_session(p_sandbox_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod uuid := public.user_prod_tenant_id();
  v_is_sandbox boolean;
  v_parent uuid;
  v_deleted jsonb;
BEGIN
  IF NOT public.sandbox_can_use() THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT is_sandbox, parent_tenant_id INTO v_is_sandbox, v_parent
    FROM public.tenants WHERE id = p_sandbox_tenant;
  IF NOT COALESCE(v_is_sandbox,false) OR v_parent IS DISTINCT FROM v_prod THEN
    RAISE EXCEPTION 'Refusing to delete: target is not a sandbox of your workspace';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sandbox_delete:'||p_sandbox_tenant::text));
  -- Switch caller off the sandbox first.
  PERFORM set_config('app.active_tenant', '', false);

  v_deleted := public._sandbox_wipe_data(p_sandbox_tenant);

  DELETE FROM public.tenant_users WHERE tenant_id = p_sandbox_tenant;
  DELETE FROM public.tenants      WHERE id = p_sandbox_tenant;

  BEGIN
    INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, summary)
    VALUES (v_prod, auth.uid(), 'sandbox.session.deleted', 'tenant', p_sandbox_tenant,
            'Deleted sandbox session');
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN jsonb_build_object('sandbox_tenant', p_sandbox_tenant, 'deleted', v_deleted);
END $$;

GRANT EXECUTE ON FUNCTION public.sandbox_delete_session(uuid) TO authenticated;

-- Rollback: wipe child rows but keep the sandbox tenant.
CREATE OR REPLACE FUNCTION public.sandbox_rollback_session(p_sandbox_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod uuid := public.user_prod_tenant_id();
  v_is_sandbox boolean; v_parent uuid; v_deleted jsonb;
BEGIN
  IF NOT public.sandbox_can_use() THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT is_sandbox, parent_tenant_id INTO v_is_sandbox, v_parent
    FROM public.tenants WHERE id = p_sandbox_tenant;
  IF NOT COALESCE(v_is_sandbox,false) OR v_parent IS DISTINCT FROM v_prod THEN
    RAISE EXCEPTION 'Refusing to rollback: target is not a sandbox of your workspace';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sandbox_rb:'||p_sandbox_tenant::text));
  v_deleted := public._sandbox_wipe_data(p_sandbox_tenant);

  BEGIN
    INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, summary)
    VALUES (v_prod, auth.uid(), 'sandbox.session.rolled_back', 'tenant', p_sandbox_tenant,
            'Rolled back sandbox session');
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN jsonb_build_object('sandbox_tenant', p_sandbox_tenant, 'deleted', v_deleted);
END $$;

GRANT EXECUTE ON FUNCTION public.sandbox_rollback_session(uuid) TO authenticated;

-- Lightweight summary the UI polls.
CREATE OR REPLACE FUNCTION public.sandbox_session_info()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sandbox uuid := public.sandbox_current_for_user();
  v_prod uuid := public.user_prod_tenant_id();
  v_session uuid; v_created timestamptz; v_by uuid;
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  IF v_sandbox IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'can_use', public.sandbox_can_use(),
      'prod_tenant_id', v_prod
    );
  END IF;
  SELECT sandbox_session_id, sandbox_created_at, sandbox_created_by
    INTO v_session, v_created, v_by FROM public.tenants WHERE id = v_sandbox;

  FOR v_n IN
    SELECT (SELECT count(*) FROM public.customers       WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.products        WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.proforma_invoices WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.sales_invoices  WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.delivery_notes  WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.payments        WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.suppliers       WHERE tenant_id = v_sandbox) UNION ALL
    SELECT (SELECT count(*) FROM public.grn_items       WHERE tenant_id = v_sandbox)
  LOOP NULL; END LOOP;

  SELECT jsonb_build_object(
    'customers',       (SELECT count(*) FROM public.customers       WHERE tenant_id = v_sandbox),
    'suppliers',       (SELECT count(*) FROM public.suppliers       WHERE tenant_id = v_sandbox),
    'products',        (SELECT count(*) FROM public.products        WHERE tenant_id = v_sandbox),
    'batches',         (SELECT count(*) FROM public.grn_items       WHERE tenant_id = v_sandbox),
    'sales_orders',    (SELECT count(*) FROM public.proforma_invoices WHERE tenant_id = v_sandbox),
    'sales_invoices',  (SELECT count(*) FROM public.sales_invoices  WHERE tenant_id = v_sandbox),
    'delivery_notes',  (SELECT count(*) FROM public.delivery_notes  WHERE tenant_id = v_sandbox),
    'payments',        (SELECT count(*) FROM public.payments        WHERE tenant_id = v_sandbox)
  ) INTO v_counts;

  RETURN jsonb_build_object(
    'exists', true,
    'can_use', true,
    'prod_tenant_id', v_prod,
    'sandbox_tenant_id', v_sandbox,
    'session_id', v_session,
    'created_at', v_created,
    'created_by', v_by,
    'counts', v_counts
  );
END $$;

GRANT EXECUTE ON FUNCTION public.sandbox_session_info() TO authenticated;

-- ============================================================================
-- UAT run tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sandbox_uat_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_user_tenant_id(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  triggered_by uuid REFERENCES auth.users(id),
  summary jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_uat_runs TO authenticated;
GRANT ALL ON public.sandbox_uat_runs TO service_role;
ALTER TABLE public.sandbox_uat_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uat_runs_tenant ON public.sandbox_uat_runs;
CREATE POLICY uat_runs_tenant ON public.sandbox_uat_runs FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active));

CREATE TABLE IF NOT EXISTS public.sandbox_uat_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_user_tenant_id(),
  run_id uuid NOT NULL REFERENCES public.sandbox_uat_runs(id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  step_name text NOT NULL,
  status text NOT NULL,
  latency_ms integer,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_uat_steps TO authenticated;
GRANT ALL ON public.sandbox_uat_steps TO service_role;
ALTER TABLE public.sandbox_uat_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uat_steps_tenant ON public.sandbox_uat_steps;
CREATE POLICY uat_steps_tenant ON public.sandbox_uat_steps FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active));

CREATE INDEX IF NOT EXISTS sandbox_uat_steps_run_idx ON public.sandbox_uat_steps(run_id, step_no);
CREATE INDEX IF NOT EXISTS sandbox_uat_runs_tenant_idx ON public.sandbox_uat_runs(tenant_id, started_at DESC);
