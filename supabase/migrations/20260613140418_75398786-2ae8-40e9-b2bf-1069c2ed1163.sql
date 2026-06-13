
-- Warranty Note: customer warranty fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS warranty_address text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_expiry date;

-- Warranty Note: company stamp / signature / footer / template tokens
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS warranty_stamp_url text,
  ADD COLUMN IF NOT EXISTS warranty_signature_url text,
  ADD COLUMN IF NOT EXISTS warranty_footer_text text;

-- Warranty Note: snapshot fields so historical notes are immutable
ALTER TABLE public.warranty_invoices
  ADD COLUMN IF NOT EXISTS sales_rep_name text,
  ADD COLUMN IF NOT EXISTS sales_rep_father_name text,
  ADD COLUMN IF NOT EXISTS sales_rep_cnic text,
  ADD COLUMN IF NOT EXISTS sales_rep_gender text,
  ADD COLUMN IF NOT EXISTS agent_license_number text,
  ADD COLUMN IF NOT EXISTS agent_license_expiry date,
  ADD COLUMN IF NOT EXISTS rep_signature_url text,
  ADD COLUMN IF NOT EXISTS rep_stamp_url text,
  ADD COLUMN IF NOT EXISTS company_stamp_url text,
  ADD COLUMN IF NOT EXISTS company_signature_url text,
  ADD COLUMN IF NOT EXISTS customer_warranty_address text,
  ADD COLUMN IF NOT EXISTS customer_license_number text,
  ADD COLUMN IF NOT EXISTS customer_license_expiry date,
  ADD COLUMN IF NOT EXISTS customer_ntn text,
  ADD COLUMN IF NOT EXISTS customer_cnic text,
  ADD COLUMN IF NOT EXISTS customer_mobile text,
  ADD COLUMN IF NOT EXISTS declaration_text_snapshot text,
  ADD COLUMN IF NOT EXISTS created_by_name text;
