
-- Create document_templates table
CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type text NOT NULL UNIQUE,
  title text NOT NULL,
  columns_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_total_in_words boolean NOT NULL DEFAULT false,
  show_bank_details boolean NOT NULL DEFAULT false,
  bank_details_text text DEFAULT '',
  footer_text text DEFAULT '',
  signature_labels jsonb NOT NULL DEFAULT '["Prepared By", "Authorized Signature"]'::jsonb,
  show_party_area boolean NOT NULL DEFAULT false,
  show_party_license boolean NOT NULL DEFAULT false,
  show_party_cnic boolean NOT NULL DEFAULT false,
  extra_meta_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can CRUD
CREATE POLICY "Auth select document_templates" ON public.document_templates FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Auth insert document_templates" ON public.document_templates FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Auth update document_templates" ON public.document_templates FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Auth delete document_templates" ON public.document_templates FOR DELETE USING (public.is_authenticated());
