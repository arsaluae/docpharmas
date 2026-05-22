
-- 1. debit_notes table
CREATE TABLE public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  debit_note_number text NOT NULL,
  party_type text NOT NULL,
  party_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_debit_notes" ON public.debit_notes FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_debit_notes" ON public.debit_notes FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_debit_notes" ON public.debit_notes FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_debit_notes" ON public.debit_notes FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_debit_notes BEFORE INSERT ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- 2. debit_notes balance trigger
CREATE OR REPLACE FUNCTION public.handle_debit_note_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
    END IF; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
    END IF; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE TRIGGER trg_debit_note_balance AFTER INSERT OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_debit_note_balance();

-- 3. document counter for debit notes
INSERT INTO public.document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT tenant_id, 'debit_note', 'DN-', 0
FROM public.document_counters
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_counters dc2
  WHERE dc2.document_type = 'debit_note' AND dc2.tenant_id = document_counters.tenant_id
);

-- 4. Drop old return balance triggers (notes will own balance going forward)
DROP TRIGGER IF EXISTS trg_sales_return_balance ON public.sales_returns;
DROP TRIGGER IF EXISTS handle_sales_return_balance_trigger ON public.sales_returns;
DROP TRIGGER IF EXISTS trg_purchase_return_balance ON public.purchase_returns;
DROP TRIGGER IF EXISTS handle_purchase_return_balance_trigger ON public.purchase_returns;

-- 5. stock_audit_log
CREATE TABLE public.stock_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  product_id uuid NOT NULL,
  old_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  variance numeric NOT NULL,
  reason text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_stock_audit_log" ON public.stock_audit_log FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_stock_audit_log" ON public.stock_audit_log FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_id_stock_audit_log BEFORE INSERT ON public.stock_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
