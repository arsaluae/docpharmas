-- Phase 2 — Stop the bleeding
-- 1) Drop duplicate credit-note balance trigger (keep trg_credit_note_balance)
DROP TRIGGER IF EXISTS credit_note_balance_trigger ON public.credit_notes;

-- 2) Ensure products.is_active defaults to true and backfill NULLs so existing
--    pickers (which filter .eq("is_active", true)) stop hiding manually-added products
ALTER TABLE public.products ALTER COLUMN is_active SET DEFAULT true;
UPDATE public.products SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.products ALTER COLUMN is_active SET NOT NULL;