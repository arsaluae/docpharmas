
-- Credit Notes table
CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL,
  party_type text NOT NULL,
  party_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_credit_notes" ON public.credit_notes FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_credit_notes" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_credit_notes" ON public.credit_notes FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_credit_notes" ON public.credit_notes FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_tenant_credit_notes BEFORE INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE OR REPLACE FUNCTION public.handle_credit_note_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
    END IF; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
    END IF; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE TRIGGER credit_note_balance_trigger AFTER INSERT OR DELETE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.handle_credit_note_balance();

-- Expense Ledgers table
CREATE TABLE public.expense_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  expense_type text NOT NULL DEFAULT 'business',
  description text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_ledgers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_expense_ledgers" ON public.expense_ledgers FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_expense_ledgers" ON public.expense_ledgers FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_expense_ledgers" ON public.expense_ledgers FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_expense_ledgers" ON public.expense_ledgers FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_tenant_expense_ledgers BEFORE INSERT ON public.expense_ledgers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

ALTER TABLE public.expenses ADD COLUMN ledger_id uuid REFERENCES public.expense_ledgers(id);

-- Staff table
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, designation text, phone text,
  salary numeric NOT NULL DEFAULT 0, joining_date date,
  status text NOT NULL DEFAULT 'active',
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_staff" ON public.staff FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_staff" ON public.staff FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_staff" ON public.staff FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_staff" ON public.staff FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_tenant_staff BEFORE INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Salary Payments table
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_number text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0, month text NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  date date NOT NULL DEFAULT CURRENT_DATE, notes text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_salary_payments" ON public.salary_payments FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_salary_payments" ON public.salary_payments FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_salary_payments" ON public.salary_payments FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_salary_payments" ON public.salary_payments FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_tenant_salary_payments BEFORE INSERT ON public.salary_payments FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE OR REPLACE FUNCTION public.handle_salary_bank_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_account_id IS NOT NULL THEN UPDATE bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id; END IF; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN UPDATE bank_accounts SET balance = balance + OLD.amount WHERE id = OLD.bank_account_id; END IF; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE TRIGGER salary_bank_balance_trigger AFTER INSERT OR DELETE ON public.salary_payments FOR EACH ROW EXECUTE FUNCTION public.handle_salary_bank_balance();

-- Fix document_counters PK to support multi-tenancy
ALTER TABLE public.document_counters DROP CONSTRAINT document_counters_pkey;
ALTER TABLE public.document_counters ADD PRIMARY KEY (document_type, tenant_id);

-- Insert counters for existing tenants
INSERT INTO public.document_counters (document_type, prefix, current_value, tenant_id)
SELECT 'credit_note', 'CN-', 0, id FROM public.tenants
ON CONFLICT DO NOTHING;

INSERT INTO public.document_counters (document_type, prefix, current_value, tenant_id)
SELECT 'salary', 'SAL-', 0, id FROM public.tenants
ON CONFLICT DO NOTHING;
