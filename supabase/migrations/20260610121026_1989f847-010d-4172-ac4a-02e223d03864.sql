
-- ============================================================
-- 1. Company settings: override switches
-- ============================================================
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS allow_expired_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_negative_stock boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Sales invoice lines: expiry_date column (nullable for backfill)
-- ============================================================
ALTER TABLE public.sales_invoice_items
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- ============================================================
-- 3. Trigger: enforce batch + expiry on NEW sales invoice lines,
--    check batch availability + expiry vs invoice date.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_sales_line_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := COALESCE(NEW.tenant_id, public.get_user_tenant_id());
  v_inv_date date;
  v_allow_expired boolean := false;
  v_allow_neg boolean := false;
  v_received numeric := 0;
  v_sold numeric := 0;
  v_available numeric := 0;
  v_batch_expiry date;
BEGIN
  -- Skip when product is missing (manual/free-text line — rare; not blocked).
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Required: batch + expiry on every new line.
  IF NEW.batch_number IS NULL OR length(trim(NEW.batch_number)) = 0 THEN
    RAISE EXCEPTION 'Batch number is required on every sales invoice line.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.expiry_date IS NULL THEN
    RAISE EXCEPTION 'Expiry date is required on every sales invoice line.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT date INTO v_inv_date FROM public.sales_invoices WHERE id = NEW.invoice_id;
  IF v_inv_date IS NULL THEN
    v_inv_date := CURRENT_DATE;
  END IF;

  SELECT allow_expired_sale, allow_negative_stock
    INTO v_allow_expired, v_allow_neg
    FROM public.company_settings
   WHERE tenant_id = v_tenant
   LIMIT 1;

  -- Expiry guard against invoice date.
  IF NEW.expiry_date < v_inv_date AND NOT COALESCE(v_allow_expired, false) THEN
    RAISE EXCEPTION 'Batch % is expired on % (expiry %). Enable "Allow expired batch sale" in Settings to override.',
      NEW.batch_number, v_inv_date, NEW.expiry_date
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cross-check: most recent recorded expiry for this batch (if it exists in grn_items).
  SELECT MAX(expiry_date) INTO v_batch_expiry
    FROM public.grn_items
   WHERE product_id = NEW.product_id
     AND batch_number = NEW.batch_number
     AND tenant_id = v_tenant;
  IF v_batch_expiry IS NOT NULL AND v_batch_expiry < v_inv_date AND NOT COALESCE(v_allow_expired, false) THEN
    RAISE EXCEPTION 'Batch % (recorded expiry %) is expired on %. Enable "Allow expired batch sale" to override.',
      NEW.batch_number, v_batch_expiry, v_inv_date
      USING ERRCODE = 'check_violation';
  END IF;

  -- Per-batch availability: received (GRN) - already sold (sales lines).
  SELECT COALESCE(SUM(quantity_received),0) INTO v_received
    FROM public.grn_items
   WHERE product_id = NEW.product_id
     AND batch_number = NEW.batch_number
     AND tenant_id = v_tenant;

  -- Only count if batch has ever been received; otherwise treat as opening stock and skip.
  IF v_received > 0 THEN
    SELECT COALESCE(SUM(sii.quantity),0) INTO v_sold
      FROM public.sales_invoice_items sii
      JOIN public.sales_invoices si ON si.id = sii.invoice_id
     WHERE sii.product_id = NEW.product_id
       AND sii.batch_number = NEW.batch_number
       AND sii.tenant_id = v_tenant
       AND si.status <> 'voided'
       AND sii.id <> NEW.id;
    v_available := v_received - v_sold;
    IF NEW.quantity > v_available AND NOT COALESCE(v_allow_neg, false) THEN
      RAISE EXCEPTION 'Batch % has only % available (received %, sold %); requested %. Enable "Allow negative stock" to override.',
        NEW.batch_number, v_available, v_received, v_sold, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_sales_line_batch ON public.sales_invoice_items;
CREATE TRIGGER trg_validate_sales_line_batch
  BEFORE INSERT ON public.sales_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sales_line_batch();

CREATE INDEX IF NOT EXISTS idx_grn_items_product_batch
  ON public.grn_items (tenant_id, product_id, batch_number);

CREATE INDEX IF NOT EXISTS idx_sii_product_batch
  ON public.sales_invoice_items (tenant_id, product_id, batch_number);

