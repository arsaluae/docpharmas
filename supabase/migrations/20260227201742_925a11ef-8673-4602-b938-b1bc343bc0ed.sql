
-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  fbr_enabled boolean NOT NULL DEFAULT false,
  ntn text,
  strn text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select company_settings" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Auth insert company_settings" ON public.company_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update company_settings" ON public.company_settings FOR UPDATE USING (true);
CREATE POLICY "Auth delete company_settings" ON public.company_settings FOR DELETE USING (true);

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create delivery_notes table
CREATE TABLE public.delivery_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dn_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  customer_id uuid,
  supplier_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'issued',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select delivery_notes" ON public.delivery_notes FOR SELECT USING (true);
CREATE POLICY "Auth insert delivery_notes" ON public.delivery_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update delivery_notes" ON public.delivery_notes FOR UPDATE USING (true);
CREATE POLICY "Auth delete delivery_notes" ON public.delivery_notes FOR DELETE USING (true);

-- Create company-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

CREATE POLICY "Public read company-assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Auth upload company-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Auth update company-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets');
CREATE POLICY "Auth delete company-assets" ON storage.objects FOR DELETE USING (bucket_id = 'company-assets');
