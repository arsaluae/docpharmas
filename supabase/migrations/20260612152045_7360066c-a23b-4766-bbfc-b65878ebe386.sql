
-- Warranty Declaration: enable/disable toggle + default content stays on company_settings.warranty_note_text
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS warranty_declaration_enabled BOOLEAN NOT NULL DEFAULT true;

-- Sales rep / agent profile fields for warranty declaration
ALTER TABLE public.sales_agents
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS cnic TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry DATE,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS stamp_url TEXT;

-- Link a warranty invoice to the signing sales representative
ALTER TABLE public.warranty_invoices
  ADD COLUMN IF NOT EXISTS sales_agent_id UUID REFERENCES public.sales_agents(id) ON DELETE SET NULL;
