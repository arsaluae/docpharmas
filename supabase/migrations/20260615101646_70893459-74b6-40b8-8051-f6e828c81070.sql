
CREATE OR REPLACE FUNCTION public.merge_suppliers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can merge suppliers';
  END IF;
  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates,1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;
  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;
  PERFORM 1 FROM public.suppliers WHERE id = p_master AND tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master supplier not found in this tenant'; END IF;
  PERFORM 1 FROM public.suppliers WHERE id = ANY(p_duplicates) AND tenant_id <> v_tenant LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Duplicate suppliers must all belong to the current tenant'; END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    INSERT INTO public.supplier_aliases(tenant_id, master_id, old_id, old_supplier_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, s.id, s.supplier_code, s.name, s.normalized_name, p_reason, v_user
    FROM public.suppliers s WHERE s.id = v_dup;

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
    UPDATE public.additional_costs SET vendor_id = p_master WHERE vendor_id = v_dup;
    UPDATE public.payments SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;
    UPDATE public.credit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;
    UPDATE public.debit_notes SET party_id = p_master WHERE party_type = 'supplier' AND party_id = v_dup;

    UPDATE public.suppliers m
       SET balance = coalesce(m.balance,0) + coalesce(d.balance,0),
           opening_balance = coalesce(m.opening_balance,0) + coalesce(d.opening_balance,0),
           updated_at = now()
      FROM public.suppliers d
     WHERE m.id = p_master AND d.id = v_dup;

    UPDATE public.suppliers
       SET is_merged = true, is_active = false, merged_into_id = p_master,
           merged_at = now(), merged_by = v_user, merge_reason = p_reason,
           balance = 0, opening_balance = 0
     WHERE id = v_dup;

    BEGIN
      INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_tenant, v_user, 'supplier', v_dup, 'merged',
              jsonb_build_object('merged_into', p_master, 'reason', p_reason));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('master', p_master, 'duplicates_merged', array_length(p_duplicates,1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_customers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can merge customers';
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
       SET is_merged = true, is_active = false, merged_into_id = p_master,
           merged_at = now(), merged_by = v_user, merge_reason = p_reason,
           balance = 0, opening_balance = 0
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
$function$;

CREATE OR REPLACE FUNCTION public.unmerge_supplier(p_old_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can unmerge suppliers';
  END IF;
  SELECT master_id INTO v_master
    FROM public.supplier_aliases
   WHERE old_id = p_old_id AND tenant_id = v_tenant AND reversible_until > now()
   ORDER BY merged_at DESC LIMIT 1;
  IF v_master IS NULL THEN
    RAISE EXCEPTION 'No reversible merge found for this supplier (older than 7 days or never merged).';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.unmerge_customer(p_old_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_master uuid;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can unmerge customers';
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
$function$;
