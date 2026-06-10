ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS auto_create_missing_suppliers boolean NOT NULL DEFAULT false;