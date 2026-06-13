-- =========================================================================
-- Phase 4 — Stock & Ledger Trigger Hardening
-- =========================================================================

-- 1) handle_stock_movement: add UPDATE handler (reverse OLD, apply NEW)
CREATE OR REPLACE FUNCTION public.handle_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse OLD
    IF OLD.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      UPDATE products SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.product_id;
    ELSIF OLD.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    -- Apply NEW
    IF NEW.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      UPDATE products SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.product_id;
    ELSIF OLD.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_stock_movement
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_movement();


-- 2) prevent_negative_stock: also runs on UPDATE
CREATE OR REPLACE FUNCTION public.prevent_negative_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current numeric;
  v_old_signed numeric := 0;
  v_new_signed numeric := 0;
BEGIN
  -- Only care if NEW is OUT (or, for UPDATE, OLD was OUT) — the only paths that can drive stock negative.
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type NOT IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      RETURN NEW;
    END IF;
    SELECT stock_quantity INTO v_current FROM products WHERE id = NEW.product_id;
    IF COALESCE(v_current,0) - NEW.quantity < 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %: on-hand %, requested %', NEW.product_id, v_current, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Compute delta if it would drop stock below zero. Use signed quantities.
    IF OLD.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      v_old_signed := -OLD.quantity;
    ELSIF OLD.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      v_old_signed := OLD.quantity;
    END IF;
    IF NEW.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
      v_new_signed := -NEW.quantity;
    ELSIF NEW.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN
      v_new_signed := NEW.quantity;
    END IF;
    -- current stock already includes v_old_signed; we want stock - v_old_signed + v_new_signed >= 0
    SELECT stock_quantity INTO v_current FROM products WHERE id = NEW.product_id;
    IF COALESCE(v_current,0) - v_old_signed + v_new_signed < 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product % after update: would go negative', NEW.product_id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON public.stock_movements;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_stock();


-- 3) handle_payment_balance: add UPDATE handler
CREATE OR REPLACE FUNCTION public.handle_payment_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sign numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.party_type = 'customer' THEN
      v_sign := CASE WHEN NEW.type = 'received' THEN -1 ELSE 1 END;
      UPDATE customers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'supplier' THEN
      v_sign := CASE WHEN NEW.type = 'made' THEN -1 ELSE 1 END;
      UPDATE suppliers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'printer' THEN
      v_sign := CASE WHEN NEW.type = 'made' THEN -1 ELSE 1 END;
      UPDATE printers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    END IF;
    IF NEW.bank_account_id IS NOT NULL THEN
      v_sign := CASE WHEN NEW.type = 'received' THEN 1 ELSE -1 END;
      UPDATE bank_accounts SET balance = balance + v_sign * NEW.amount WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse OLD
    IF OLD.party_type = 'customer' THEN
      v_sign := CASE WHEN OLD.type = 'received' THEN 1 ELSE -1 END;
      UPDATE customers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'supplier' THEN
      v_sign := CASE WHEN OLD.type = 'made' THEN 1 ELSE -1 END;
      UPDATE suppliers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'printer' THEN
      v_sign := CASE WHEN OLD.type = 'made' THEN 1 ELSE -1 END;
      UPDATE printers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    END IF;
    IF OLD.bank_account_id IS NOT NULL THEN
      v_sign := CASE WHEN OLD.type = 'received' THEN -1 ELSE 1 END;
      UPDATE bank_accounts SET balance = balance + v_sign * OLD.amount WHERE id = OLD.bank_account_id;
    END IF;
    -- Apply NEW
    IF NEW.party_type = 'customer' THEN
      v_sign := CASE WHEN NEW.type = 'received' THEN -1 ELSE 1 END;
      UPDATE customers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'supplier' THEN
      v_sign := CASE WHEN NEW.type = 'made' THEN -1 ELSE 1 END;
      UPDATE suppliers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    ELSIF NEW.party_type = 'printer' THEN
      v_sign := CASE WHEN NEW.type = 'made' THEN -1 ELSE 1 END;
      UPDATE printers SET balance = balance + v_sign * NEW.amount WHERE id = NEW.party_id;
    END IF;
    IF NEW.bank_account_id IS NOT NULL THEN
      v_sign := CASE WHEN NEW.type = 'received' THEN 1 ELSE -1 END;
      UPDATE bank_accounts SET balance = balance + v_sign * NEW.amount WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.party_type = 'customer' THEN
      v_sign := CASE WHEN OLD.type = 'received' THEN 1 ELSE -1 END;
      UPDATE customers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'supplier' THEN
      v_sign := CASE WHEN OLD.type = 'made' THEN 1 ELSE -1 END;
      UPDATE suppliers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    ELSIF OLD.party_type = 'printer' THEN
      v_sign := CASE WHEN OLD.type = 'made' THEN 1 ELSE -1 END;
      UPDATE printers SET balance = balance + v_sign * OLD.amount WHERE id = OLD.party_id;
    END IF;
    IF OLD.bank_account_id IS NOT NULL THEN
      v_sign := CASE WHEN OLD.type = 'received' THEN -1 ELSE 1 END;
      UPDATE bank_accounts SET balance = balance + v_sign * OLD.amount WHERE id = OLD.bank_account_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_payment_balance ON public.payments;
