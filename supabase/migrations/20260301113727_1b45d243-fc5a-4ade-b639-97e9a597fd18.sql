
-- ============================================================
-- PHASE 1A: Balance & Stock Update Triggers
-- ============================================================

-- 1. PAYMENT TRIGGERS: Update customer/supplier balance + bank account balance
CREATE OR REPLACE FUNCTION public.handle_payment_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update party balance
    IF NEW.party_type = 'customer' THEN
      IF NEW.type = 'received' THEN
        UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSE
        UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    ELSIF NEW.party_type = 'supplier' THEN
      IF NEW.type = 'made' THEN
        UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSE
        UPDATE suppliers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    END IF;
    -- Update bank account balance
    IF NEW.bank_account_id IS NOT NULL THEN
      IF NEW.type = 'received' THEN
        UPDATE bank_accounts SET balance = balance + NEW.amount WHERE id = NEW.bank_account_id;
      ELSE
        UPDATE bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse party balance
    IF OLD.party_type = 'customer' THEN
      IF OLD.type = 'received' THEN
        UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSE
        UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    ELSIF OLD.party_type = 'supplier' THEN
      IF OLD.type = 'made' THEN
        UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSE
        UPDATE suppliers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    -- Reverse bank balance
    IF OLD.bank_account_id IS NOT NULL THEN
      IF OLD.type = 'received' THEN
        UPDATE bank_accounts SET balance = balance - OLD.amount WHERE id = OLD.bank_account_id;
      ELSE
        UPDATE bank_accounts SET balance = balance + OLD.amount WHERE id = OLD.bank_account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_payment_balance
  AFTER INSERT OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_balance();

-- 2. SALES INVOICE TRIGGER: Increase customer balance on create, decrease on delete
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance + NEW.total WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance - OLD.total WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sales_invoice_balance
  AFTER INSERT OR DELETE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_invoice_balance();

-- 3. PURCHASE INVOICE TRIGGER: Increase supplier balance on create
CREATE OR REPLACE FUNCTION public.handle_purchase_invoice_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance + NEW.total WHERE id = NEW.supplier_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance - OLD.total WHERE id = OLD.supplier_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_purchase_invoice_balance
  AFTER INSERT OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_invoice_balance();

-- 4. SALES RETURN TRIGGER: Decrease customer balance (credit note)
CREATE OR REPLACE FUNCTION public.handle_sales_return_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance - NEW.total WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance + OLD.total WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sales_return_balance
  AFTER INSERT OR DELETE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_return_balance();

-- 5. PURCHASE RETURN TRIGGER: Decrease supplier balance
CREATE OR REPLACE FUNCTION public.handle_purchase_return_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance - NEW.total WHERE id = NEW.supplier_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance + OLD.total WHERE id = OLD.supplier_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_purchase_return_balance
  AFTER INSERT OR DELETE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_return_balance();

-- 6. STOCK MOVEMENT TRIGGER: Update product stock_quantity
CREATE OR REPLACE FUNCTION public.handle_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type IN ('purchase', 'return_in', 'adjustment_in', 'opening') THEN
      UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.movement_type IN ('sale', 'return_out', 'adjustment_out', 'damage', 'expired') THEN
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.movement_type IN ('purchase', 'return_in', 'adjustment_in', 'opening') THEN
      UPDATE products SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.product_id;
    ELSIF OLD.movement_type IN ('sale', 'return_out', 'adjustment_out', 'damage', 'expired') THEN
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_stock_movement
  AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_movement();

-- 7. SALES INVOICE ITEMS TRIGGER: Deduct stock when invoice items are created
CREATE OR REPLACE FUNCTION public.handle_sales_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.product_id IS NOT NULL THEN
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.product_id IS NOT NULL THEN
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sales_item_stock
  AFTER INSERT OR DELETE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_item_stock();

-- 8. EXPENSE TRIGGER: Update bank account balance for non-cash expenses
CREATE OR REPLACE FUNCTION public.handle_expense_bank_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts SET balance = balance + OLD.amount WHERE id = OLD.bank_account_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_expense_bank_balance
  AFTER INSERT OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_expense_bank_balance();

-- ============================================================
-- PHASE 1B: Document Number Sequences (counter table)
-- ============================================================

CREATE TABLE public.document_counters (
  document_type text PRIMARY KEY,
  prefix text NOT NULL,
  current_value integer NOT NULL DEFAULT 0
);

ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select document_counters" ON public.document_counters FOR SELECT USING (true);
CREATE POLICY "Auth update document_counters" ON public.document_counters FOR UPDATE USING (true);

-- Seed counters (will be populated from existing data)
INSERT INTO public.document_counters (document_type, prefix, current_value) VALUES
  ('sales_invoice', 'SI-', 0),
  ('purchase_invoice', 'PI-', 0),
  ('expense', 'EXP-', 0),
  ('payment', 'PAY-', 0),
  ('delivery_note', 'DN-', 0),
  ('proforma_invoice', 'PF-', 0),
  ('purchase_order', 'PO-', 0),
  ('purchase_proforma', 'PP-', 0),
  ('goods_received_note', 'GRN-', 0),
  ('sales_return', 'SR-', 0),
  ('purchase_return', 'PR-', 0),
  ('warranty_invoice', 'WI-', 0),
  ('journal_entry', 'JE-', 0);

-- Function to atomically get next document number
CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next integer;
BEGIN
  UPDATE document_counters
  SET current_value = current_value + 1
  WHERE document_type = p_document_type
  RETURNING prefix, current_value INTO v_prefix, v_next;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown document type: %', p_document_type;
  END IF;

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$$;

-- Sync counters with existing data
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM sales_invoices), 0) WHERE document_type = 'sales_invoice';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM purchase_invoices), 0) WHERE document_type = 'purchase_invoice';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM expenses), 0) WHERE document_type = 'expense';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM payments), 0) WHERE document_type = 'payment';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM delivery_notes), 0) WHERE document_type = 'delivery_note';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM proforma_invoices), 0) WHERE document_type = 'proforma_invoice';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM purchase_orders), 0) WHERE document_type = 'purchase_order';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM purchase_proformas), 0) WHERE document_type = 'purchase_proforma';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM goods_received_notes), 0) WHERE document_type = 'goods_received_note';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM sales_returns), 0) WHERE document_type = 'sales_return';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM purchase_returns), 0) WHERE document_type = 'purchase_return';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM warranty_invoices), 0) WHERE document_type = 'warranty_invoice';
UPDATE document_counters SET current_value = COALESCE((SELECT COUNT(*) FROM journal_entries), 0) WHERE document_type = 'journal_entry';
