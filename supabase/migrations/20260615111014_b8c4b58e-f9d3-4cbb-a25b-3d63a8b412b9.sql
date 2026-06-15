
-- Warranty Invoice Module: new template-driven schema additions
-- Adds per-invoice rich notes + new template configuration on company_settings.

ALTER TABLE public.warranty_invoices
  ADD COLUMN IF NOT EXISTS notes_html text,
  ADD COLUMN IF NOT EXISTS show_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stamp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signature_url_override text,
  ADD COLUMN IF NOT EXISTS stamp_url_override text,
  ADD COLUMN IF NOT EXISTS total_in_words text,
  ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS warranty_notes_template_html text,
  ADD COLUMN IF NOT EXISTS warranty_show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_company_details boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_page_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_show_system_note boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_doc_title text NOT NULL DEFAULT 'WARRANTY INVOICE';
