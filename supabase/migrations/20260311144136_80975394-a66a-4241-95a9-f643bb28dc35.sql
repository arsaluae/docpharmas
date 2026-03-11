
-- Add unique constraint to allow ON CONFLICT DO NOTHING
ALTER TABLE public.document_counters ADD CONSTRAINT document_counters_tenant_type_unique UNIQUE (tenant_id, document_type);

-- Backfill all missing document counters for every existing tenant
INSERT INTO public.document_counters (tenant_id, document_type, prefix, current_value)
SELECT t.id, v.document_type, v.prefix, 0
FROM public.tenants t
CROSS JOIN (VALUES
  ('sales_invoice', 'INV-'),
  ('proforma', 'PI-'),
  ('warranty_invoice', 'WI-'),
  ('purchase_proforma', 'PP-'),
  ('purchase_order', 'PO-'),
  ('purchase_invoice', 'BILL-'),
  ('grn', 'GRN-'),
  ('payment', 'PAY-'),
  ('expense', 'EXP-'),
  ('delivery_note', 'DN-'),
  ('journal', 'JE-'),
  ('sales_return', 'SR-'),
  ('purchase_return', 'PR-'),
  ('print_job', 'PJ-'),
  ('supplier', 'SUP-'),
  ('customer', 'CUS-'),
  ('product', 'PRD-'),
  ('credit_note', 'CN-'),
  ('salary', 'SAL-')
) AS v(document_type, prefix)
ON CONFLICT (tenant_id, document_type) DO NOTHING;
