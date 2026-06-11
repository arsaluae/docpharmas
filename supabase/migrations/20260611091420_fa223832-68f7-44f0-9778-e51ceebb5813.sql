
-- Tenant-aware doc number generator (for backfill loops where auth.uid() isn't set)
CREATE OR REPLACE FUNCTION public.generate_document_number_for_tenant(p_document_type text, p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text; v_next integer; v_default_prefix text;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id required'; END IF;

  UPDATE document_counters SET current_value = current_value + 1
   WHERE document_type = p_document_type AND tenant_id = p_tenant_id
  RETURNING prefix, current_value INTO v_prefix, v_next;

  IF NOT FOUND THEN
    v_default_prefix := CASE p_document_type
      WHEN 'supplier' THEN 'SUP-' WHEN 'customer' THEN 'CUS-' WHEN 'product' THEN 'PRD-'
      ELSE NULL END;
    IF v_default_prefix IS NULL THEN RAISE EXCEPTION 'Unknown document type: %', p_document_type; END IF;
    INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
    VALUES (p_tenant_id, p_document_type, v_default_prefix, 1)
    ON CONFLICT (tenant_id, document_type) DO UPDATE SET current_value = document_counters.current_value + 1
    RETURNING prefix, current_value INTO v_prefix, v_next;
  END IF;

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END $$;

-- Backfill customers
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id, tenant_id FROM public.customers
           WHERE customer_code IS NULL AND tenant_id IS NOT NULL
           ORDER BY tenant_id, created_at LOOP
    UPDATE public.customers
       SET customer_code = public.generate_document_number_for_tenant('customer', r.tenant_id)
     WHERE id = r.id;
  END LOOP;
END $$;

-- Backfill suppliers
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id, tenant_id FROM public.suppliers
           WHERE supplier_code IS NULL AND tenant_id IS NOT NULL
           ORDER BY tenant_id, created_at LOOP
    UPDATE public.suppliers
       SET supplier_code = public.generate_document_number_for_tenant('supplier', r.tenant_id)
     WHERE id = r.id;
  END LOOP;
END $$;

-- Auto-fill triggers
CREATE OR REPLACE FUNCTION public.auto_set_customer_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := public.generate_document_number_for_tenant(
      'customer', COALESCE(NEW.tenant_id, public.get_user_tenant_id()));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.auto_set_supplier_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.supplier_code IS NULL THEN
    NEW.supplier_code := public.generate_document_number_for_tenant(
      'supplier', COALESCE(NEW.tenant_id, public.get_user_tenant_id()));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_customer_code ON public.customers;
CREATE TRIGGER trg_auto_customer_code BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.auto_set_customer_code();

DROP TRIGGER IF EXISTS trg_auto_supplier_code ON public.suppliers;
CREATE TRIGGER trg_auto_supplier_code BEFORE INSERT ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.auto_set_supplier_code();

-- Summary RPCs (tenant-wide aggregates)
CREATE OR REPLACE FUNCTION public.customers_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.get_user_tenant_id();
BEGIN
  RETURN (SELECT jsonb_build_object(
    'total', count(*),
    'receivables', COALESCE(SUM(GREATEST(balance,0)),0),
    'credit_limit', COALESCE(SUM(credit_limit),0),
    'over_limit', COUNT(*) FILTER (WHERE credit_limit > 0 AND balance > credit_limit)
  ) FROM customers WHERE tenant_id = v_t AND is_active = true);
END $$;

CREATE OR REPLACE FUNCTION public.suppliers_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.get_user_tenant_id();
BEGIN
  RETURN (SELECT jsonb_build_object(
    'total', count(*),
    'payables', COALESCE(SUM(GREATEST(balance,0)),0),
    'with_balance', COUNT(*) FILTER (WHERE balance > 0),
    'avg_terms', COALESCE(ROUND(AVG(payment_terms_days)),0)
  ) FROM suppliers WHERE tenant_id = v_t AND is_active = true);
END $$;

CREATE OR REPLACE FUNCTION public.customers_cities()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT city ORDER BY city) FILTER (WHERE city IS NOT NULL AND city <> ''), ARRAY[]::text[])
  FROM customers WHERE tenant_id = public.get_user_tenant_id();
$$;

CREATE OR REPLACE FUNCTION public.suppliers_cities()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT city ORDER BY city) FILTER (WHERE city IS NOT NULL AND city <> ''), ARRAY[]::text[])
  FROM suppliers WHERE tenant_id = public.get_user_tenant_id();
$$;

GRANT EXECUTE ON FUNCTION public.customers_summary(), public.suppliers_summary(),
                          public.customers_cities(), public.suppliers_cities(),
                          public.generate_document_number_for_tenant(text, uuid)
TO authenticated;
