
-- ============================================================
-- PHASE 1: Critical accounting & security fixes
-- ============================================================

-- ----- C1: void-aware balance triggers ----------------------
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL AND COALESCE(NEW.status,'') <> 'voided' THEN
      UPDATE customers SET balance = balance + NEW.total WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse on transition into 'voided'
    IF COALESCE(OLD.status,'') <> 'voided' AND NEW.status = 'voided' AND OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance - OLD.total WHERE id = OLD.customer_id;
    -- Re-apply if unvoided (should be rare)
    ELSIF COALESCE(OLD.status,'') = 'voided' AND COALESCE(NEW.status,'') <> 'voided' AND NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET balance = balance + NEW.total WHERE id = NEW.customer_id;
    -- Total changed on a live invoice
    ELSIF COALESCE(NEW.status,'') <> 'voided' AND COALESCE(OLD.status,'') <> 'voided'
          AND NEW.customer_id = OLD.customer_id AND COALESCE(NEW.total,0) <> COALESCE(OLD.total,0) THEN
      UPDATE customers SET balance = balance + (NEW.total - OLD.total) WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL AND COALESCE(OLD.status,'') <> 'voided' THEN
      UPDATE customers SET balance = balance - OLD.total WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_purchase_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NOT NULL AND COALESCE(NEW.status,'') <> 'voided' THEN
      UPDATE suppliers SET balance = balance + NEW.total WHERE id = NEW.supplier_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status,'') <> 'voided' AND NEW.status = 'voided' AND OLD.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance - OLD.total WHERE id = OLD.supplier_id;
    ELSIF COALESCE(OLD.status,'') = 'voided' AND COALESCE(NEW.status,'') <> 'voided' AND NEW.supplier_id IS NOT NULL THEN
      UPDATE suppliers SET balance = balance + NEW.total WHERE id = NEW.supplier_id;
    ELSIF COALESCE(NEW.status,'') <> 'voided' AND COALESCE(OLD.status,'') <> 'voided'
          AND NEW.supplier_id = OLD.supplier_id AND COALESCE(NEW.total,0) <> COALESCE(OLD.total,0) THEN
      UPDATE suppliers SET balance = balance + (NEW.total - OLD.total) WHERE id = NEW.supplier_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL AND COALESCE(OLD.status,'') <> 'voided' THEN
      UPDATE suppliers SET balance = balance - OLD.total WHERE id = OLD.supplier_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

-- Make sure these triggers fire on UPDATE (existing trigger may be INSERT/DELETE only)
DROP TRIGGER IF EXISTS trg_sales_invoice_balance ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoice_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_invoice_balance();

DROP TRIGGER IF EXISTS trg_purchase_invoice_balance ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoice_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_invoice_balance();

