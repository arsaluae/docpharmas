
-- Drop old tables (cascade to remove FK dependencies)
DROP TABLE IF EXISTS bmr_steps CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS import_folders CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS raw_materials CASCADE;
DROP TABLE IF EXISTS batches CASCADE;

-- ============ CORE ACCOUNTING ============

CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense','cogs')),
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text
);

-- ============ CUSTOMERS & SALES ============

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  ntn text,
  strn text,
  phone text,
  email text,
  address text,
  city text,
  credit_limit numeric NOT NULL DEFAULT 0,
  credit_days integer NOT NULL DEFAULT 30,
  opening_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category text NOT NULL DEFAULT 'tablet' CHECK (category IN ('tablet','capsule','syrup','injection','cream','ointment','drops','sachet','other')),
  drap_reg_number text,
  pack_size text,
  unit text NOT NULL DEFAULT 'pcs',
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  gst_rate numeric NOT NULL DEFAULT 17,
  stock_quantity numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','paid','overdue')),
  notes text,
  fbr_qr_data text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  batch_number text,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  gst_rate numeric NOT NULL DEFAULT 17,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  invoice_id uuid REFERENCES public.sales_invoices(id),
  customer_id uuid REFERENCES public.customers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','processed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.proforma_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  validity_days integer NOT NULL DEFAULT 30,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  gst numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','converted')),
  converted_invoice_id uuid REFERENCES public.sales_invoices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ SUPPLIERS & PURCHASES ============

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  ntn text,
  strn text,
  phone text,
  email text,
  address text,
  city text,
  payment_terms_days integer NOT NULL DEFAULT 30,
  wht_rate numeric NOT NULL DEFAULT 4.5,
  opening_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery date,
  subtotal numeric NOT NULL DEFAULT 0,
  gst numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL UNIQUE,
  po_id uuid REFERENCES public.purchase_orders(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  received_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_received_notes(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  batch_number text,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  expiry_date date,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id),
  grn_id uuid REFERENCES public.goods_received_notes(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  gst numeric NOT NULL DEFAULT 0,
  wht_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ INVENTORY ============

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  movement_type text NOT NULL CHECK (movement_type IN ('purchase_in','sale_out','return_in','return_out','adjustment')),
  quantity numeric NOT NULL,
  batch_number text,
  reference_type text,
  reference_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ PAYMENTS & BANKING ============

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank_name text NOT NULL,
  account_number text,
  branch text,
  opening_balance numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('received','made')),
  party_type text NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','cheque','bank_transfer','online')),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  cheque_number text,
  cheque_date date,
  reference text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('utilities','salaries','rent','transport','maintenance','marketing','regulatory','other')),
  description text,
  amount numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','cheque','bank_transfer','online')),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  account_id uuid REFERENCES public.chart_of_accounts(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ TAX & COMPLIANCE ============

CREATE TABLE public.tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  type text NOT NULL CHECK (type IN ('gst_output','gst_input','wht')),
  amount numeric NOT NULL DEFAULT 0,
  reference_type text,
  reference_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.drap_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  registration_number text NOT NULL,
  registration_date date,
  expiry_date date,
  renewal_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expiring','expired','pending')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ RLS ON ALL TABLES ============

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drap_registrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for all tables (authenticated users full access)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'chart_of_accounts','journal_entries','journal_lines','customers','products',
    'sales_invoices','sales_invoice_items','sales_returns','proforma_invoices',
    'suppliers','purchase_orders','purchase_order_items','goods_received_notes',
    'grn_items','purchase_invoices','stock_movements','bank_accounts','payments',
    'expenses','tax_records','drap_registrations'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Auth select %s" ON public.%I FOR SELECT TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth update %s" ON public.%I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth delete %s" ON public.%I FOR DELETE TO authenticated USING (true)', tbl, tbl);
  END LOOP;
END $$;
