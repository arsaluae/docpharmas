
-- 1. MULTI-TENANT UNIQUE CONSTRAINTS
ALTER TABLE public.chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_code_key;
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_tenant_code_key UNIQUE (tenant_id, code);

ALTER TABLE public.document_templates DROP CONSTRAINT IF EXISTS document_templates_document_type_key;
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_tenant_type_key UNIQUE (tenant_id, document_type);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_number_key;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_tenant_number_key UNIQUE (tenant_id, expense_number);

ALTER TABLE public.goods_received_notes DROP CONSTRAINT IF EXISTS goods_received_notes_grn_number_key;
ALTER TABLE public.goods_received_notes ADD CONSTRAINT grn_tenant_number_key UNIQUE (tenant_id, grn_number);

ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_number_key;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_tenant_number_key UNIQUE (tenant_id, entry_number);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_number_key;
ALTER TABLE public.payments ADD CONSTRAINT payments_tenant_number_key UNIQUE (tenant_id, payment_number);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.products ADD CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku);

ALTER TABLE public.proforma_invoices DROP CONSTRAINT IF EXISTS proforma_invoices_proforma_number_key;
ALTER TABLE public.proforma_invoices ADD CONSTRAINT proforma_tenant_number_key UNIQUE (tenant_id, proforma_number);

ALTER TABLE public.purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_bill_number_key;
ALTER TABLE public.purchase_invoices ADD CONSTRAINT purchase_invoices_tenant_bill_key UNIQUE (tenant_id, bill_number);

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_tenant_number_key UNIQUE (tenant_id, po_number);

ALTER TABLE public.sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_invoice_number_key;
ALTER TABLE public.sales_invoices ADD CONSTRAINT sales_invoices_tenant_number_key UNIQUE (tenant_id, invoice_number);

ALTER TABLE public.sales_returns DROP CONSTRAINT IF EXISTS sales_returns_return_number_key;
ALTER TABLE public.sales_returns ADD CONSTRAINT sales_returns_tenant_number_key UNIQUE (tenant_id, return_number);

-- 2. INVENTORY SAFETY TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_negative_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric;
  v_new numeric;
BEGIN
  -- Only check OUT movements
  IF NEW.movement_type NOT IN ('sale','sale_out','return_out','adjustment_out','damage','expired') THEN
    RETURN NEW;
  END IF;
  SELECT stock_quantity INTO v_current FROM products WHERE id = NEW.product_id;
  v_new := COALESCE(v_current,0) - NEW.quantity;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %: on-hand %, requested %', NEW.product_id, v_current, NEW.quantity
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON public.stock_movements;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_stock();

-- 3. ACTIVE FLAGS ON MASTER DATA
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.sales_agents ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- couriers table may or may not exist; guard it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='couriers') THEN
    EXECUTE 'ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true';
  END IF;
END$$;

-- 4. VOID COLUMNS
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.goods_received_notes ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.goods_received_notes ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.goods_received_notes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 5. VOID DOCUMENT RPC
CREATE OR REPLACE FUNCTION public.void_document(p_table text, p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_allowed text[] := ARRAY['sales_invoices','purchase_invoices','goods_received_notes','payments'];
BEGIN
  IF NOT (p_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Void not supported for table %', p_table;
  END IF;

  -- Delete linked stock movements (reverses stock via existing trigger)
  DELETE FROM stock_movements
   WHERE reference_id = p_id
     AND tenant_id = v_tenant;

  -- Mark the document voided. Delete payment row body? Keep audit by status.
  EXECUTE format(
    'UPDATE public.%I SET status = ''voided'', void_reason = $1, voided_at = now() WHERE id = $2 AND tenant_id = $3',
    p_table
  ) USING p_reason, p_id, v_tenant;

  -- For payments, also reverse balance (delete will fire balance trigger). Use delete-then-reinsert? Simpler: hard delete payment so balance trigger reverses customer/supplier/bank.
  IF p_table = 'payments' THEN
    DELETE FROM payments WHERE id = p_id AND tenant_id = v_tenant;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_document(text, uuid, text) TO authenticated;
