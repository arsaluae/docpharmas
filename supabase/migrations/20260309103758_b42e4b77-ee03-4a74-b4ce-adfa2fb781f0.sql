
-- 1. Fix generate_document_number to filter by tenant_id
CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text;
  v_next integer;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_user_tenant_id();
  
  UPDATE document_counters
  SET current_value = current_value + 1
  WHERE document_type = p_document_type
    AND tenant_id = v_tenant_id
  RETURNING prefix, current_value INTO v_prefix, v_next;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown document type: %', p_document_type;
  END IF;

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$function$;

-- 2. Create pending_signups table
CREATE TABLE IF NOT EXISTS public.pending_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  company_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Admins can see all pending signups
CREATE POLICY "admin_select_pending_signups" ON public.pending_signups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update pending signups
CREATE POLICY "admin_update_pending_signups" ON public.pending_signups
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own signup
CREATE POLICY "user_insert_pending_signups" ON public.pending_signups
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can see their own signup
CREATE POLICY "user_select_own_pending_signups" ON public.pending_signups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
