-- Add index on stock_movements.reference_id for faster void/audit lookups
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON public.stock_movements(reference_id);

-- Add index on stock_movements.product_id for faster stock calculations
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);