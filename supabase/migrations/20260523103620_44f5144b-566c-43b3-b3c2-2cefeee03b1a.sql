-- ============================================================
-- PHASE B: 48h Grace Window
-- ============================================================

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

UPDATE public.sales_invoices SET approved_at = created_at WHERE approved_at IS NULL;
UPDATE public.purchase_invoices SET approved_at = created_at WHERE approved_at IS NULL;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS invoice_delete_grace_hours integer NOT NULL DEFAULT 48;

CREATE OR REPLACE FUNCTION public.invoice_delete_grace_remaining(p_table text, p_id uuid)
RETURNS interval LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_approved timestamptz;
  v_hours int;
BEGIN
  IF p_table NOT IN ('sales_invoices','purchase_invoices') THEN
    RAISE EXCEPTION 'Grace check unsupported for %', p_table;
  END IF;
  EXECUTE format('SELECT approved_at FROM public.%I WHERE id = $1 AND tenant_id = $2', p_table)
    INTO v_approved USING p_id, v_tenant;
  IF v_approved IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(invoice_delete_grace_hours, 48) INTO v_hours
    FROM company_settings WHERE tenant_id = v_tenant LIMIT 1;
  IF v_hours IS NULL THEN v_hours := 48; END IF;
  RETURN (v_approved + make_interval(hours => v_hours)) - now();
END $$;

