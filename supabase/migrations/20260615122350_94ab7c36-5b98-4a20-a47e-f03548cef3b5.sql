
-- WAVE 1 (retry)
CREATE TABLE IF NOT EXISTS public.opening_stock_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  doc_number text,
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  ref_no text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  totals_qty numeric NOT NULL DEFAULT 0,
  totals_value numeric NOT NULL DEFAULT 0,
  created_by uuid,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_stock_documents TO authenticated;
GRANT ALL ON public.opening_stock_documents TO service_role;
ALTER TABLE public.opening_stock_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant read opening_stock_documents" ON public.opening_stock_documents
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant insert opening_stock_documents" ON public.opening_stock_documents
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant update opening_stock_documents" ON public.opening_stock_documents
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant delete opening_stock_documents" ON public.opening_stock_documents
  FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id() AND status = 'draft');

DROP TRIGGER IF EXISTS trg_set_tenant_osd ON public.opening_stock_documents;
CREATE TRIGGER trg_set_tenant_osd BEFORE INSERT ON public.opening_stock_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS trg_upd_osd ON public.opening_stock_documents;
CREATE TRIGGER trg_upd_osd BEFORE UPDATE ON public.opening_stock_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.opening_stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.opening_stock_documents(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_number text NOT NULL,
  mfg_date date,
  expiry_date date NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  purchase_cost numeric NOT NULL DEFAULT 0,
  mrp numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'Main',
  notes text,
  stock_movement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_stock_batches TO authenticated;
GRANT ALL ON public.opening_stock_batches TO service_role;
ALTER TABLE public.opening_stock_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant read opening_stock_batches" ON public.opening_stock_batches
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant insert opening_stock_batches" ON public.opening_stock_batches
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant update opening_stock_batches" ON public.opening_stock_batches
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant delete opening_stock_batches" ON public.opening_stock_batches
  FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS trg_set_tenant_osb ON public.opening_stock_batches;
CREATE TRIGGER trg_set_tenant_osb BEFORE INSERT ON public.opening_stock_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
DROP TRIGGER IF EXISTS trg_upd_osb ON public.opening_stock_batches;
CREATE TRIGGER trg_upd_osb BEFORE UPDATE ON public.opening_stock_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_osb_doc ON public.opening_stock_batches(document_id);
CREATE INDEX IF NOT EXISTS idx_osb_product ON public.opening_stock_batches(product_id);


-- Settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS purchase_edit_window_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS purchase_edit_auto_update_cost boolean NOT NULL DEFAULT false;


-- Purchase invoice edit/lock metadata
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;

UPDATE public.purchase_invoices
   SET submitted_at = COALESCE(submitted_at, created_at)
 WHERE submitted_at IS NULL AND status IN ('submitted','approved','posted','locked');


-- Payment correction
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_reversal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverses_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;


-- Lock checker
CREATE OR REPLACE FUNCTION public.check_purchase_invoice_lock(_invoice_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text; v_submitted timestamptz; v_window int; v_tenant uuid;
BEGIN
  SELECT status, submitted_at, tenant_id INTO v_status, v_submitted, v_tenant
    FROM public.purchase_invoices WHERE id = _invoice_id;
  IF v_status IS NULL OR v_status <> 'submitted' OR v_submitted IS NULL THEN
    RETURN COALESCE(v_status, 'not_found');
  END IF;
  SELECT COALESCE(purchase_edit_window_days, 30) INTO v_window
    FROM public.company_settings WHERE tenant_id = v_tenant LIMIT 1;
  IF (now() - v_submitted) > make_interval(days => COALESCE(v_window, 30)) THEN
    UPDATE public.purchase_invoices SET status = 'locked', locked_at = now() WHERE id = _invoice_id;
    RETURN 'locked';
  END IF;
  RETURN 'submitted';
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_purchase_invoice_lock(uuid) TO authenticated;
