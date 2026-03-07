
-- Fix #1: Drop the duplicate trigger that causes DOUBLE stock deduction on sales
DROP TRIGGER IF EXISTS trg_sales_item_stock ON public.sales_invoice_items;

-- Fix #2: Update handle_stock_movement to recognize 'purchase_in' as an inbound type
CREATE OR REPLACE FUNCTION public.handle_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type IN ('purchase', 'purchase_in', 'return_in', 'adjustment_in', 'opening') THEN
      UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type IN ('sale', 'sale_out', 'return_out', 'adjustment_out', 'damage', 'expired') THEN
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.movement_type IN ('purchase', 'purchase_in', 'return_in', 'adjustment_in', 'opening') THEN
      UPDATE products SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.product_id;
    ELSIF OLD.movement_type IN ('sale', 'sale_out', 'return_out', 'adjustment_out', 'damage', 'expired') THEN
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
