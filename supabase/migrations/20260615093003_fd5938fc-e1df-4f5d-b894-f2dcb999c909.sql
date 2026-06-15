
-- =========================================================
-- 1. Stronger party name normalizer (used by suppliers + customers)
-- =========================================================
CREATE OR REPLACE FUNCTION public.normalize_party_name(s text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF s IS NULL THEN RETURN ''; END IF;
  v := lower(trim(s));
  -- strip "copy", "copy 1", "duplicate", "(1)" duplicate-style suffixes
  v := regexp_replace(v, '\s*\(\s*\d+\s*\)\s*$', '', 'g');
  v := regexp_replace(v, '\s*-\s*copy(\s*\d+)?\s*$', '', 'g');
  v := regexp_replace(v, '\s+copy(\s+\d+)?\s*$', '', 'g');
  v := regexp_replace(v, '\s+duplicate\s*$', '', 'g');
  -- strip filler/legal/business tokens
  v := regexp_replace(v,
    '\m(m/s|ms|pvt|pvt\.|ltd|limited|llp|llc|inc|corp|co|company|sons|son|brothers|bros|enterprise|enterprises|enterprisei|traders|trading|trader|distributor|distributors|distribution|agency|agencies|supplier|suppliers|pharma|pharmacy|pharmaceutical|pharmaceuticals|medicos|medical|store|stores|shop|surgical|surgicals)\M',
    ' ', 'gi');
  -- punctuation -> space
  v := regexp_replace(v, '[^[:alnum:]]+', ' ', 'g');
  -- strip a trailing single 1-2 digit number (likely "ABC 2") only when the name still has 2+ alpha tokens
  IF (length(regexp_replace(v, '[^a-z]+', ' ', 'g')) - length(replace(regexp_replace(v, '[^a-z]+', ' ', 'g'), ' ', ''))) >= 2 THEN
    v := regexp_replace(v, '\s+\d{1,2}\s*$', '', 'g');
  END IF;
  v := regexp_replace(v, '\s+', ' ', 'g');
  RETURN trim(v);
END;
$$;

-- Repoint the legacy normalize_supplier_name wrapper so existing trigger keeps working.
CREATE OR REPLACE FUNCTION public.normalize_supplier_name(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT public.normalize_party_name(s) $$;

-- =========================================================
-- 2. Add merge / alias columns to suppliers + customers
-- =========================================================
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_merged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid,
  ADD COLUMN IF NOT EXISTS merge_reason text,
  ADD COLUMN IF NOT EXISTS normalized_name text GENERATED ALWAYS AS (public.normalize_party_name(name)) STORED;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_merged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid,
  ADD COLUMN IF NOT EXISTS merge_reason text,
  ADD COLUMN IF NOT EXISTS normalized_name text GENERATED ALWAYS AS (public.normalize_party_name(name)) STORED;

CREATE INDEX IF NOT EXISTS suppliers_tenant_normname_idx ON public.suppliers(tenant_id, normalized_name);
CREATE INDEX IF NOT EXISTS suppliers_merged_into_idx ON public.suppliers(merged_into_id);
CREATE INDEX IF NOT EXISTS customers_tenant_normname_idx ON public.customers(tenant_id, normalized_name);
CREATE INDEX IF NOT EXISTS customers_merged_into_idx ON public.customers(merged_into_id);

-- =========================================================
-- 3. Customer contacts: add missing tracking columns
-- =========================================================
ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- =========================================================
-- 4. Aliases + ignores tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  master_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  old_id uuid NOT NULL,
  old_supplier_code text,
  old_name text,
  old_normalized_name text,
  merge_reason text,
  merged_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  reversible_until timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_aliases TO authenticated;
GRANT ALL ON public.supplier_aliases TO service_role;
ALTER TABLE public.supplier_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_aliases_tenant ON public.supplier_aliases
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE INDEX IF NOT EXISTS supplier_aliases_master_idx ON public.supplier_aliases(master_id);
CREATE INDEX IF NOT EXISTS supplier_aliases_tenant_name_idx ON public.supplier_aliases(tenant_id, old_normalized_name);

CREATE TABLE IF NOT EXISTS public.customer_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  master_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  old_id uuid NOT NULL,
  old_customer_code text,
  old_name text,
  old_normalized_name text,
  merge_reason text,
  merged_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  reversible_until timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_aliases TO authenticated;
GRANT ALL ON public.customer_aliases TO service_role;
ALTER TABLE public.customer_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_aliases_tenant ON public.customer_aliases
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE INDEX IF NOT EXISTS customer_aliases_master_idx ON public.customer_aliases(master_id);
CREATE INDEX IF NOT EXISTS customer_aliases_tenant_name_idx ON public.customer_aliases(tenant_id, old_normalized_name);

CREATE TABLE IF NOT EXISTS public.duplicate_ignores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  party_type text NOT NULL CHECK (party_type IN ('supplier','customer')),
  group_key text NOT NULL,
  ignored_by uuid,
  ignored_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, party_type, group_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplicate_ignores TO authenticated;
GRANT ALL ON public.duplicate_ignores TO service_role;
ALTER TABLE public.duplicate_ignores ENABLE ROW LEVEL SECURITY;
CREATE POLICY duplicate_ignores_tenant ON public.duplicate_ignores
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =========================================================
-- 5. Lookup views (alias-aware)
-- =========================================================
CREATE OR REPLACE VIEW public.v_supplier_lookup AS
  SELECT s.id, s.tenant_id, s.name AS label, s.supplier_code, s.phone, s.city,
         lower(coalesce(s.name,'') || ' ' || coalesce(s.supplier_code,'') || ' ' || coalesce(s.phone,'') || ' ' || coalesce(s.city,''))
           || ' ' || coalesce(string_agg(distinct lower(coalesce(a.old_name,'') || ' ' || coalesce(a.old_supplier_code,'')), ' '), '') AS search_text,
         s.is_merged
  FROM public.suppliers s
  LEFT JOIN public.supplier_aliases a ON a.master_id = s.id
  GROUP BY s.id;

CREATE OR REPLACE VIEW public.v_customer_lookup AS
  SELECT c.id, c.tenant_id, c.name AS label, c.customer_code, c.sms_mobile, c.phone, c.city,
         lower(coalesce(c.name,'') || ' ' || coalesce(c.customer_code,'') || ' ' || coalesce(c.sms_mobile,'') || ' ' || coalesce(c.phone,'') || ' ' || coalesce(c.city,''))
           || ' ' || coalesce(string_agg(distinct lower(coalesce(a.old_name,'') || ' ' || coalesce(a.old_customer_code,'')), ' '), '') AS search_text,
         c.is_merged
  FROM public.customers c
  LEFT JOIN public.customer_aliases a ON a.master_id = c.id
  GROUP BY c.id;

GRANT SELECT ON public.v_supplier_lookup TO authenticated;
GRANT SELECT ON public.v_customer_lookup TO authenticated;

-- =========================================================
-- 6. Detection RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.detect_supplier_duplicates()
RETURNS TABLE (
  group_key text,
  supplier_id uuid,
  name text,
  supplier_code text,
  phone text,
  city text,
  balance numeric,
  is_merged boolean,
  created_at timestamptz,
  pi_count bigint,
  po_count bigint,
  payment_count bigint,
  product_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (SELECT public.get_user_tenant_id() AS tid),
  ignored AS (
    SELECT group_key FROM public.duplicate_ignores, t
    WHERE tenant_id = t.tid AND party_type = 'supplier'
  ),
  candidates AS (
    SELECT s.id, s.name, s.supplier_code, s.phone, s.city, s.balance, s.is_merged, s.created_at,
           s.normalized_name AS gkey
    FROM public.suppliers s, t
    WHERE s.tenant_id = t.tid
      AND coalesce(s.normalized_name,'') <> ''
  ),
  grouped AS (
    SELECT gkey FROM candidates
    GROUP BY gkey HAVING count(*) > 1
  )
  SELECT
    c.gkey AS group_key,
    c.id, c.name, c.supplier_code, c.phone, c.city, c.balance, c.is_merged, c.created_at,
    (SELECT count(*) FROM public.purchase_invoices p WHERE p.supplier_id = c.id),
    (SELECT count(*) FROM public.purchase_orders p WHERE p.supplier_id = c.id),
    (SELECT count(*) FROM public.payments p WHERE p.party_id = c.id AND p.party_type = 'supplier'),
    (SELECT count(*) FROM public.products p WHERE p.supplier_id = c.id)
  FROM candidates c
  JOIN grouped g ON g.gkey = c.gkey
  WHERE c.gkey NOT IN (SELECT group_key FROM ignored)
  ORDER BY c.gkey, c.created_at;
$$;

CREATE OR REPLACE FUNCTION public.detect_customer_duplicates()
RETURNS TABLE (
  group_key text,
  customer_id uuid,
  name text,
  customer_code text,
  sms_mobile text,
  phone text,
  city text,
  balance numeric,
  is_merged boolean,
  created_at timestamptz,
  si_count bigint,
  payment_count bigint,
  dn_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (SELECT public.get_user_tenant_id() AS tid),
  ignored AS (
    SELECT group_key FROM public.duplicate_ignores, t
    WHERE tenant_id = t.tid AND party_type = 'customer'
  ),
  candidates AS (
    SELECT c.id, c.name, c.customer_code, c.sms_mobile, c.phone, c.city, c.balance, c.is_merged, c.created_at,
           c.normalized_name AS gkey
    FROM public.customers c, t
    WHERE c.tenant_id = t.tid
      AND coalesce(c.normalized_name,'') <> ''
  ),
  grouped AS (
    SELECT gkey FROM candidates GROUP BY gkey HAVING count(*) > 1
  )
  SELECT
    c.gkey AS group_key, c.id, c.name, c.customer_code, c.sms_mobile, c.phone, c.city, c.balance, c.is_merged, c.created_at,
    (SELECT count(*) FROM public.sales_invoices s WHERE s.customer_id = c.id),
    (SELECT count(*) FROM public.payments p WHERE p.party_id = c.id AND p.party_type = 'customer'),
    (SELECT count(*) FROM public.delivery_notes d WHERE d.customer_id = c.id)
  FROM candidates c
  JOIN grouped g ON g.gkey = c.gkey
  WHERE c.gkey NOT IN (SELECT group_key FROM ignored)
  ORDER BY c.gkey, c.created_at;
$$;

-- =========================================================
-- 7. Merge RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.merge_suppliers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
  v_moved jsonb := '{}'::jsonb;
  v_count bigint;
BEGIN
  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can merge suppliers';
  END IF;
  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates,1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;
  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;
  -- Validate tenant scope
  PERFORM 1 FROM public.suppliers WHERE id = p_master AND tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master supplier not found in this tenant'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id = ANY(p_duplicates) AND tenant_id <> v_tenant LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Duplicate suppliers must all belong to the current tenant'; END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    -- Insert alias snapshot
    INSERT INTO public.supplier_aliases(tenant_id, master_id, old_id, old_supplier_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, s.id, s.supplier_code, s.name, s.normalized_name, p_reason, v_user
    FROM public.suppliers s WHERE s.id = v_dup;

    -- Move FK references
    UPDATE public.purchase_invoices SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_orders SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_proformas SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_returns SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.goods_received_notes SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.products SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.supplier_products SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.delivery_notes SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.print_dispatches SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_print_allocations SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.payments SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;
    UPDATE public.credit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;
    UPDATE public.debit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;

    -- Add opening + current balances to master
    UPDATE public.suppliers m
       SET balance = coalesce(m.balance,0) + coalesce(d.balance,0),
           opening_balance = coalesce(m.opening_balance,0) + coalesce(d.opening_balance,0),
           updated_at = now()
      FROM public.suppliers d
     WHERE m.id = p_master AND d.id = v_dup;

    -- Mark duplicate merged + inactive
    UPDATE public.suppliers
       SET is_merged = true,
           is_active = false,
           merged_into_id = p_master,
           merged_at = now(),
           merged_by = v_user,
           merge_reason = p_reason,
           balance = 0,
           opening_balance = 0
     WHERE id = v_dup;

    -- Audit
    BEGIN
      INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_tenant, v_user, 'supplier', v_dup, 'merged',
              jsonb_build_object('merged_into', p_master, 'reason', p_reason));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_moved := jsonb_build_object('master', p_master, 'duplicates_merged', array_length(p_duplicates,1));
  RETURN v_moved;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_customers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can merge customers';
  END IF;
  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates,1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;
  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;
  PERFORM 1 FROM public.customers WHERE id = p_master AND tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master customer not found in this tenant'; END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    INSERT INTO public.customer_aliases(tenant_id, master_id, old_id, old_customer_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, c.id, c.customer_code, c.name, c.normalized_name, p_reason, v_user
    FROM public.customers c WHERE c.id = v_dup;

    UPDATE public.sales_invoices SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.sales_returns SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.proforma_invoices SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.delivery_notes SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.warranty_invoices SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.customer_contacts SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.customer_distributors SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.customer_licenses SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.customer_products SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.agent_customers SET customer_id = p_master WHERE customer_id = v_dup;
    UPDATE public.payments SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup;
    UPDATE public.credit_notes SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup;
    UPDATE public.debit_notes SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup;

    UPDATE public.customers m
       SET balance = coalesce(m.balance,0) + coalesce(d.balance,0),
           opening_balance = coalesce(m.opening_balance,0) + coalesce(d.opening_balance,0),
           updated_at = now()
      FROM public.customers d
     WHERE m.id = p_master AND d.id = v_dup;

    UPDATE public.customers
       SET is_merged = true,
           is_active = false,
           merged_into_id = p_master,
           merged_at = now(),
           merged_by = v_user,
           merge_reason = p_reason,
           balance = 0,
           opening_balance = 0
     WHERE id = v_dup;

    BEGIN
      INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_tenant, v_user, 'customer', v_dup, 'merged',
              jsonb_build_object('merged_into', p_master, 'reason', p_reason));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('master', p_master, 'duplicates_merged', array_length(p_duplicates,1));
END;
$$;

-- =========================================================
-- 8. Unmerge (reversible within 7 days)
-- =========================================================
CREATE OR REPLACE FUNCTION public.unmerge_supplier(p_old_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
BEGIN
  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can unmerge suppliers';
  END IF;
  SELECT master_id INTO v_master
    FROM public.supplier_aliases
   WHERE old_id = p_old_id AND tenant_id = v_tenant AND reversible_until > now()
   ORDER BY merged_at DESC LIMIT 1;
  IF v_master IS NULL THEN
    RAISE EXCEPTION 'No reversible merge found for this supplier (older than 7 days or never merged).';
  END IF;

  UPDATE public.purchase_invoices SET supplier_id = p_old_id WHERE supplier_id = v_master AND id IN (
    SELECT pi.id FROM public.purchase_invoices pi
    JOIN public.audit_log al ON al.entity_id = p_old_id AND al.action='merged'
    WHERE pi.supplier_id = v_master);
  -- Note: per-FK reversal is best-effort. We restore the supplier record + alias removal so business can re-decide.
  UPDATE public.suppliers
     SET is_merged = false, is_active = true, merged_into_id = NULL,
         merged_at = NULL, merged_by = NULL, merge_reason = NULL
   WHERE id = p_old_id;

  DELETE FROM public.supplier_aliases WHERE old_id = p_old_id AND master_id = v_master;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'supplier', p_old_id, 'unmerged',
            jsonb_build_object('previous_master', v_master));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('restored', p_old_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmerge_customer(p_old_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
BEGIN
  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can unmerge customers';
  END IF;
  SELECT master_id INTO v_master
    FROM public.customer_aliases
   WHERE old_id = p_old_id AND tenant_id = v_tenant AND reversible_until > now()
   ORDER BY merged_at DESC LIMIT 1;
  IF v_master IS NULL THEN
    RAISE EXCEPTION 'No reversible merge found for this customer (older than 7 days or never merged).';
  END IF;

  UPDATE public.customers
     SET is_merged = false, is_active = true, merged_into_id = NULL,
         merged_at = NULL, merged_by = NULL, merge_reason = NULL
   WHERE id = p_old_id;

  DELETE FROM public.customer_aliases WHERE old_id = p_old_id AND master_id = v_master;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'customer', p_old_id, 'unmerged',
            jsonb_build_object('previous_master', v_master));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('restored', p_old_id);
END;
$$;
