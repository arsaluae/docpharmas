
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS warranty_require_mobile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_require_address boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_require_license_no boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_require_license_expiry boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_require_batch_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_require_batch_expiry boolean NOT NULL DEFAULT true;

UPDATE public.company_settings
SET warranty_note_text =
'It is certified that I, Miss UFAQ ISHIAQ D/O Ishtiaq Ahmed, having NIC # 3520-28328903-4, being an authorized agent No. 09-341-0157-041722D valid up to 12-04-2028, on behalf of M/s MOUJ PHARMACEUTICALS:

1. It is hereby certified that the following finished products have been supplied by me.

2. It is hereby certified and I undertake that the above-mentioned finished products of the specified Batch Number supplied by me do not contravene any provision of the Act and rules framed thereunder.

The Authorized Agent shall pass on this warranty to the retailers in his area of jurisdiction during the supply of medicines and health products.'
WHERE warranty_note_text IS NULL OR btrim(warranty_note_text) = '';
