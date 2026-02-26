
-- Helper function
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Batches table
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'quarantine', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage TEXT NOT NULL DEFAULT 'mixing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for batches
CREATE POLICY "Authenticated users can read batches" ON public.batches FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert batches" ON public.batches FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update batches" ON public.batches FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete batches" ON public.batches FOR DELETE USING (public.is_authenticated());

-- RLS policies for alerts
CREATE POLICY "Authenticated users can read alerts" ON public.alerts FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert alerts" ON public.alerts FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update alerts" ON public.alerts FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete alerts" ON public.alerts FOR DELETE USING (public.is_authenticated());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_batches_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
