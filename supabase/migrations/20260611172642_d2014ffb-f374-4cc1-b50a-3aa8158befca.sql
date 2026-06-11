
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_type text NOT NULL,
  template_name text NOT NULL,
  message_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_tpl_select_tenant" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "wa_tpl_insert_admin" ON public.whatsapp_templates
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.current_user_can('settings','write'));

CREATE POLICY "wa_tpl_update_admin" ON public.whatsapp_templates
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.current_user_can('settings','write'))
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.current_user_can('settings','write'));

CREATE POLICY "wa_tpl_delete_admin" ON public.whatsapp_templates
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.current_user_can('settings','write'));

CREATE TRIGGER set_tenant_id_whatsapp_templates
  BEFORE INSERT ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