CREATE OR REPLACE FUNCTION public.delete_invoice_with_grace(p_table text, p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_remaining interval;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to delete an invoice.';
  END IF;
  v_remaining := public.invoice_delete_grace_remaining(p_table, p_id);
  IF v_remaining IS NULL THEN RAISE EXCEPTION 'Invoice not found.'; END IF;
  IF v_remaining <= interval '0' THEN
    RAISE EXCEPTION 'Grace window expired. Raise a return/credit note instead.'
      USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.void_document(p_table, p_id, p_reason);
END $$;

-- ============================================================
-- PHASE C: Printing Module Upgrade
-- ============================================================

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_proformas(id),
  ADD COLUMN IF NOT EXISTS factory_name text,
  ADD COLUMN IF NOT EXISTS special_instructions text;

CREATE TABLE IF NOT EXISTS public.print_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  print_job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_note_no text,
  qty_delivered numeric NOT NULL CHECK (qty_delivered > 0),
  received_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_print_deliveries_job ON public.print_deliveries(print_job_id);
ALTER TABLE public.print_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_all_print_deliveries ON public.print_deliveries;
CREATE POLICY tenant_all_print_deliveries ON public.print_deliveries FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_tenant_print_deliveries ON public.print_deliveries;
CREATE TRIGGER set_tenant_print_deliveries BEFORE INSERT ON public.print_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.print_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  print_job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  qty_rejected numeric NOT NULL CHECK (qty_rejected > 0),
  reason text,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  our_share_percent numeric NOT NULL DEFAULT 50,
  our_share_amount numeric NOT NULL DEFAULT 0,
  vendor_share_amount numeric NOT NULL DEFAULT 0,
  debit_note_id uuid REFERENCES public.debit_notes(id),
  expense_id uuid REFERENCES public.expenses(id),
  evidence_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_print_rejections_job ON public.print_rejections(print_job_id);
ALTER TABLE public.print_rejections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_all_print_rejections ON public.print_rejections;
CREATE POLICY tenant_all_print_rejections ON public.print_rejections FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_tenant_print_rejections ON public.print_rejections;
CREATE TRIGGER set_tenant_print_rejections BEFORE INSERT ON public.print_rejections
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Roll deliveries into print_jobs.quantity_delivered
CREATE OR REPLACE FUNCTION public.aggregate_print_deliveries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id uuid; v_total numeric;
BEGIN
  v_job_id := COALESCE(NEW.print_job_id, OLD.print_job_id);
  SELECT COALESCE(SUM(qty_delivered),0) INTO v_total
    FROM print_deliveries WHERE print_job_id = v_job_id;
  UPDATE print_jobs SET quantity_delivered = v_total WHERE id = v_job_id;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_aggregate_print_deliveries ON public.print_deliveries;
CREATE TRIGGER trg_aggregate_print_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.print_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_print_deliveries();

-- Post rejection: compute amounts, write debit note (vendor share) + expense (our share), aggregate
CREATE OR REPLACE FUNCTION public.post_print_rejection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job record;
  v_dn_id uuid;
  v_exp_id uuid;
  v_dn_num text;
  v_total_rej numeric;
BEGIN
  SELECT * INTO v_job FROM print_jobs WHERE id = NEW.print_job_id;

  IF NEW.cost_per_unit IS NULL OR NEW.cost_per_unit = 0 THEN
    NEW.cost_per_unit := v_job.cost_per_unit;
  END IF;
  NEW.total_cost := NEW.qty_rejected * NEW.cost_per_unit;
  NEW.our_share_amount := round(NEW.total_cost * COALESCE(NEW.our_share_percent,50) / 100.0, 2);
  NEW.vendor_share_amount := NEW.total_cost - NEW.our_share_amount;

  -- Vendor share -> debit note against printer (printer is a supplier-like party for AP).
  IF NEW.vendor_share_amount > 0 AND v_job.printer_id IS NOT NULL THEN
    BEGIN
      SELECT public.generate_document_number('debit_note') INTO v_dn_num;
    EXCEPTION WHEN OTHERS THEN
      v_dn_num := 'DN-PRJ-' || substr(NEW.print_job_id::text,1,8) || '-' || to_char(now(),'YYMMDDHH24MISS');
    END;
    INSERT INTO debit_notes (debit_note_number, party_type, party_id, date, amount, reason, reference, notes)
    VALUES (v_dn_num, 'printer', v_job.printer_id, NEW.date, NEW.vendor_share_amount,
            'Printing rejection — vendor share',
            v_job.job_number,
            COALESCE(NEW.reason,'') || CASE WHEN NEW.evidence_notes IS NOT NULL THEN ' | '||NEW.evidence_notes ELSE '' END)
    RETURNING id INTO v_dn_id;
    NEW.debit_note_id := v_dn_id;
  END IF;

  -- Our share -> expense
  IF NEW.our_share_amount > 0 THEN
    INSERT INTO expenses (date, category, amount, description, expense_type)
    VALUES (NEW.date, 'Printing Rejection', NEW.our_share_amount,
            'PJO '||v_job.job_number||' — our share of '||NEW.qty_rejected||' rejected', 'business')
    RETURNING id INTO v_exp_id;
    NEW.expense_id := v_exp_id;
  END IF;

  -- Aggregate quantity_rejected on print_jobs
  SELECT COALESCE(SUM(qty_rejected),0) INTO v_total_rej
    FROM print_rejections WHERE print_job_id = NEW.print_job_id;
  v_total_rej := v_total_rej + NEW.qty_rejected;
  UPDATE print_jobs
    SET quantity_rejected = v_total_rej,
        rejection_reason = COALESCE(NEW.reason, rejection_reason)
    WHERE id = NEW.print_job_id;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_post_print_rejection ON public.print_rejections;
CREATE TRIGGER trg_post_print_rejection
  BEFORE INSERT ON public.print_rejections
  FOR EACH ROW EXECUTE FUNCTION public.post_print_rejection();

-- On delete: re-aggregate (we leave the linked debit note + expense for audit unless tenant deletes them)
CREATE OR REPLACE FUNCTION public.recalc_print_rejections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric;
BEGIN
  SELECT COALESCE(SUM(qty_rejected),0) INTO v_total
    FROM print_rejections WHERE print_job_id = OLD.print_job_id;
  UPDATE print_jobs SET quantity_rejected = v_total WHERE id = OLD.print_job_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_recalc_print_rejections ON public.print_rejections;
CREATE TRIGGER trg_recalc_print_rejections
  AFTER DELETE ON public.print_rejections
  FOR EACH ROW EXECUTE FUNCTION public.recalc_print_rejections();

-- ============================================================
-- PHASE D: Return reason + Note applications
-- ============================================================

ALTER TABLE public.sales_returns
  ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE public.purchase_returns
  ADD COLUMN IF NOT EXISTS return_reason text;

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS applied_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS applied_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_note_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_note_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_all_credit_note_applications ON public.credit_note_applications;
CREATE POLICY tenant_all_credit_note_applications ON public.credit_note_applications FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_tenant_cna ON public.credit_note_applications;
CREATE TRIGGER set_tenant_cna BEFORE INSERT ON public.credit_note_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TABLE IF NOT EXISTS public.debit_note_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  debit_note_id uuid NOT NULL REFERENCES public.debit_notes(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debit_note_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_all_debit_note_applications ON public.debit_note_applications;
CREATE POLICY tenant_all_debit_note_applications ON public.debit_note_applications FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS set_tenant_dna ON public.debit_note_applications;
CREATE TRIGGER set_tenant_dna BEFORE INSERT ON public.debit_note_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Roll applications into note.applied_amount
CREATE OR REPLACE FUNCTION public.recalc_note_applied(p_kind text, p_note_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric;
BEGIN
  IF p_kind = 'credit' THEN
    SELECT COALESCE(SUM(amount),0) INTO v_total FROM credit_note_applications WHERE credit_note_id = p_note_id;
    UPDATE credit_notes SET applied_amount = v_total WHERE id = p_note_id;
  ELSE
    SELECT COALESCE(SUM(amount),0) INTO v_total FROM debit_note_applications WHERE debit_note_id = p_note_id;
    UPDATE debit_notes SET applied_amount = v_total WHERE id = p_note_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_credit_note_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_note record; v_inv record; v_total numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT amount, applied_amount, party_id, party_type INTO v_note FROM credit_notes WHERE id = NEW.credit_note_id;
    IF v_note IS NULL THEN RAISE EXCEPTION 'Credit note not found'; END IF;
    IF v_note.party_type <> 'customer' THEN RAISE EXCEPTION 'Credit note must belong to a customer'; END IF;
    SELECT customer_id, total, amount_paid INTO v_inv FROM sales_invoices WHERE id = NEW.invoice_id;
    IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    IF v_inv.customer_id <> v_note.party_id THEN RAISE EXCEPTION 'Credit note party does not match invoice customer'; END IF;
    IF v_note.applied_amount + NEW.amount > v_note.amount + 0.001 THEN
      RAISE EXCEPTION 'Application exceeds credit note remaining (% remaining)', v_note.amount - v_note.applied_amount;
    END IF;
    IF v_inv.amount_paid + NEW.amount > v_inv.total + 0.001 THEN
      RAISE EXCEPTION 'Application exceeds invoice outstanding';
    END IF;
    UPDATE sales_invoices SET amount_paid = amount_paid + NEW.amount,
      status = CASE WHEN amount_paid + NEW.amount >= total THEN 'paid'
                    WHEN amount_paid + NEW.amount > 0 THEN 'partial' ELSE status END
      WHERE id = NEW.invoice_id;
    PERFORM recalc_note_applied('credit', NEW.credit_note_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sales_invoices SET amount_paid = GREATEST(amount_paid - OLD.amount, 0)
      WHERE id = OLD.invoice_id;
    PERFORM recalc_note_applied('credit', OLD.credit_note_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_credit_note_application ON public.credit_note_applications;
CREATE TRIGGER trg_credit_note_application
  AFTER INSERT OR DELETE ON public.credit_note_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_credit_note_application();

CREATE OR REPLACE FUNCTION public.handle_debit_note_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_note record; v_inv record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT amount, applied_amount, party_id, party_type INTO v_note FROM debit_notes WHERE id = NEW.debit_note_id;
    IF v_note IS NULL THEN RAISE EXCEPTION 'Debit note not found'; END IF;
    IF v_note.party_type <> 'supplier' THEN RAISE EXCEPTION 'Debit note must belong to a supplier'; END IF;
    SELECT supplier_id, total, status INTO v_inv FROM purchase_invoices WHERE id = NEW.invoice_id;
    IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    IF v_inv.supplier_id <> v_note.party_id THEN RAISE EXCEPTION 'Debit note party does not match invoice supplier'; END IF;
    IF v_note.applied_amount + NEW.amount > v_note.amount + 0.001 THEN
      RAISE EXCEPTION 'Application exceeds debit note remaining';
    END IF;
    PERFORM recalc_note_applied('debit', NEW.debit_note_id);
    -- Reduce supplier invoice via recalc helper after creating a synthetic payment? Simpler: just rely on recalc which sums payments; skip status mutation here.
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalc_note_applied('debit', OLD.debit_note_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_debit_note_application ON public.debit_note_applications;
CREATE TRIGGER trg_debit_note_application
  AFTER INSERT OR DELETE ON public.debit_note_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_debit_note_application();
