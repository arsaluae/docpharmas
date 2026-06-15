
DROP FUNCTION IF EXISTS public.check_purchase_invoice_lock(uuid);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_reversal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverses_payment_id uuid REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS purchase_edit_auto_update_cost boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_purchase_invoice_lock(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid; v_window int; v_submitted timestamptz; v_locked timestamptz;
BEGIN
  SELECT tenant_id, submitted_at, locked_at INTO v_tenant, v_submitted, v_locked
    FROM public.purchase_invoices WHERE id = p_invoice_id;
  IF v_tenant IS NULL OR v_locked IS NOT NULL THEN RETURN; END IF;
  SELECT COALESCE(purchase_edit_window_days, 30) INTO v_window
    FROM public.company_settings WHERE tenant_id = v_tenant LIMIT 1;
  v_window := COALESCE(v_window, 30);
  IF v_submitted IS NOT NULL AND now() - v_submitted > make_interval(days => v_window) THEN
    UPDATE public.purchase_invoices SET locked_at = now() WHERE id = p_invoice_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_purchase_invoice_lock(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.edit_purchase_bill_line(
  p_invoice_id uuid, p_grn_item_id uuid, p_new_qty numeric, p_new_rate numeric, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid; v_grn_id uuid; v_old_qty numeric; v_old_rate numeric;
  v_product uuid; v_batch text; v_sold numeric; v_delta_qty numeric;
  v_window int; v_submitted timestamptz; v_locked timestamptz;
  v_gst numeric; v_wht numeric; v_new_subtotal numeric; v_new_total numeric;
  v_auto_cost boolean;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required (min 3 chars)';
  END IF;
  SELECT tenant_id, grn_id, submitted_at, locked_at, gst, wht_amount
    INTO v_tenant, v_grn_id, v_submitted, v_locked, v_gst, v_wht
    FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_locked IS NOT NULL THEN RAISE EXCEPTION 'Invoice is locked. Use Purchase Return / Adjustment.'; END IF;
  SELECT COALESCE(purchase_edit_window_days, 30), COALESCE(purchase_edit_auto_update_cost, false)
    INTO v_window, v_auto_cost
    FROM public.company_settings WHERE tenant_id = v_tenant LIMIT 1;
  v_window := COALESCE(v_window, 30);
  IF v_submitted IS NOT NULL AND now() - v_submitted > make_interval(days => v_window) THEN
    UPDATE public.purchase_invoices SET locked_at = now() WHERE id = p_invoice_id;
    RAISE EXCEPTION 'Edit window (% days) expired. Invoice locked.', v_window;
  END IF;
  SELECT product_id, batch_number, quantity_received, rate
    INTO v_product, v_batch, v_old_qty, v_old_rate
    FROM public.grn_items WHERE id = p_grn_item_id AND grn_id = v_grn_id FOR UPDATE;
  IF v_product IS NULL THEN RAISE EXCEPTION 'Line not found on this invoice'; END IF;
  IF p_new_qty < 0 OR p_new_rate < 0 THEN RAISE EXCEPTION 'Quantity / rate must be >= 0'; END IF;
  v_delta_qty := p_new_qty - v_old_qty;
  IF v_delta_qty < 0 THEN
    SELECT COALESCE(SUM(ABS(quantity)), 0) INTO v_sold
      FROM public.stock_movements
      WHERE tenant_id = v_tenant AND product_id = v_product
        AND COALESCE(batch_number,'') = COALESCE(v_batch,'')
        AND movement_type IN ('sale','sale_out','damage','expired')
        AND status = 'active';
    IF p_new_qty < v_sold THEN
      RAISE EXCEPTION 'Cannot reduce received qty to % — % already consumed from batch %. Use Purchase Return or Adjustment.', p_new_qty, v_sold, COALESCE(v_batch,'(no batch)');
    END IF;
  END IF;
  UPDATE public.grn_items
     SET quantity_received = p_new_qty, rate = p_new_rate, amount = p_new_qty * p_new_rate
   WHERE id = p_grn_item_id;
  IF v_delta_qty <> 0 THEN
    INSERT INTO public.stock_movements(
      product_id, movement_type, quantity, batch_number,
      reference_type, reference_id, date, notes, tenant_id, status
    ) VALUES (
      v_product,
      CASE WHEN v_delta_qty > 0 THEN 'adjustment_in' ELSE 'adjustment_out' END,
      v_delta_qty, v_batch, 'purchase_invoice_edit', p_invoice_id, CURRENT_DATE,
      'Bill edit: ' || p_reason, v_tenant, 'active'
    );
  END IF;
  SELECT COALESCE(SUM(quantity_received * rate), 0) INTO v_new_subtotal
    FROM public.grn_items WHERE grn_id = v_grn_id;
  v_new_total := v_new_subtotal + COALESCE(v_gst,0) - COALESCE(v_wht,0);
  UPDATE public.purchase_invoices
     SET subtotal = v_new_subtotal, total = v_new_total,
         edit_count = COALESCE(edit_count,0) + 1,
         submitted_at = COALESCE(submitted_at, now())
   WHERE id = p_invoice_id;
  IF v_auto_cost AND p_new_rate > 0 THEN
    UPDATE public.products SET purchase_cost = p_new_rate WHERE id = v_product;
  END IF;
  INSERT INTO public.audit_log(action, entity_type, entity_id, changes)
  VALUES ('edited', 'purchase_invoice', p_invoice_id,
    jsonb_build_object(
      'grn_item_id', p_grn_item_id,
      'qty', jsonb_build_object('old', v_old_qty, 'new', p_new_qty),
      'rate', jsonb_build_object('old', v_old_rate, 'new', p_new_rate),
      'delta_qty', v_delta_qty, 'reason', p_reason));
  RETURN jsonb_build_object('invoice_id', p_invoice_id, 'subtotal', v_new_subtotal, 'total', v_new_total, 'delta_qty', v_delta_qty);
END;
$$;
GRANT EXECUTE ON FUNCTION public.edit_purchase_bill_line(uuid, uuid, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_payment(p_payment_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_new_id uuid; v_row public.payments%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'Reason is required'; END IF;
  SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_row.is_reversal THEN RAISE EXCEPTION 'Cannot reverse a reversal'; END IF;
  INSERT INTO public.payments(
    tenant_id, payment_number, payment_type, party_type, party_id,
    invoice_id, amount, payment_date, payment_method, reference,
    notes, bank_account_id, is_reversal, reverses_payment_id, reconciled
  ) VALUES (
    v_row.tenant_id, COALESCE(v_row.payment_number,'') || '-REV',
    v_row.payment_type, v_row.party_type, v_row.party_id,
    v_row.invoice_id, -1 * v_row.amount, CURRENT_DATE, v_row.payment_method, v_row.reference,
    'Reversal: ' || p_reason, v_row.bank_account_id, true, v_row.id, false
  ) RETURNING id INTO v_new_id;
  INSERT INTO public.audit_log(action, entity_type, entity_id, changes)
  VALUES ('edited', 'payment', p_payment_id,
    jsonb_build_object('action','reversed','reversal_id', v_new_id, 'amount', v_row.amount, 'reason', p_reason));
  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reverse_payment(uuid, text) TO authenticated;
