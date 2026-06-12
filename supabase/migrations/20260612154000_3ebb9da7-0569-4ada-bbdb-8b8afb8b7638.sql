
ALTER TABLE public.sales_agents ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')) DEFAULT NULL;

-- Soft-reset the default declaration only when it still equals the previous default
UPDATE public.company_settings
SET warranty_note_text = NULL
WHERE warranty_note_text IS NOT NULL
  AND warranty_note_text LIKE 'It is hereby certified that the following finished products have been supplied by me.%';
