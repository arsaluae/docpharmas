
CREATE TABLE public.print_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  print_job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  qty_dispatched numeric NOT NULL CHECK (qty_dispatched > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_dispatches TO authenticated;
GRANT ALL ON public.print_dispatches TO service_role;

ALTER TABLE public.print_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_read" ON public.print_dispatches AS RESTRICTIVE FOR SELECT TO authenticated
  USING (current_user_can('purchase','read'));
CREATE POLICY "rbac_write" ON public.print_dispatches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_can('purchase','write'));
CREATE POLICY "rbac_update" ON public.print_dispatches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (current_user_can('purchase','write')) WITH CHECK (current_user_can('purchase','write'));
CREATE POLICY "rbac_delete" ON public.print_dispatches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (current_user_can('purchase','write'));

CREATE POLICY "tenant_select_print_dispatches" ON public.print_dispatches FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_insert_print_dispatches" ON public.print_dispatches FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_update_print_dispatches" ON public.print_dispatches FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_delete_print_dispatches" ON public.print_dispatches FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER set_tenant_id_print_dispatches BEFORE INSERT ON public.print_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE INDEX idx_print_dispatches_job ON public.print_dispatches(print_job_id);
CREATE INDEX idx_print_dispatches_supplier ON public.print_dispatches(supplier_id);

-- Roll up dispatches into print_jobs.quantity_dispatched_to_supplier
CREATE OR REPLACE FUNCTION public.aggregate_print_dispatches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id uuid; v_total numeric;
BEGIN
  v_job_id := COALESCE(NEW.print_job_id, OLD.print_job_id);
  SELECT COALESCE(SUM(qty_dispatched),0) INTO v_total
    FROM public.print_dispatches WHERE print_job_id = v_job_id;
  UPDATE public.print_jobs SET quantity_dispatched_to_supplier = v_total WHERE id = v_job_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_aggregate_print_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON public.print_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_print_dispatches();
