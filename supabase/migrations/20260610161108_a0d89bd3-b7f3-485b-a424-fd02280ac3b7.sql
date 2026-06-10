
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS old_erp_account_code text,
  ADD COLUMN IF NOT EXISTS cnic text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS old_erp_account_code text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS legacy_codes jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_legacy_code_key
  ON public.customers (tenant_id, lower(old_erp_account_code))
  WHERE old_erp_account_code IS NOT NULL AND length(trim(old_erp_account_code)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_tenant_legacy_code_key
  ON public.suppliers (tenant_id, lower(old_erp_account_code))
  WHERE old_erp_account_code IS NOT NULL AND length(trim(old_erp_account_code)) > 0;
