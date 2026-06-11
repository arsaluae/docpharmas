
-- Part A: courier link on expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS freight_provider_id uuid
  REFERENCES public.freight_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_freight_provider
  ON public.expenses (tenant_id, freight_provider_id, date)
  WHERE freight_provider_id IS NOT NULL;

-- Seed NCCS + ADDA for every tenant, idempotent
INSERT INTO public.freight_providers (tenant_id, name, code, is_active)
SELECT t.id, v.name, v.code, true
FROM public.tenants t
CROSS JOIN (VALUES ('NCCS','NCCS'), ('ADDA','ADDA')) AS v(name, code)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Part B: clarify MRP semantics
COMMENT ON COLUMN public.products.mrp IS
  'Market Retail Price — display only, printed on invoices for reference. Never used in ledger, tax, COGS, or any calculation. All math uses selling_price (UI labelled "Net Price").';
