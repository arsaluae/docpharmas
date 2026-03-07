-- 1. Create printers table
CREATE TABLE public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  phone text,
  email text,
  address text,
  city text,
  ntn text,
  opening_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  payment_terms_days integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select printers" ON public.printers FOR SELECT USING (true);
CREATE POLICY "Auth insert printers" ON public.printers FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update printers" ON public.printers FOR UPDATE USING (true);
CREATE POLICY "Auth delete printers" ON public.printers FOR DELETE USING (true);

-- 2. Create print_jobs table
CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL,
  printer_id uuid REFERENCES public.printers(id),
  product_id uuid REFERENCES public.products(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_delivered numeric NOT NULL DEFAULT 0,
  quantity_rejected numeric NOT NULL DEFAULT 0,
  rejection_reason text,
  status text NOT NULL DEFAULT 'draft',
  cost_per_unit numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  printer_share_percent numeric NOT NULL DEFAULT 0,
  printer_share_amount numeric NOT NULL DEFAULT 0,
  our_share_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select print_jobs" ON public.print_jobs FOR SELECT USING (true);
CREATE POLICY "Auth insert print_jobs" ON public.print_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update print_jobs" ON public.print_jobs FOR UPDATE USING (true);
CREATE POLICY "Auth delete print_jobs" ON public.print_jobs FOR DELETE USING (true);

-- 3. Insert document counter for print jobs
INSERT INTO public.document_counters (document_type, prefix, current_value) VALUES ('print_job', 'PJ-', 0);

-- 4. Update handle_payment_balance to support printer party_type
CREATE OR REPLACE FUNCTION public.handle_payment_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.party_type = 'customer' THEN
      IF NEW.type = 'received' THEN
        UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSE
        UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    ELSIF NEW.party_type = 'supplier' THEN
      IF NEW.type = 'made' THEN
        UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSE
        UPDATE suppliers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    ELSIF NEW.party_type = 'printer' THEN
      IF NEW.type = 'made' THEN
        UPDATE printers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSE
        UPDATE printers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    END IF;
    IF NEW.bank_account_id IS NOT NULL THEN
      IF NEW.type = 'received' THEN
        UPDATE bank_accounts SET balance = balance + NEW.amount WHERE id = NEW.bank_account_id;
      ELSE
        UPDATE bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.party_type = 'customer' THEN
      IF OLD.type = 'received' THEN
        UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSE
        UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    ELSIF OLD.party_type = 'supplier' THEN
      IF OLD.type = 'made' THEN
        UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSE
        UPDATE suppliers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    ELSIF OLD.party_type = 'printer' THEN
      IF OLD.type = 'made' THEN
        UPDATE printers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSE
        UPDATE printers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    IF OLD.bank_account_id IS NOT NULL THEN
      IF OLD.type = 'received' THEN
        UPDATE bank_accounts SET balance = balance - OLD.amount WHERE id = OLD.bank_account_id;
      ELSE
        UPDATE bank_accounts SET balance = balance + OLD.amount WHERE id = OLD.bank_account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 5. Create trigger for print job settlement
CREATE OR REPLACE FUNCTION public.handle_print_job_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'settled' AND NEW.printer_id IS NOT NULL THEN
      UPDATE printers SET balance = balance + NEW.total_cost WHERE id = NEW.printer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'settled' AND NEW.status = 'settled' AND NEW.printer_id IS NOT NULL THEN
      UPDATE printers SET balance = balance + NEW.total_cost WHERE id = NEW.printer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'settled' AND OLD.printer_id IS NOT NULL THEN
      UPDATE printers SET balance = balance - OLD.total_cost WHERE id = OLD.printer_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER on_print_job_change
  AFTER INSERT OR UPDATE OR DELETE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_print_job_balance();

-- Ensure payment triggers exist
DROP TRIGGER IF EXISTS on_payment_change ON public.payments;
CREATE TRIGGER on_payment_change
  AFTER INSERT OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_balance();