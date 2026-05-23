-- Phase A: Immutable audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  user_email text,
  user_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_number text,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_created ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Auto-fill tenant_id from helper if NULL
CREATE TRIGGER set_audit_log_tenant
BEFORE INSERT ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Anyone authenticated in this tenant can insert (and we set user_id from auth.uid())
CREATE POLICY tenant_insert_audit_log ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

-- Tenant members can read their own tenant's logs
CREATE POLICY tenant_select_audit_log ON public.audit_log
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'admin'::app_role));

-- NO UPDATE POLICY (audit log is immutable)
-- NO DELETE POLICY (audit log is immutable)

-- Hard guard: block UPDATE/DELETE at trigger level even if a policy were ever added
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable; % operation is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();