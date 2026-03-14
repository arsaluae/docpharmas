
-- Create private storage bucket for tenant backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-backups', 'tenant-backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to read their tenant's backups
CREATE POLICY "tenant_select_backups" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tenant-backups' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));

-- RLS: Allow authenticated users to download their tenant's backups  
CREATE POLICY "tenant_download_backups" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tenant-backups' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
