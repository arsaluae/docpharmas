
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  schedule text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  tenants_total int NOT NULL DEFAULT 0,
  tenants_succeeded int NOT NULL DEFAULT 0,
  tenants_failed int NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0,
  results jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_runs_owner_read" ON public.backup_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role = 'owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at ON public.backup_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.require_stock_adjustment_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type IN ('adjustment','adjustment_in','adjustment_out') THEN
    IF NEW.notes IS NULL OR length(trim(NEW.notes)) < 3 THEN
      RAISE EXCEPTION 'Stock adjustment requires a reason (notes, min 3 chars).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_require_stock_adjustment_reason ON public.stock_movements;
CREATE TRIGGER trg_require_stock_adjustment_reason
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.require_stock_adjustment_reason();
