
-- 1. customer_contacts table
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  designation text,
  mobile text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_tenant_all" ON public.customer_contacts;
CREATE POLICY "cc_tenant_all" ON public.customer_contacts FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS set_tenant_customer_contacts ON public.customer_contacts;
CREATE TRIGGER set_tenant_customer_contacts BEFORE INSERT ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS update_customer_contacts_updated_at ON public.customer_contacts;
CREATE TRIGGER update_customer_contacts_updated_at BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON public.customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_tenant_mobile ON public.customer_contacts(tenant_id, mobile);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_tenant_email ON public.customer_contacts(tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_contacts_one_primary
  ON public.customer_contacts(customer_id) WHERE is_primary = true;

-- 2. Optional contact_id link on documents
ALTER TABLE public.sales_invoices    ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_notes    ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.payments          ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
