
-- invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  batch_id uuid REFERENCES public.batches(id),
  customer_name text NOT NULL,
  customer_ntn text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  fbr_qr_data text,
  finalized_at timestamptz,
  finalized_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read invoices" ON public.invoices FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated insert invoices" ON public.invoices FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated update invoices" ON public.invoices FOR UPDATE USING (is_authenticated());
CREATE POLICY "Authenticated delete invoices" ON public.invoices FOR DELETE USING (is_authenticated());

-- audit_events table
CREATE TABLE public.audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.batches(id),
  event_type text NOT NULL,
  event_label text NOT NULL,
  actor_name text,
  entity_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read audit_events" ON public.audit_events FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated insert audit_events" ON public.audit_events FOR INSERT WITH CHECK (is_authenticated());

-- notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  priority text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  source_type text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read notifications" ON public.notifications FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated update notifications" ON public.notifications FOR UPDATE USING (is_authenticated());
CREATE POLICY "Authenticated insert notifications" ON public.notifications FOR INSERT WITH CHECK (is_authenticated());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
