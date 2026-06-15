
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND role::text = 'owner'
      AND coalesce(is_active, true) = true
  )
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT tu.user_id, 'admin'::public.app_role
FROM public.tenant_users tu
WHERE tu.role::text = 'owner' AND coalesce(tu.is_active, true) = true
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_owner_admin_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role::text = 'owner' AND coalesce(NEW.is_active, true) = true THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_owner_admin_role ON public.tenant_users;
CREATE TRIGGER trg_sync_owner_admin_role
AFTER INSERT OR UPDATE OF role, is_active ON public.tenant_users
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_admin_role();

-- Drop unmerge functions so we can change parameter name
DROP FUNCTION IF EXISTS public.unmerge_supplier(uuid);
DROP FUNCTION IF EXISTS public.unmerge_customer(uuid);

CREATE OR REPLACE FUNCTION public.merge_suppliers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can merge suppliers';
  END IF;
  IF p_master IS NULL OR p_duplicates IS NULL OR array_length(p_duplicates,1) IS NULL THEN
    RAISE EXCEPTION 'Master and duplicates are required';
  END IF;
  IF p_master = ANY(p_duplicates) THEN
    RAISE EXCEPTION 'Master cannot be in the duplicates list';
  END IF;
  PERFORM 1 FROM public.suppliers WHERE id = p_master AND tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master supplier not found in this tenant'; END IF;

  FOREACH v_dup IN ARRAY p_duplicates LOOP
    INSERT INTO public.supplier_aliases(tenant_id, master_id, old_id, old_supplier_code, old_name, old_normalized_name, merge_reason, merged_by)
    SELECT v_tenant, p_master, s.id, s.supplier_code, s.name, s.normalized_name, p_reason, v_user
    FROM public.suppliers s WHERE s.id = v_dup;

    UPDATE public.purchase_invoices SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_orders SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_returns SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.purchase_proformas SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.goods_received_notes SET supplier_id = p_master WHERE supplier_id = v_dup;
    UPDATE public.supplier_products SET supplier_id = p_master WHERE supplier_id = v_dup;
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

CREATE OR REPLACE FUNCTION public.merge_customers(p_master uuid, p_duplicates uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_tenant uuid := public.get_user_tenant_id();
  v_user uuid := auth.uid();
  v_dup uuid;
BEGIN
  IF NOT (public.has_role(v_user, 'admin'::app_role) OR public.is_tenant_owner(v_user)) THEN
    RAISE EXCEPTION 'Only admins or owners can merge customers';
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

CREATE FUNCTION public.unmerge_supplier(p_duplicate uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  SELECT * INTO v_alias FROM public.supplier_aliases
   WHERE old_id = p_duplicate AND tenant_id = v_tenant
     AND reversible_until > now()
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No reversible merge found for this supplier'; END IF;
  v_master := v_alias.master_id;

  UPDATE public.suppliers
     SET is_merged = false, is_active = true, merged_into_id = NULL,
         merged_at = NULL, merge_reason = NULL
   WHERE id = p_duplicate;

  DELETE FROM public.supplier_aliases WHERE id = v_alias.id;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'supplier', p_duplicate, 'unmerged',
            jsonb_build_object('was_merged_into', v_master));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('restored', p_duplicate, 'from_master', v_master);
END;
$function$;

CREATE FUNCTION public.unmerge_customer(p_duplicate uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  SELECT * INTO v_alias FROM public.customer_aliases
   WHERE old_id = p_duplicate AND tenant_id = v_tenant
     AND reversible_until > now()
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No reversible merge found for this customer'; END IF;
  v_master := v_alias.master_id;

  UPDATE public.customers
     SET is_merged = false, is_active = true, merged_into_id = NULL,
         merged_at = NULL, merge_reason = NULL
   WHERE id = p_duplicate;

  DELETE FROM public.customer_aliases WHERE id = v_alias.id;

  BEGIN
    INSERT INTO public.audit_log(tenant_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_tenant, v_user, 'customer', p_duplicate, 'unmerged',
            jsonb_build_object('was_merged_into', v_master));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('restored', p_duplicate, 'from_master', v_master);
END;
$function$;
