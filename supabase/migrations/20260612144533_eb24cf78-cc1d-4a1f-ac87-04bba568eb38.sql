
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
      WHEN 'sales_invoice' THEN 'SI-'
      WHEN 'proforma' THEN 'SO-'
      WHEN 'warranty_invoice' THEN 'WI-'
      WHEN 'purchase_proforma' THEN 'PO-'
      WHEN 'purchase_order' THEN 'PO-'
      WHEN 'purchase_invoice' THEN 'PI-'
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

UPDATE public.document_counters SET prefix = 'SO-' WHERE document_type = 'proforma'         AND prefix IN ('P-','PROF-','PI-','PRO-');
UPDATE public.document_counters SET prefix = 'SI-' WHERE document_type = 'sales_invoice'    AND prefix = 'INV-';
UPDATE public.document_counters SET prefix = 'PI-' WHERE document_type = 'purchase_invoice' AND prefix IN ('BILL-','PP-');
UPDATE public.document_counters SET prefix = 'PO-' WHERE document_type = 'purchase_proforma' AND prefix IN ('PP-','PO -');
UPDATE public.document_counters SET prefix = 'DN-' WHERE document_type = 'delivery_note'    AND prefix <> 'DN-';
