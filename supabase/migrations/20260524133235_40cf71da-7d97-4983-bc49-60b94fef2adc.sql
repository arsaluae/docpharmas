
-- Auto print allocations
CREATE TABLE public.purchase_print_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  purchase_invoice_id uuid,
  grn_id uuid,
  product_id uuid NOT NULL,
  supplier_id uuid,
  print_job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('at_supplier','at_factory','in_progress')),
  quantity_reserved numeric NOT NULL DEFAULT 0,
  quantity_consumed numeric NOT NULL DEFAULT 0,
  printing_cost_per_unit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ppa_product_supplier ON public.purchase_print_allocations(product_id, supplier_id, status);
CREATE INDEX idx_ppa_po ON public.purchase_print_allocations(purchase_invoice_id);
CREATE INDEX idx_ppa_grn ON public.purchase_print_allocations(grn_id);

ALTER TABLE public.purchase_print_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_ppa ON public.purchase_print_allocations FOR SELECT TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY tenant_insert_ppa ON public.purchase_print_allocations FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY tenant_update_ppa ON public.purchase_print_allocations FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY tenant_delete_ppa ON public.purchase_print_allocations FOR DELETE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER set_tenant_id_ppa BEFORE INSERT ON public.purchase_print_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Trigger: on GRN item insert, consume reserved allocations for (product, supplier of grn)
CREATE OR REPLACE FUNCTION public.consume_print_allocations_on_grn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_supplier uuid;
  v_po uuid;
  v_remaining numeric;
  alloc RECORD;
  v_take numeric;
BEGIN
  IF NEW.product_id IS NULL OR NEW.quantity_received IS NULL OR NEW.quantity_received <= 0 THEN
    RETURN NEW;
  END IF;
  SELECT supplier_id, po_id INTO v_supplier, v_po FROM public.goods_received_notes WHERE id = NEW.grn_id;
  v_remaining := NEW.quantity_received;

  FOR alloc IN
    SELECT * FROM public.purchase_print_allocations
    WHERE product_id = NEW.product_id
      AND status = 'reserved'
      AND (purchase_invoice_id = v_po OR (supplier_id = v_supplier AND purchase_invoice_id IS NULL))
    ORDER BY (purchase_invoice_id = v_po) DESC,
             CASE source WHEN 'at_supplier' THEN 1 WHEN 'at_factory' THEN 2 ELSE 3 END,
             created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, alloc.quantity_reserved - alloc.quantity_consumed);
    IF v_take <= 0 THEN CONTINUE; END IF;

    -- Decrement print_job balances
    IF alloc.source = 'at_factory' THEN
      -- auto-dispatch then consume
      UPDATE public.print_jobs
         SET quantity_dispatched_to_supplier = quantity_dispatched_to_supplier + v_take
       WHERE id = alloc.print_job_id;
    ELSIF alloc.source = 'at_supplier' THEN
      UPDATE public.print_jobs
         SET quantity_dispatched_to_supplier = GREATEST(quantity_dispatched_to_supplier - v_take, 0)
       WHERE id = alloc.print_job_id;
    END IF;

    UPDATE public.purchase_print_allocations
       SET quantity_consumed = quantity_consumed + v_take,
           grn_id = NEW.grn_id,
           status = CASE WHEN quantity_consumed + v_take >= quantity_reserved THEN 'consumed' ELSE 'reserved' END
     WHERE id = alloc.id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_consume_print_allocations_on_grn
  AFTER INSERT ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.consume_print_allocations_on_grn();

-- Release allocations when GRN deleted (void path)
CREATE OR REPLACE FUNCTION public.release_print_allocations_on_grn_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.purchase_print_allocations
     SET status = 'released'
   WHERE grn_id = OLD.id AND status = 'consumed';
  RETURN OLD;
END $$;

CREATE TRIGGER trg_release_print_allocations_on_grn_delete
  BEFORE DELETE ON public.goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION public.release_print_allocations_on_grn_delete();
