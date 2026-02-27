
-- 1. Purchase Proformas
CREATE TABLE public.purchase_proformas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  validity_days integer NOT NULL DEFAULT 30,
  subtotal numeric NOT NULL DEFAULT 0,
  gst numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  converted_po_id uuid REFERENCES public.purchase_orders(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_proformas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select purchase_proformas" ON public.purchase_proformas FOR SELECT USING (true);
CREATE POLICY "Auth insert purchase_proformas" ON public.purchase_proformas FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update purchase_proformas" ON public.purchase_proformas FOR UPDATE USING (true);
CREATE POLICY "Auth delete purchase_proformas" ON public.purchase_proformas FOR DELETE USING (true);

-- 2. Purchase Proforma Items
CREATE TABLE public.purchase_proforma_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_id uuid NOT NULL REFERENCES public.purchase_proformas(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity_requested numeric NOT NULL DEFAULT 0,
  quantity_confirmed numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.purchase_proforma_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select purchase_proforma_items" ON public.purchase_proforma_items FOR SELECT USING (true);
CREATE POLICY "Auth insert purchase_proforma_items" ON public.purchase_proforma_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update purchase_proforma_items" ON public.purchase_proforma_items FOR UPDATE USING (true);
CREATE POLICY "Auth delete purchase_proforma_items" ON public.purchase_proforma_items FOR DELETE USING (true);

-- 3. Additional Costs
CREATE TABLE public.additional_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  cost_type text NOT NULL DEFAULT 'other',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.suppliers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.additional_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select additional_costs" ON public.additional_costs FOR SELECT USING (true);
CREATE POLICY "Auth insert additional_costs" ON public.additional_costs FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update additional_costs" ON public.additional_costs FOR UPDATE USING (true);
CREATE POLICY "Auth delete additional_costs" ON public.additional_costs FOR DELETE USING (true);

-- 4. Purchase Returns
CREATE TABLE public.purchase_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_invoice_id uuid REFERENCES public.purchase_invoices(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select purchase_returns" ON public.purchase_returns FOR SELECT USING (true);
CREATE POLICY "Auth insert purchase_returns" ON public.purchase_returns FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update purchase_returns" ON public.purchase_returns FOR UPDATE USING (true);
CREATE POLICY "Auth delete purchase_returns" ON public.purchase_returns FOR DELETE USING (true);

-- 5. Purchase Return Items
CREATE TABLE public.purchase_return_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  batch_number text,
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select purchase_return_items" ON public.purchase_return_items FOR SELECT USING (true);
CREATE POLICY "Auth insert purchase_return_items" ON public.purchase_return_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update purchase_return_items" ON public.purchase_return_items FOR UPDATE USING (true);
CREATE POLICY "Auth delete purchase_return_items" ON public.purchase_return_items FOR DELETE USING (true);

-- 6. Sales Return Items
CREATE TABLE public.sales_return_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  batch_number text,
  quantity numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select sales_return_items" ON public.sales_return_items FOR SELECT USING (true);
CREATE POLICY "Auth insert sales_return_items" ON public.sales_return_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update sales_return_items" ON public.sales_return_items FOR UPDATE USING (true);
CREATE POLICY "Auth delete sales_return_items" ON public.sales_return_items FOR DELETE USING (true);

-- 7. Alter existing tables
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS proforma_id uuid REFERENCES public.purchase_proformas(id);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS quantity_confirmed numeric NOT NULL DEFAULT 0;
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);
ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS payment_instructions text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS area text;
