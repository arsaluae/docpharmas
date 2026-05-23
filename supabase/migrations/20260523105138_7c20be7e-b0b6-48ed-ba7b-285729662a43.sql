
-- Phase C tightening: seed system "Printing Rejection Expense" CoA per tenant,
-- and wire post_print_rejection() to attach it + cross-reference print_rejection_id.

-- 1. Seed system CoA account for any tenant missing it.
INSERT INTO public.chart_of_accounts (tenant_id, code, name, account_type, is_system, balance)
SELECT DISTINCT t.tenant_id, '5300', 'Printing Rejection Expense', 'expense', true, 0
FROM (
  SELECT tenant_id FROM public.chart_of_accounts WHERE tenant_id IS NOT NULL
) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts c
  WHERE c.tenant_id = t.tenant_id AND c.code = '5300'
);

-- 2. Replace trigger function to (a) attach account_id to expense row,
--    (b) cross-reference print_rejection id in both expense description and debit-note notes.
CREATE OR REPLACE FUNCTION public.post_print_rejection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job record;
  v_dn_id uuid;
  v_exp_id uuid;
  v_dn_num text;
  v_total_rej numeric;
  v_acct_id uuid;
BEGIN
  SELECT * INTO v_job FROM print_jobs WHERE id = NEW.print_job_id;

  IF NEW.cost_per_unit IS NULL OR NEW.cost_per_unit = 0 THEN
    NEW.cost_per_unit := v_job.cost_per_unit;
  END IF;
  NEW.total_cost := NEW.qty_rejected * NEW.cost_per_unit;
  NEW.our_share_amount := round(NEW.total_cost * COALESCE(NEW.our_share_percent,50) / 100.0, 2);
  NEW.vendor_share_amount := NEW.total_cost - NEW.our_share_amount;

  -- Resolve (and lazily create) the system Printing Rejection Expense account for this tenant.
  IF NEW.tenant_id IS NOT NULL THEN
    SELECT id INTO v_acct_id
      FROM chart_of_accounts
      WHERE tenant_id = NEW.tenant_id AND code = '5300'
      LIMIT 1;
    IF v_acct_id IS NULL THEN
      INSERT INTO chart_of_accounts (tenant_id, code, name, account_type, is_system, balance)
      VALUES (NEW.tenant_id, '5300', 'Printing Rejection Expense', 'expense', true, 0)
      RETURNING id INTO v_acct_id;
    END IF;
  END IF;

  -- Vendor share -> debit note against printer.
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
            'print_rejection_id=' || NEW.id::text
              || CASE WHEN NEW.reason IS NOT NULL THEN ' | ' || NEW.reason ELSE '' END
              || CASE WHEN NEW.evidence_notes IS NOT NULL THEN ' | ' || NEW.evidence_notes ELSE '' END)
    RETURNING id INTO v_dn_id;
    NEW.debit_note_id := v_dn_id;
  END IF;

  -- Our share -> expense (booked against system Printing Rejection Expense CoA account).
  IF NEW.our_share_amount > 0 THEN
    INSERT INTO expenses (date, category, amount, description, expense_type, account_id)
    VALUES (NEW.date, 'Printing Rejection', NEW.our_share_amount,
            'PJO '||v_job.job_number||' — our share of '||NEW.qty_rejected||' rejected'
              || ' [print_rejection_id=' || NEW.id::text || ']',
            'business',
            v_acct_id)
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
