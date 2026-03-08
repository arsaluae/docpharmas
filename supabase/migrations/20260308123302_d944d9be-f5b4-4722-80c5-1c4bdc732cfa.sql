
-- Add subscription columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';

-- Create payment_submissions table
CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'monthly',
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: tenants see their own submissions
CREATE POLICY "tenant_select_payment_submissions" ON public.payment_submissions
  FOR SELECT USING (
    tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "tenant_insert_payment_submissions" ON public.payment_submissions
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id()
  );

-- Only admins can update (approve/reject)
CREATE POLICY "admin_update_payment_submissions" ON public.payment_submissions
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Auto-set tenant_id trigger
CREATE TRIGGER set_payment_submissions_tenant_id
  BEFORE INSERT ON public.payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their tenant folder
CREATE POLICY "auth_upload_payment_screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');

CREATE POLICY "auth_select_payment_screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots');
