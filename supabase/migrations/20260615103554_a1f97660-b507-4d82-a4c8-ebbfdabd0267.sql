CREATE OR REPLACE FUNCTION public.merge_suppliers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can merge suppliers';
  END IF;

  IF v_tenant IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated tenant context is required';
  END IF;

  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates, 1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;

  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;

  PERFORM 1
  FROM public.suppliers
  WHERE id = p_master
    AND tenant_id = v_tenant
    AND coalesce(is_merged, false) = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master supplier not found in this tenant';
  END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    PERFORM 1
    FROM public.suppliers
    WHERE id = v_dup
      AND tenant_id = v_tenant
      AND coalesce(is_merged, false) = false;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Duplicate supplier % not found in this tenant', v_dup;
    END IF;

    INSERT INTO public.supplier_aliases(tenant_id, master_id, old_id, old_supplier_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, s.id, s.supplier_code, s.name, s.normalized_name, p_reason, v_user
    FROM public.suppliers s
    WHERE s.id = v_dup
      AND s.tenant_id = v_tenant;

    UPDATE public.purchase_invoices SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.purchase_orders SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.purchase_returns SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.purchase_proformas SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.goods_received_notes SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.additional_costs SET vendor_id = p_master WHERE vendor_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.purchase_print_allocations SET supplier_id = p_master WHERE supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.print_jobs SET allotted_supplier_id = p_master WHERE allotted_supplier_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.payments SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.credit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.debit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup AND tenant_id = v_tenant;

    DELETE FROM public.supplier_products sp
    WHERE sp.supplier_id = v_dup
      AND sp.tenant_id = v_tenant
      AND EXISTS (
        SELECT 1
        FROM public.supplier_products master_sp
        WHERE master_sp.supplier_id = p_master
          AND master_sp.product_id = sp.product_id
          AND master_sp.tenant_id = v_tenant
      );

    UPDATE public.supplier_products
    SET supplier_id = p_master
    WHERE supplier_id = v_dup
      AND tenant_id = v_tenant;

    UPDATE public.suppliers m
       SET balance = coalesce(m.balance, 0) + coalesce(d.balance, 0),
           opening_balance = coalesce(m.opening_balance, 0) + coalesce(d.opening_balance, 0)
      FROM public.suppliers d
     WHERE m.id = p_master
       AND m.tenant_id = v_tenant
       AND d.id = v_dup
       AND d.tenant_id = v_tenant;

    UPDATE public.suppliers
       SET is_merged = true,
           is_active = false,
           merged_into_id = p_master,
           merged_at = now(),
           merged_by = v_user,
           merge_reason = p_reason,
           balance = 0,
           opening_balance = 0
     WHERE id = v_dup
       AND tenant_id = v_tenant;

    BEGIN
      INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_tenant, v_user, 'supplier', v_dup, 'merged', jsonb_build_object('merged_into', p_master, 'reason', p_reason));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('master', p_master, 'duplicates_merged', array_length(p_duplicates, 1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_customers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can merge customers';
  END IF;

  IF v_tenant IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated tenant context is required';
  END IF;

  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates, 1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;

  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;

  PERFORM 1
  FROM public.customers
  WHERE id = p_master
    AND tenant_id = v_tenant
    AND coalesce(is_merged, false) = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master customer not found in this tenant';
  END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    PERFORM 1
    FROM public.customers
    WHERE id = v_dup
      AND tenant_id = v_tenant
      AND coalesce(is_merged, false) = false;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Duplicate customer % not found in this tenant', v_dup;
    END IF;

    INSERT INTO public.customer_aliases(tenant_id, master_id, old_id, old_customer_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, c.id, c.customer_code, c.name, c.normalized_name, p_reason, v_user
    FROM public.customers c
    WHERE c.id = v_dup
      AND c.tenant_id = v_tenant;

    UPDATE public.sales_invoices SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.sales_returns SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.proforma_invoices SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.delivery_notes SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.warranty_invoices SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.customer_contacts SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.customer_distributors SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.customer_licenses SET customer_id = p_master WHERE customer_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.payments SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.credit_notes SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup AND tenant_id = v_tenant;
    UPDATE public.debit_notes SET party_id = p_master WHERE party_type = 'customer' AND party_id = v_dup AND tenant_id = v_tenant;

    DELETE FROM public.customer_products cp
    WHERE cp.customer_id = v_dup
      AND cp.tenant_id = v_tenant
      AND EXISTS (
        SELECT 1
        FROM public.customer_products master_cp
        WHERE master_cp.customer_id = p_master
          AND master_cp.product_id = cp.product_id
          AND master_cp.tenant_id = v_tenant
      );

    UPDATE public.customer_products
    SET customer_id = p_master
    WHERE customer_id = v_dup
      AND tenant_id = v_tenant;

    DELETE FROM public.agent_customers ac
    WHERE ac.customer_id = v_dup
      AND ac.tenant_id = v_tenant
      AND EXISTS (
        SELECT 1
        FROM public.agent_customers master_ac
        WHERE master_ac.customer_id = p_master
          AND master_ac.agent_id = ac.agent_id
          AND master_ac.tenant_id = v_tenant
      );

    UPDATE public.agent_customers
    SET customer_id = p_master
    WHERE customer_id = v_dup
      AND tenant_id = v_tenant;

    UPDATE public.customers m
       SET balance = coalesce(m.balance, 0) + coalesce(d.balance, 0),
           opening_balance = coalesce(m.opening_balance, 0) + coalesce(d.opening_balance, 0)
      FROM public.customers d
     WHERE m.id = p_master
       AND m.tenant_id = v_tenant
       AND d.id = v_dup
       AND d.tenant_id = v_tenant;

    UPDATE public.customers
       SET is_merged = true,
           is_active = false,
           merged_into_id = p_master,
           merged_at = now(),
           merged_by = v_user,
           merge_reason = p_reason,
           balance = 0,
           opening_balance = 0
     WHERE id = v_dup
       AND tenant_id = v_tenant;

    BEGIN
      INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_tenant, v_user, 'customer', v_dup, 'merged', jsonb_build_object('merged_into', p_master, 'reason', p_reason));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('master', p_master, 'duplicates_merged', array_length(p_duplicates, 1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.unmerge_supplier(p_duplicate uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
  v_alias record;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can unmerge suppliers';
  END IF;

  IF v_tenant IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated tenant context is required';
  END IF;

  SELECT * INTO v_alias
  FROM public.supplier_aliases
  WHERE old_id = p_duplicate
    AND tenant_id = v_tenant
    AND reversible_until > now()
  ORDER BY merged_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reversible merge found for this supplier';
  END IF;

  v_master := v_alias.master_id;

  UPDATE public.suppliers
     SET is_merged = false,
         is_active = true,
         merged_into_id = NULL,
         merged_at = NULL,
         merged_by = NULL,
         merge_reason = NULL
   WHERE id = p_duplicate
     AND tenant_id = v_tenant;

  DELETE FROM public.supplier_aliases
  WHERE id = v_alias.id
    AND tenant_id = v_tenant;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'supplier', p_duplicate, 'unmerged', jsonb_build_object('was_merged_into', v_master));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('restored', p_duplicate, 'from_master', v_master);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unmerge_customer(p_duplicate uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
  v_alias record;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can unmerge customers';
  END IF;

  IF v_tenant IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated tenant context is required';
  END IF;

  SELECT * INTO v_alias
  FROM public.customer_aliases
  WHERE old_id = p_duplicate
    AND tenant_id = v_tenant
    AND reversible_until > now()
  ORDER BY merged_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reversible merge found for this customer';
  END IF;

  v_master := v_alias.master_id;

  UPDATE public.customers
     SET is_merged = false,
         is_active = true,
         merged_into_id = NULL,
         merged_at = NULL,
         merged_by = NULL,
         merge_reason = NULL
   WHERE id = p_duplicate
     AND tenant_id = v_tenant;

  DELETE FROM public.customer_aliases
  WHERE id = v_alias.id
    AND tenant_id = v_tenant;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'customer', p_duplicate, 'unmerged', jsonb_build_object('was_merged_into', v_master));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('restored', p_duplicate, 'from_master', v_master);
END;
$function$;