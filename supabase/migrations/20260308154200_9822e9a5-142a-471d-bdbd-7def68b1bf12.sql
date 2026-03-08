-- Fix proforma_invoices.status to include invoiced, ordered, approved
ALTER TABLE public.proforma_invoices DROP CONSTRAINT IF EXISTS proforma_invoices_status_check;
ALTER TABLE public.proforma_invoices ADD CONSTRAINT proforma_invoices_status_check 
  CHECK (status IN ('draft', 'sent', 'converted', 'invoiced', 'ordered', 'approved'));

-- Fix payments.party_type to include printer
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_party_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_party_type_check 
  CHECK (party_type IN ('customer', 'supplier', 'printer'));

-- Fix expenses.category to include all UI categories
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IN ('utilities', 'salaries', 'rent', 'transport', 'maintenance', 'marketing', 'regulatory', 'other', 'travel', 'license_renewal', 'insurance', 'office_supplies', 'communication', 'professional_fees', 'depreciation', 'food', 'personal'));

-- Fix sales_returns.status to include confirmed
ALTER TABLE public.sales_returns DROP CONSTRAINT IF EXISTS sales_returns_status_check;
ALTER TABLE public.sales_returns ADD CONSTRAINT sales_returns_status_check 
  CHECK (status IN ('draft', 'approved', 'processed', 'confirmed'));