-- 1. Supplier license expiry
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS license_expiry_date date;

-- 2. PO items: batch & expiry (captured at Approve step)
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- 3. purchase_proforma_items as well (so they carry through from proforma → PO)
ALTER TABLE public.purchase_proforma_items
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date;
