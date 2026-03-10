INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-documents', 'shared-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload shared documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shared-documents');

CREATE POLICY "Public can read shared documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'shared-documents');

CREATE POLICY "Authenticated users can delete shared documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shared-documents');