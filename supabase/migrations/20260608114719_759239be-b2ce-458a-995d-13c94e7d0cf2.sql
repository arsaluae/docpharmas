
-- 1. Backfill counters for all existing tenants
INSERT INTO public.document_counters (tenant_id, document_type, prefix, current_value)
SELECT t.id, s.document_type, s.prefix, 0
FROM public.tenants t
CROSS JOIN (VALUES
  ('sales_invoice','INV-'),
  ('proforma','PI-'),
  ('warranty_invoice','WI-'),
  ('purchase_proforma','PP-'),
  ('purchase_order','PO-'),
  ('purchase_invoice','BILL-'),
  ('grn','GRN-'),
  ('payment','PAY-'),
  ('expense','EXP-'),
  ('delivery_note','DN-'),
  ('journal','JE-'),
  ('sales_return','SR-'),
  ('purchase_return','PR-'),
  ('print_job','PJ-'),
  ('supplier','SUP-'),
  ('customer','CUS-'),
  ('product','PRD-'),
  ('credit_note','CN-'),
  ('debit_note','DBN-'),
  ('salary','SAL-'),
  ('commission','COM-')
) AS s(document_type, prefix)
ON CONFLICT (tenant_id, document_type) DO NOTHING;

-- 2. Auto-seed counters whenever a new tenant is created
CREATE OR REPLACE FUNCTION public.seed_tenant_document_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.document_counters (tenant_id, document_type, prefix, current_value)
  VALUES
    (NEW.id,'sales_invoice','INV-',0),
    (NEW.id,'proforma','PI-',0),
    (NEW.id,'warranty_invoice','WI-',0),
    (NEW.id,'purchase_proforma','PP-',0),
    (NEW.id,'purchase_order','PO-',0),
    (NEW.id,'purchase_invoice','BILL-',0),
    (NEW.id,'grn','GRN-',0),
    (NEW.id,'payment','PAY-',0),
    (NEW.id,'expense','EXP-',0),
    (NEW.id,'delivery_note','DN-',0),
    (NEW.id,'journal','JE-',0),
    (NEW.id,'sales_return','SR-',0),
    (NEW.id,'purchase_return','PR-',0),
    (NEW.id,'print_job','PJ-',0),
    (NEW.id,'supplier','SUP-',0),
    (NEW.id,'customer','CUS-',0),
    (NEW.id,'product','PRD-',0),
    (NEW.id,'credit_note','CN-',0),
    (NEW.id,'debit_note','DBN-',0),
    (NEW.id,'salary','SAL-',0),
    (NEW.id,'commission','COM-',0)
  ON CONFLICT (tenant_id, document_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_document_counters_on_tenant ON public.tenants;
CREATE TRIGGER seed_document_counters_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_tenant_document_counters();

-- 3. Make the generator self-healing: if a counter is missing for a known type,
-- seed it on the fly and continue, instead of throwing "Unknown document type".
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
      WHEN 'proforma' THEN 'PI-'
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
