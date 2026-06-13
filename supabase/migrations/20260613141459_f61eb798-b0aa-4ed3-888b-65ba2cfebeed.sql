ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS warranty_show_company_stamp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_rep_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_prepared_by boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_agent_license_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_agent_license_expiry boolean NOT NULL DEFAULT true;