CREATE TRIGGER trg_payment_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_balance();


-- 4) Auto-create return_in / return_out stock movements from return items.
--    NOT EXISTS guard prevents double-counting when app code (e.g. SalesReturns.tsx)
--    has already inserted the movement.
CREATE OR REPLACE FUNCTION public.handle_sales_return_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_return_date date;
  v_return_number text;
BEGIN
  IF NEW.product_id IS NULL OR COALESCE(NEW.quantity,0) <= 0 THEN
    RETURN NEW;
  END IF;
  -- Skip if a movement for this return + product already exists (app pre-inserted it)
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'sales_return'
      AND reference_id = NEW.return_id
      AND product_id = NEW.product_id
      AND COALESCE(batch_number,'') = COALESCE(NEW.batch_number,'')
  ) THEN
    RETURN NEW;
  END IF;
  SELECT date, return_number INTO v_return_date, v_return_number FROM sales_returns WHERE id = NEW.return_id;
  INSERT INTO stock_movements(product_id, quantity, movement_type, batch_number, reference_type, reference_id, date, notes)
  VALUES (NEW.product_id, NEW.quantity, 'return_in', NEW.batch_number, 'sales_return', NEW.return_id,
          COALESCE(v_return_date, CURRENT_DATE), 'Sales Return ' || COALESCE(v_return_number, ''));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sales_return_stock ON public.sales_return_items;
CREATE TRIGGER trg_sales_return_stock
  AFTER INSERT ON public.sales_return_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_return_stock();


CREATE OR REPLACE FUNCTION public.handle_purchase_return_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_return_date date;
  v_return_number text;
BEGIN
  IF NEW.product_id IS NULL OR COALESCE(NEW.quantity,0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'purchase_return'
      AND reference_id = NEW.return_id
      AND product_id = NEW.product_id
      AND COALESCE(batch_number,'') = COALESCE(NEW.batch_number,'')
  ) THEN
    RETURN NEW;
  END IF;
  SELECT date, return_number INTO v_return_date, v_return_number FROM purchase_returns WHERE id = NEW.return_id;
  INSERT INTO stock_movements(product_id, quantity, movement_type, batch_number, reference_type, reference_id, date, notes)
  VALUES (NEW.product_id, NEW.quantity, 'return_out', NEW.batch_number, 'purchase_return', NEW.return_id,
          COALESCE(v_return_date, CURRENT_DATE), 'Purchase Return ' || COALESCE(v_return_number, ''));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_purchase_return_stock ON public.purchase_return_items;
CREATE TRIGGER trg_purchase_return_stock
  AFTER INSERT ON public.purchase_return_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_return_stock();


-- 5) Rebuild agent_batch_availability so it nets returns, damage, expired by
--    deriving availability from stock_movements (the true source of truth) instead
--    of just (grn_items − sales_invoice_items).
DROP VIEW IF EXISTS public.agent_batch_availability;
CREATE VIEW public.agent_batch_availability AS
SELECT
  g.tenant_id,
  g.product_id,
  p.product_code,
  p.name AS product_name,
  g.batch_number,
  g.expiry_date,
  GREATEST(
    COALESCE((
      SELECT SUM(CASE
        WHEN sm.movement_type IN ('purchase','purchase_in','return_in','adjustment_in','opening') THEN sm.quantity
        WHEN sm.movement_type IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN -sm.quantity
        ELSE 0
      END)
      FROM stock_movements sm
      WHERE sm.product_id = g.product_id
        AND sm.batch_number = g.batch_number
        AND sm.tenant_id = g.tenant_id
    ), 0),
    0
  ) AS available_qty,
  CASE
    WHEN g.expiry_date IS NULL THEN 'none'
    WHEN g.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN g.expiry_date < (CURRENT_DATE + 30) THEN 'critical'
    WHEN g.expiry_date < (CURRENT_DATE + 90) THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,
  p.selling_price
FROM grn_items g
JOIN products p ON p.id = g.product_id
WHERE g.tenant_id = get_user_tenant_id()
GROUP BY g.tenant_id, g.product_id, p.product_code, p.name, g.batch_number, g.expiry_date, p.selling_price;

GRANT SELECT ON public.agent_batch_availability TO authenticated;
GRANT ALL    ON public.agent_batch_availability TO service_role;