-- ----- C2: void_document soft-voids payments (audit-safe) ---
CREATE OR REPLACE FUNCTION public.void_document(p_table text, p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_allowed text[] := ARRAY['sales_invoices','purchase_invoices','goods_received_notes','payments'];
  v_pay record;
BEGIN
  IF NOT (p_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Void not supported for table %', p_table;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to void a document.';
  END IF;

  -- Reverse stock impact (trigger on stock_movements handles the product update).
  DELETE FROM stock_movements
   WHERE reference_id = p_id AND tenant_id = v_tenant;

  IF p_table = 'payments' THEN
    -- Soft-void: keep the row for audit (FBR), reverse balances manually.
    SELECT * INTO v_pay FROM payments WHERE id = p_id AND tenant_id = v_tenant
      AND COALESCE(status,'') <> 'voided' FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;

    -- Reverse party balance (mirror of handle_payment_balance INSERT branch)
    IF v_pay.party_type = 'customer' THEN
      IF v_pay.type = 'received' THEN UPDATE customers SET balance = balance + v_pay.amount WHERE id = v_pay.party_id;
      ELSE UPDATE customers SET balance = balance - v_pay.amount WHERE id = v_pay.party_id; END IF;
    ELSIF v_pay.party_type = 'supplier' THEN
      IF v_pay.type = 'made' THEN UPDATE suppliers SET balance = balance + v_pay.amount WHERE id = v_pay.party_id;
      ELSE UPDATE suppliers SET balance = balance - v_pay.amount WHERE id = v_pay.party_id; END IF;
    ELSIF v_pay.party_type = 'printer' THEN
      IF v_pay.type = 'made' THEN UPDATE printers SET balance = balance + v_pay.amount WHERE id = v_pay.party_id;
      ELSE UPDATE printers SET balance = balance - v_pay.amount WHERE id = v_pay.party_id; END IF;
    END IF;
    -- Reverse bank balance
    IF v_pay.bank_account_id IS NOT NULL THEN
      IF v_pay.type = 'received' THEN UPDATE bank_accounts SET balance = balance - v_pay.amount WHERE id = v_pay.bank_account_id;
      ELSE UPDATE bank_accounts SET balance = balance + v_pay.amount WHERE id = v_pay.bank_account_id; END IF;
    END IF;

    UPDATE payments
       SET status = 'voided', void_reason = p_reason, voided_at = now()
     WHERE id = p_id AND tenant_id = v_tenant;

    -- Reconcile linked invoice statuses
    IF v_pay.party_type = 'customer' THEN PERFORM recalc_customer_invoice_status(v_pay.party_id); END IF;
    IF v_pay.party_type = 'supplier' THEN PERFORM recalc_supplier_invoice_status(v_pay.party_id); END IF;
  ELSE
    EXECUTE format(
      'UPDATE public.%I SET status = ''voided'', void_reason = $1, voided_at = now() WHERE id = $2 AND tenant_id = $3',
      p_table
    ) USING p_reason, p_id, v_tenant;
  END IF;
END $$;

-- ----- H1: credit note status guard -------------------------
CREATE OR REPLACE FUNCTION public.handle_credit_note_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'') = 'active' THEN
      IF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSIF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- activate
    IF COALESCE(OLD.status,'') <> 'active' AND NEW.status = 'active' THEN
      IF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSIF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      END IF;
    -- deactivate
    ELSIF COALESCE(OLD.status,'') = 'active' AND COALESCE(NEW.status,'') <> 'active' THEN
      IF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSIF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.status,'') = 'active' THEN
      IF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSIF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_credit_note_balance ON public.credit_notes;
CREATE TRIGGER trg_credit_note_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_credit_note_balance();

-- Mirror for debit notes (same bug)
CREATE OR REPLACE FUNCTION public.handle_debit_note_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'') = 'active' THEN
      IF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSIF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status,'') <> 'active' AND NEW.status = 'active' THEN
      IF NEW.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance - NEW.amount WHERE id = NEW.party_id;
      ELSIF NEW.party_type = 'customer' THEN UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.party_id;
      END IF;
    ELSIF COALESCE(OLD.status,'') = 'active' AND COALESCE(NEW.status,'') <> 'active' THEN
      IF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSIF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.status,'') = 'active' THEN
      IF OLD.party_type = 'supplier' THEN UPDATE suppliers SET balance = balance + OLD.amount WHERE id = OLD.party_id;
      ELSIF OLD.party_type = 'customer' THEN UPDATE customers SET balance = balance - OLD.amount WHERE id = OLD.party_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_debit_note_balance ON public.debit_notes;
CREATE TRIGGER trg_debit_note_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_debit_note_balance();

