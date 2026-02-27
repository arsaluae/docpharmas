
-- Warranty Invoices table
CREATE TABLE public.warranty_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warranty_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  pharmacy_name TEXT NOT NULL,
  pharmacy_address TEXT,
  pharmacy_license_no TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warranty_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select warranty_invoices" ON public.warranty_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert warranty_invoices" ON public.warranty_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update warranty_invoices" ON public.warranty_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete warranty_invoices" ON public.warranty_invoices FOR DELETE TO authenticated USING (true);

-- Customer Licenses table
CREATE TABLE public.customer_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'drug_license',
  expiry_date DATE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select customer_licenses" ON public.customer_licenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert customer_licenses" ON public.customer_licenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update customer_licenses" ON public.customer_licenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete customer_licenses" ON public.customer_licenses FOR DELETE TO authenticated USING (true);
