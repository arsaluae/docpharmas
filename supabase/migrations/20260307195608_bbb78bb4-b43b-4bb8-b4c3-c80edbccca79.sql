-- Drop duplicate trigger that causes double balance adjustments
DROP TRIGGER IF EXISTS on_payment_change ON public.payments;