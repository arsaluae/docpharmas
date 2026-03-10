
-- Add invoice_id column to payments table for invoice-specific payment tracking
ALTER TABLE public.payments ADD COLUMN invoice_id uuid NULL;

-- Update recalc_customer_invoice_status to prioritize invoice-specific payments
CREATE OR REPLACE FUNCTION public.recalc_customer_invoice_status(p_customer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_direct_paid numeric;
  v_general_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
BEGIN
  -- Get total general (non-linked) payments
  SELECT COALESCE(SUM(amount), 0) INTO v_general_payments
  FROM payments
  WHERE party_type = 'customer' AND type = 'received' AND party_id = p_customer_id
    AND invoice_id IS NULL;

  -- Process each invoice: first apply direct payments, then allocate general payments oldest-first
  FOR v_invoice IN
    SELECT id, total
    FROM sales_invoices
    WHERE customer_id = p_customer_id
      AND status NOT IN ('cancelled')
    ORDER BY date ASC, created_at ASC
  LOOP
    -- Sum direct payments linked to this specific invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_direct_paid
    FROM payments
    WHERE party_type = 'customer' AND type = 'received' AND invoice_id = v_invoice.id;

    -- Allocate from general pool (oldest-first)
    v_alloc := v_direct_paid + LEAST(
      GREATEST(v_invoice.total - v_direct_paid, 0),
      GREATEST(v_general_payments - v_running_paid, 0)
    );
    v_running_paid := v_running_paid + GREATEST(v_invoice.total - v_direct_paid, 0);

    UPDATE sales_invoices
    SET amount_paid = v_alloc,
        status = CASE
          WHEN v_alloc >= v_invoice.total THEN 'paid'
          WHEN v_alloc > 0 THEN 'partial'
          ELSE 'dispatched'
        END
    WHERE id = v_invoice.id;
  END LOOP;
END;
$function$;

-- Update recalc_supplier_invoice_status similarly
CREATE OR REPLACE FUNCTION public.recalc_supplier_invoice_status(p_supplier_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_direct_paid numeric;
  v_general_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_general_payments
  FROM payments
  WHERE party_type = 'supplier' AND type = 'made' AND party_id = p_supplier_id
    AND invoice_id IS NULL;

  FOR v_invoice IN
    SELECT id, total
    FROM purchase_invoices
    WHERE supplier_id = p_supplier_id
      AND status NOT IN ('cancelled')
    ORDER BY date ASC, created_at ASC
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_direct_paid
    FROM payments
    WHERE party_type = 'supplier' AND type = 'made' AND invoice_id = v_invoice.id;

    v_alloc := v_direct_paid + LEAST(
      GREATEST(v_invoice.total - v_direct_paid, 0),
      GREATEST(v_general_payments - v_running_paid, 0)
    );
    v_running_paid := v_running_paid + GREATEST(v_invoice.total - v_direct_paid, 0);

    UPDATE purchase_invoices
    SET status = CASE
          WHEN v_alloc >= v_invoice.total THEN 'paid'
          WHEN v_alloc > 0 THEN 'partial'
          ELSE 'unpaid'
        END
    WHERE id = v_invoice.id;
  END LOOP;
END;
$function$;
