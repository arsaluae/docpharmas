-- 1. Grant SELECT on agent-facing views
GRANT SELECT ON public.sales_product_catalog_view TO authenticated;
GRANT SELECT ON public.agent_stock_availability TO authenticated;
GRANT SELECT ON public.agent_batch_availability TO authenticated;
GRANT ALL ON public.sales_product_catalog_view TO service_role;
GRANT ALL ON public.agent_stock_availability TO service_role;
GRANT ALL ON public.agent_batch_availability TO service_role;

-- 2. Update generate_document_number default prefix for proforma -> SO-
CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next integer;
  v_tenant_id uuid;
  v_default_prefix text;
BEGIN
  v_tenant_id := public.get_user_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context for current user';
  END IF;

  UPDATE document_counters
  SET current_value = current_value + 1
  WHERE document_type = p_document_type
    AND tenant_id = v_tenant_id
  RETURNING prefix, current_value INTO v_prefix, v_next;

  IF NOT FOUND THEN
    v_default_prefix := CASE p_document_type
      WHEN 'sales_invoice' THEN 'INV-'
      WHEN 'proforma' THEN 'SO-'
      WHEN 'warranty_invoice' THEN 'WI-'
      WHEN 'purchase_proforma' THEN 'PP-'
      WHEN 'purchase_order' THEN 'PO-'
      WHEN 'purchase_invoice' THEN 'BILL-'
      WHEN 'grn' THEN 'GRN-'
      WHEN 'payment' THEN 'PAY-'
      WHEN 'expense' THEN 'EXP-'
      WHEN 'delivery_note' THEN 'DN-'
      WHEN 'journal' THEN 'JE-'
      WHEN 'sales_return' THEN 'SR-'
      WHEN 'purchase_return' THEN 'PR-'
      WHEN 'print_job' THEN 'PJ-'
      WHEN 'supplier' THEN 'SUP-'
      WHEN 'customer' THEN 'CUS-'
      WHEN 'product' THEN 'PRD-'
      WHEN 'credit_note' THEN 'CN-'
      WHEN 'debit_note' THEN 'DBN-'
      WHEN 'salary' THEN 'SAL-'
      WHEN 'commission' THEN 'COM-'
      ELSE NULL
    END;

    IF v_default_prefix IS NULL THEN
      RAISE EXCEPTION 'Unknown document type: %', p_document_type;
    END IF;

    INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
    VALUES (v_tenant_id, p_document_type, v_default_prefix, 1)
    ON CONFLICT (tenant_id, document_type) DO UPDATE
      SET current_value = document_counters.current_value + 1
    RETURNING prefix, current_value INTO v_prefix, v_next;
  END IF;

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$$;