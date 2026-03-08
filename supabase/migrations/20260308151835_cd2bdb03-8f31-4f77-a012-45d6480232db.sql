ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
  CHECK (movement_type IN ('purchase', 'purchase_in', 'sale', 'sale_out', 'return_in', 'return_out', 'adjustment', 'adjustment_in', 'adjustment_out', 'opening', 'damage', 'expired'));