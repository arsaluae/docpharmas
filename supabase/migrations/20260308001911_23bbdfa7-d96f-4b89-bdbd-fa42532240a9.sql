
-- Add whatsapp_number to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Create reorder_alerts table
CREATE TABLE public.reorder_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  current_stock numeric NOT NULL DEFAULT 0,
  avg_daily_consumption numeric NOT NULL DEFAULT 0,
  days_until_stockout numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info',
  notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "tenant_select_reorder_alerts" ON public.reorder_alerts FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_insert_reorder_alerts" ON public.reorder_alerts FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_update_reorder_alerts" ON public.reorder_alerts FOR UPDATE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tenant_delete_reorder_alerts" ON public.reorder_alerts FOR DELETE TO authenticated USING ((tenant_id = get_user_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));

-- Auto-set tenant_id trigger
CREATE TRIGGER set_tenant_id_reorder_alerts BEFORE INSERT ON public.reorder_alerts FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
