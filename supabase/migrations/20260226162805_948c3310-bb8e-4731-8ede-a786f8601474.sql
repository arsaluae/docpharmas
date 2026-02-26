
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles: authenticated can read their own
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- BMR Steps
CREATE TABLE public.bmr_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE NOT NULL,
  step_name text NOT NULL,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_by uuid NULL,
  completed_at timestamptz NULL,
  yield_expected numeric NOT NULL DEFAULT 0,
  yield_actual numeric NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bmr_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bmr_steps" ON public.bmr_steps FOR SELECT TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated insert bmr_steps" ON public.bmr_steps FOR INSERT TO authenticated WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated update bmr_steps" ON public.bmr_steps FOR UPDATE TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated delete bmr_steps" ON public.bmr_steps FOR DELETE TO authenticated USING (public.is_authenticated());

-- Raw Materials (Quarantine Vault)
CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier text NOT NULL,
  lot_number text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  status text NOT NULL DEFAULT 'locked',
  released_by uuid NULL,
  released_at timestamptz NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  expiry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read raw_materials" ON public.raw_materials FOR SELECT TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated insert raw_materials" ON public.raw_materials FOR INSERT TO authenticated WITH CHECK (public.is_authenticated());
CREATE POLICY "Admin can update raw_materials" ON public.raw_materials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.is_authenticated());
CREATE POLICY "Authenticated delete raw_materials" ON public.raw_materials FOR DELETE TO authenticated USING (public.is_authenticated());

-- Inventory Items (FEFO)
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'units',
  expiry_date date NOT NULL,
  location text NOT NULL DEFAULT 'Warehouse A',
  cost_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read inventory_items" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated insert inventory_items" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated update inventory_items" ON public.inventory_items FOR UPDATE TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated delete inventory_items" ON public.inventory_items FOR DELETE TO authenticated USING (public.is_authenticated());

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Import Folders (Landed Costing)
CREATE TABLE public.import_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_name text NOT NULL,
  supplier text NOT NULL,
  status text NOT NULL DEFAULT 'in_transit',
  lc_number text NOT NULL,
  duties numeric NOT NULL DEFAULT 0,
  freight numeric NOT NULL DEFAULT 0,
  insurance numeric NOT NULL DEFAULT 0,
  total_landed_cost numeric NOT NULL DEFAULT 0,
  arrival_date date NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read import_folders" ON public.import_folders FOR SELECT TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated insert import_folders" ON public.import_folders FOR INSERT TO authenticated WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated update import_folders" ON public.import_folders FOR UPDATE TO authenticated USING (public.is_authenticated());
CREATE POLICY "Authenticated delete import_folders" ON public.import_folders FOR DELETE TO authenticated USING (public.is_authenticated());
