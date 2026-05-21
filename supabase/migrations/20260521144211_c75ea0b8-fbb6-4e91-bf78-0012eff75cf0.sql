ALTER TABLE public.customers DROP COLUMN IF EXISTS credit_days;
ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS accepted_at timestamptz;