-- ============================================================
-- 4. Idempotency keys on sales_invoices and payments
-- ============================================================
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_idempotency
  ON public.sales_invoices (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency
  ON public.payments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 5. Posted-document immutability
--    Once a sales or purchase invoice is posted (paid/partial/dispatched/approved),
--    block direct UPDATE of money fields. status change to 'voided' must come via
--    void_document() — which raises status from active to voided in one path; here
--    we permit voided transitions only when accompanied by void_reason + voided_at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_posted_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_posted text[] := ARRAY['paid','partial','dispatched','approved'];
BEGIN
  -- If the OLD row was not posted, allow.
  IF NOT (COALESCE(OLD.status,'') = ANY(v_posted)) THEN
    RETURN NEW;
  END IF;

  -- Voiding is the only legal mutation; require void_reason + voided_at to be set.
  IF COALESCE(OLD.status,'') = ANY(v_posted) AND NEW.status = 'voided' THEN
    IF NEW.void_reason IS NULL OR NEW.voided_at IS NULL THEN
      RAISE EXCEPTION 'Posted document can only be voided via void_document() (with reason and timestamp).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Allow amount_paid to drift via payment triggers (re-allocation does this).
  -- Block changes to monetary identity fields.
  IF TG_TABLE_NAME = 'sales_invoices' THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.subtotal   IS DISTINCT FROM OLD.subtotal
       OR NEW.gst_amount IS DISTINCT FROM OLD.gst_amount
       OR NEW.discount   IS DISTINCT FROM OLD.discount
       OR NEW.total      IS DISTINCT FROM OLD.total
       OR NEW.date       IS DISTINCT FROM OLD.date
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
    THEN
      RAISE EXCEPTION 'Posted sales invoice cannot be edited. Void it (within grace window) and re-issue.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF TG_TABLE_NAME = 'purchase_invoices' THEN
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.subtotal   IS DISTINCT FROM OLD.subtotal
       OR NEW.gst        IS DISTINCT FROM OLD.gst
       OR NEW.wht_amount IS DISTINCT FROM OLD.wht_amount
       OR NEW.total      IS DISTINCT FROM OLD.total
       OR NEW.date       IS DISTINCT FROM OLD.date
       OR NEW.bill_number IS DISTINCT FROM OLD.bill_number
    THEN
      RAISE EXCEPTION 'Posted purchase invoice cannot be edited. Void it (within grace window) and re-issue.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_posted_sales_invoices ON public.sales_invoices;
CREATE TRIGGER trg_enforce_posted_sales_invoices
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_posted_immutability();

DROP TRIGGER IF EXISTS trg_enforce_posted_purchase_invoices ON public.purchase_invoices;
CREATE TRIGGER trg_enforce_posted_purchase_invoices
  BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_posted_immutability();

-- ============================================================
-- 6. Sales-agent row-level scoping
--    Existing permissive tenant_* policies already check tenant_id;
--    we ADD restrictive policies so a sales_agent only sees rows
--    whose customer/party is assigned to them via is_agent_customer().
-- ============================================================

-- helper that returns true for any non-agent role
CREATE OR REPLACE FUNCTION public.agent_can_see_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role public.tenant_role;
BEGIN
  v_role := public.current_tenant_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role <> 'sales_agent' THEN RETURN true; END IF;
  IF p_customer_id IS NULL THEN RETURN false; END IF;
  RETURN public.is_agent_customer(p_customer_id);
END $$;

-- Drop and recreate to be idempotent.
DROP POLICY IF EXISTS agent_scope_sales_invoices ON public.sales_invoices;
CREATE POLICY agent_scope_sales_invoices ON public.sales_invoices
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(customer_id));

DROP POLICY IF EXISTS agent_scope_sales_returns ON public.sales_returns;
CREATE POLICY agent_scope_sales_returns ON public.sales_returns
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(customer_id));

DROP POLICY IF EXISTS agent_scope_delivery_notes ON public.delivery_notes;
CREATE POLICY agent_scope_delivery_notes ON public.delivery_notes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(customer_id));

DROP POLICY IF EXISTS agent_scope_proforma_invoices ON public.proforma_invoices;
CREATE POLICY agent_scope_proforma_invoices ON public.proforma_invoices
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(customer_id));

DROP POLICY IF EXISTS agent_scope_warranty_invoices ON public.warranty_invoices;
CREATE POLICY agent_scope_warranty_invoices ON public.warranty_invoices
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(customer_id));

-- Payments: limit by customer when party_type='customer'; suppliers/printers hidden from agents entirely.
DROP POLICY IF EXISTS agent_scope_payments ON public.payments;
CREATE POLICY agent_scope_payments ON public.payments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    CASE
      WHEN public.current_tenant_role() = 'sales_agent' THEN
        party_type = 'customer' AND public.is_agent_customer(party_id)
      ELSE true
    END
  );

-- Customers: agents see only their assigned customers.
DROP POLICY IF EXISTS agent_scope_customers ON public.customers;
CREATE POLICY agent_scope_customers ON public.customers
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.agent_can_see_customer(id));