-- ----- H2: recalc_customer_invoice_status correct allocation -
CREATE OR REPLACE FUNCTION public.recalc_customer_invoice_status(p_customer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_direct_paid numeric;
  v_general_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
  v_from_general numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_general_payments
  FROM payments
  WHERE party_type = 'customer' AND type = 'received' AND party_id = p_customer_id
    AND invoice_id IS NULL AND COALESCE(status,'active') <> 'voided';

  FOR v_invoice IN
    SELECT id, total
    FROM sales_invoices
    WHERE customer_id = p_customer_id
      AND status NOT IN ('cancelled','voided')
    ORDER BY date ASC, created_at ASC
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_direct_paid
    FROM payments
    WHERE party_type = 'customer' AND type = 'received' AND invoice_id = v_invoice.id
      AND COALESCE(status,'active') <> 'voided';

    v_from_general := LEAST(
      GREATEST(v_invoice.total - v_direct_paid, 0),
      GREATEST(v_general_payments - v_running_paid, 0)
    );
    v_alloc := v_direct_paid + v_from_general;
    -- FIX: increment by what we *actually* consumed from the general pool, not by demand.
    v_running_paid := v_running_paid + v_from_general;

    UPDATE sales_invoices
    SET amount_paid = v_alloc,
        status = CASE
          WHEN v_alloc >= v_invoice.total THEN 'paid'
          WHEN v_alloc > 0 THEN 'partial'
          ELSE 'dispatched'
        END
    WHERE id = v_invoice.id;
  END LOOP;
END $$;

-- Same fix for supplier side
CREATE OR REPLACE FUNCTION public.recalc_supplier_invoice_status(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_direct_paid numeric;
  v_general_payments numeric;
  v_running_paid numeric := 0;
  v_invoice record;
  v_alloc numeric;
  v_from_general numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_general_payments
  FROM payments
  WHERE party_type = 'supplier' AND type = 'made' AND party_id = p_supplier_id
    AND invoice_id IS NULL AND COALESCE(status,'active') <> 'voided';

  FOR v_invoice IN
    SELECT id, total
    FROM purchase_invoices
    WHERE supplier_id = p_supplier_id
      AND status NOT IN ('cancelled','voided')
    ORDER BY date ASC, created_at ASC
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_direct_paid
    FROM payments
    WHERE party_type = 'supplier' AND type = 'made' AND invoice_id = v_invoice.id
      AND COALESCE(status,'active') <> 'voided';

    v_from_general := LEAST(
      GREATEST(v_invoice.total - v_direct_paid, 0),
      GREATEST(v_general_payments - v_running_paid, 0)
    );
    v_alloc := v_direct_paid + v_from_general;
    v_running_paid := v_running_paid + v_from_general;

    UPDATE purchase_invoices
    SET status = CASE
          WHEN v_alloc >= v_invoice.total THEN 'paid'
          WHEN v_alloc > 0 THEN 'partial'
          ELSE 'unpaid'
        END
    WHERE id = v_invoice.id;
  END LOOP;
END $$;

-- ----- H3: attach period-lock guard to remaining tables -----
DROP TRIGGER IF EXISTS enforce_period_lock_trg ON public.journal_entries;
CREATE TRIGGER enforce_period_lock_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

DROP TRIGGER IF EXISTS enforce_period_lock_trg ON public.stock_movements;
CREATE TRIGGER enforce_period_lock_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

-- ----- M2: complete RLS for print_deliveries & print_rejections
DO $$
BEGIN
  -- print_deliveries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_deliveries' AND policyname='tenant_select_print_deliveries') THEN
    CREATE POLICY tenant_select_print_deliveries ON public.print_deliveries
      FOR SELECT USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_deliveries' AND policyname='tenant_insert_print_deliveries') THEN
    CREATE POLICY tenant_insert_print_deliveries ON public.print_deliveries
      FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_deliveries' AND policyname='tenant_update_print_deliveries') THEN
    CREATE POLICY tenant_update_print_deliveries ON public.print_deliveries
      FOR UPDATE USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_deliveries' AND policyname='tenant_delete_print_deliveries') THEN
    CREATE POLICY tenant_delete_print_deliveries ON public.print_deliveries
      FOR DELETE USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;

  -- print_rejections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_rejections' AND policyname='tenant_select_print_rejections') THEN
    CREATE POLICY tenant_select_print_rejections ON public.print_rejections
      FOR SELECT USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_rejections' AND policyname='tenant_insert_print_rejections') THEN
    CREATE POLICY tenant_insert_print_rejections ON public.print_rejections
      FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_rejections' AND policyname='tenant_update_print_rejections') THEN
    CREATE POLICY tenant_update_print_rejections ON public.print_rejections
      FOR UPDATE USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='print_rejections' AND policyname='tenant_delete_print_rejections') THEN
    CREATE POLICY tenant_delete_print_rejections ON public.print_rejections
      FOR DELETE USING (tenant_id = get_user_tenant_id() OR has_role(auth.uid(),'admin'));
  END IF;

  -- payment_submissions DELETE (admin/owner only)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_submissions' AND policyname='tenant_delete_payment_submissions') THEN
    CREATE POLICY tenant_delete_payment_submissions ON public.payment_submissions
      FOR DELETE USING (has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- Ensure RLS enabled
ALTER TABLE public.print_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_rejections ENABLE ROW LEVEL SECURITY;

-- ----- M3 & FK coverage -------------------------------------
-- Add FKs only when missing. Use ON DELETE CASCADE for tenant_id (when a tenant is deleted
-- their rows should go with them); ON DELETE SET NULL for soft references.

DO $$
BEGIN
  -- tenant_id FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ap_tenant')         THEN ALTER TABLE public.accounting_periods         ADD CONSTRAINT fk_ap_tenant         FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_areas_tenant')      THEN ALTER TABLE public.areas                       ADD CONSTRAINT fk_areas_tenant      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_audit_tenant')      THEN ALTER TABLE public.audit_log                   ADD CONSTRAINT fk_audit_tenant      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cp_tenant')         THEN ALTER TABLE public.city_products               ADD CONSTRAINT fk_cp_tenant         FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_dn_tenant')         THEN ALTER TABLE public.debit_notes                 ADD CONSTRAINT fk_dn_tenant         FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_deliv_tenant')      THEN ALTER TABLE public.delivery_notes              ADD CONSTRAINT fk_deliv_tenant      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_freight_tenant')    THEN ALTER TABLE public.freight_providers           ADD CONSTRAINT fk_freight_tenant    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ppa_tenant')        THEN ALTER TABLE public.purchase_print_allocations  ADD CONSTRAINT fk_ppa_tenant        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_sal_tenant')        THEN ALTER TABLE public.stock_audit_log             ADD CONSTRAINT fk_sal_tenant        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE; END IF;

  -- product/customer/supplier soft references
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cp_product')        THEN ALTER TABLE public.city_products               ADD CONSTRAINT fk_cp_product        FOREIGN KEY (product_id)  REFERENCES public.products(id)  ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_deliv_customer')    THEN ALTER TABLE public.delivery_notes              ADD CONSTRAINT fk_deliv_customer    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_deliv_supplier')    THEN ALTER TABLE public.delivery_notes              ADD CONSTRAINT fk_deliv_supplier    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ppa_product')       THEN ALTER TABLE public.purchase_print_allocations  ADD CONSTRAINT fk_ppa_product       FOREIGN KEY (product_id)  REFERENCES public.products(id)  ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ppa_supplier')      THEN ALTER TABLE public.purchase_print_allocations  ADD CONSTRAINT fk_ppa_supplier      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_sal_product')       THEN ALTER TABLE public.stock_audit_log             ADD CONSTRAINT fk_sal_product       FOREIGN KEY (product_id)  REFERENCES public.products(id)  ON DELETE CASCADE; END IF;

  -- payments.invoice_id → sales_invoices.id (nullable, SET NULL on delete)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_invoice')  THEN ALTER TABLE public.payments                    ADD CONSTRAINT fk_payments_invoice  FOREIGN KEY (invoice_id)  REFERENCES public.sales_invoices(id) ON DELETE SET NULL; END IF;

  -- agent_commissions.payment_id → payments.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agentcomm_payment') THEN ALTER TABLE public.agent_commissions           ADD CONSTRAINT fk_agentcomm_payment FOREIGN KEY (payment_id)  REFERENCES public.payments(id)  ON DELETE SET NULL; END IF;
EXCEPTION WHEN foreign_key_violation THEN
  -- Surface clearly if there are orphan rows; user can clean and re-run.
  RAISE NOTICE 'Some FK additions failed due to orphan rows. Clean orphans and re-run.';
END $$;

-- ----- Phase-1 indexes (cheap and high-impact) --------------
CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant_date     ON public.sales_invoices    (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_tenant_date  ON public.purchase_invoices (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date           ON public.payments          (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date           ON public.expenses          (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_date    ON public.stock_movements   (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date    ON public.journal_entries   (tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_party                 ON public.payments          (tenant_id, party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer        ON public.sales_invoices    (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier     ON public.purchase_invoices (tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_sii_invoice                    ON public.sales_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sii_product                    ON public.sales_invoice_items (product_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn                  ON public.grn_items         (grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_product              ON public.grn_items         (product_id);
