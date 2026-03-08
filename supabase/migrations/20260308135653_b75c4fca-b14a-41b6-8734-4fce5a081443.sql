
-- Trigger function to auto-update invoice status when payments are inserted/deleted
CREATE OR REPLACE FUNCTION public.handle_payment_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_paid numeric;
  v_invoice record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Customer payment received -> update sales_invoices
    IF NEW.party_type = 'customer' AND NEW.type = 'received' THEN
      -- Find unpaid/partial sales invoices for this customer, oldest first
      FOR v_invoice IN
        SELECT id, total, amount_paid
        FROM sales_invoices
        WHERE customer_id = NEW.party_id
          AND status IN ('dispatched', 'partial')
        ORDER BY date ASC, created_at ASC
      LOOP
        -- Calculate total payments for this invoice from all payments
        SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
        FROM payments p
        JOIN sales_invoices si ON si.customer_id = p.party_id
        WHERE p.party_type = 'customer'
          AND p.type = 'received'
          AND p.party_id = NEW.party_id;

        -- Simple approach: update all invoices for this customer
        EXIT; -- We'll use a simpler bulk approach below
      END LOOP;

      -- Bulk approach: recalculate all invoice statuses for this customer
      PERFORM public.recalc_customer_invoice_status(NEW.party_id);
    END IF;

    -- Supplier payment made -> update purchase_invoices
    IF NEW.party_type = 'supplier' AND NEW.type = 'made' THEN
      PERFORM public.recalc_supplier_invoice_status(NEW.party_id);
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.party_type = 'customer' AND OLD.type = 'received' THEN
      PERFORM public.recalc_customer_invoice_status(OLD.party_id);
    END IF;
    IF OLD.party_type = 'supplier' AND OLD.type = 'made' THEN
      PERFORM public.recalc_supplier_invoice_status(OLD.party_id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Helper: recalculate all sales invoice statuses for a customer
CREATE OR REPLACE FUNCTION public.recalc_customer_invoice_status(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
BEGIN
  -- Get total payments received from this customer
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM payments
  WHERE party_type = 'customer' AND type = 'received' AND party_id = p_customer_id;

  -- Allocate payments to invoices oldest first
  FOR v_invoice IN
    SELECT id, total
    FROM sales_invoices
    WHERE customer_id = p_customer_id
      AND status NOT IN ('cancelled')
    ORDER BY date ASC, created_at ASC
  LOOP
    v_alloc := LEAST(v_invoice.total, GREATEST(v_total_payments - v_running_paid, 0));
    v_running_paid := v_running_paid + v_invoice.total;

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
$$;

-- Helper: recalculate all purchase invoice statuses for a supplier
CREATE OR REPLACE FUNCTION public.recalc_supplier_invoice_status(p_supplier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM payments
  WHERE party_type = 'supplier' AND type = 'made' AND party_id = p_supplier_id;

  FOR v_invoice IN
    SELECT id, total
    FROM purchase_invoices
    WHERE supplier_id = p_supplier_id
      AND status NOT IN ('cancelled')
    ORDER BY date ASC, created_at ASC
  LOOP
    v_alloc := LEAST(v_invoice.total, GREATEST(v_total_payments - v_running_paid, 0));
    v_running_paid := v_running_paid + v_invoice.total;

    UPDATE purchase_invoices
    SET status = CASE
          WHEN v_alloc >= v_invoice.total THEN 'paid'
          WHEN v_alloc > 0 THEN 'partial'
          ELSE 'unpaid'
        END
    WHERE id = v_invoice.id;
  END LOOP;
END;
$$;

-- Create trigger on payments table
CREATE TRIGGER trg_payment_invoice_status
AFTER INSERT OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_invoice_status();
