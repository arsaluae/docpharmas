
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_gst_rate numeric NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS wht_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_wht_rate numeric NOT NULL DEFAULT 4.5;
