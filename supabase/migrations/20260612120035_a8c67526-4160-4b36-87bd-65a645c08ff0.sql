
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS show_customer_mobile_on_docs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_customer_phone_on_docs  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_supplier_mobile_on_docs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_supplier_phone_on_docs  boolean NOT NULL DEFAULT false;
