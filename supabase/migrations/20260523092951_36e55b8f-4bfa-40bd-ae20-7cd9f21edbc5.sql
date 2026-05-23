
-- 1. company-assets: tenant-scoped writes
DROP POLICY IF EXISTS "Auth upload company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth update company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete company-assets" ON storage.objects;

CREATE POLICY "Tenant upload company-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Tenant update company-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Tenant delete company-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

-- 2. shared-documents: tenant-scoped writes
DROP POLICY IF EXISTS "Authenticated users can upload shared documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shared documents" ON storage.objects;

CREATE POLICY "Tenant upload shared-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shared-documents'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Tenant delete shared-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shared-documents'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

-- 3. payment-screenshots: tenant-scoped read & write
DROP POLICY IF EXISTS auth_upload_payment_screenshots ON storage.objects;
DROP POLICY IF EXISTS auth_select_payment_screenshots ON storage.objects;

CREATE POLICY "Tenant upload payment-screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Tenant select payment-screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (
      (storage.foldername(name))[1] = public.get_user_tenant_id()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- 4. payment_submissions: limit to authenticated role
DROP POLICY IF EXISTS tenant_select_payment_submissions ON public.payment_submissions;
DROP POLICY IF EXISTS tenant_insert_payment_submissions ON public.payment_submissions;
DROP POLICY IF EXISTS admin_update_payment_submissions ON public.payment_submissions;

CREATE POLICY tenant_select_payment_submissions ON public.payment_submissions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY tenant_insert_payment_submissions ON public.payment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY admin_update_payment_submissions ON public.payment_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Make get_user_tenant_id deterministic
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY created_at ASC, tenant_id ASC
  LIMIT 1
$$;
