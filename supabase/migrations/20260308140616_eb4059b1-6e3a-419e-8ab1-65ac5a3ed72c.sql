-- Fix purchase_orders: add 'confirmed' status
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check 
  CHECK (status IN ('draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'));

-- Fix sales_invoices: add 'dispatched' status
ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_status_check;
ALTER TABLE public.sales_invoices ADD CONSTRAINT sales_invoices_status_check 
  CHECK (status IN ('draft', 'sent', 'dispatched', 'partial', 'paid', 'overdue', 'cancelled'));