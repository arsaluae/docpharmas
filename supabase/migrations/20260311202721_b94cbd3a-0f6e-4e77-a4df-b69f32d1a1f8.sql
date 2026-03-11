
DROP POLICY "tenant_select_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_insert_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_update_customer_distributors" ON public.customer_distributors;
DROP POLICY "tenant_delete_customer_distributors" ON public.customer_distributors;

CREATE POLICY "tenant_select_customer_distributors" ON public.customer_distributors
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_insert_customer_distributors" ON public.customer_distributors
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_update_customer_distributors" ON public.customer_distributors
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tenant_delete_customer_distributors" ON public.customer_distributors
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));
