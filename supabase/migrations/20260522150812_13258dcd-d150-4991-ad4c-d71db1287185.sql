ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS allotted_supplier_id uuid,
  ADD COLUMN IF NOT EXISTS quantity_dispatched_to_supplier numeric NOT NULL DEFAULT 0;

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS quantity_at_factory numeric
  GENERATED ALWAYS AS (COALESCE(quantity_delivered,0) - COALESCE(quantity_dispatched_to_supplier,0)) STORED;